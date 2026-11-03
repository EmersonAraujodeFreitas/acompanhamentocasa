// 3ª leitura: erros completos das rotas de auditoria, paginação, filtros de data e limites de uso. Sem conteúdo de clientes.
import fs from 'node:fs';
const BASE = 'https://api.botmaker.com/v2.0';
const CONTAS = [['UVA', process.env.BOTMAKER_TOKEN_UVA], ['UJ', process.env.BOTMAKER_TOKEN_UJ]].filter(c => c[1]);
const out = { gerado_em: new Date().toISOString(), contas: {} };
const dia = (n, h = 0) => { const d = new Date(Date.now() - n * 864e5); d.setUTCHours(h, 0, 0, 0); return d.toISOString() };
const esp = ms => new Promise(r => setTimeout(r, ms));
const cont = (arr, f) => { const m = {}; for (const x of arr) { const v = f(x); const k = v === undefined || v === null ? '(nulo)' : String(v).slice(0, 40); m[k] = (m[k] || 0) + 1 } return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 15)) };
const faixa = it => it.length ? [it[0].creationTime, it[it.length - 1].creationTime] : null;
for (const [conta, token] of CONTAS) {
  const H = { 'access-token': token, Accept: 'application/json' }, r = out.contas[conta] = {};
  const get = async (p) => { await esp(400); const t0 = Date.now(); try { const x = await fetch(BASE + p, { headers: H }); const t = await x.text(); let j = null; try { j = JSON.parse(t) } catch (e) { } const hd = {}; x.headers.forEach((v, k) => { if (/rate|retry|limit|remaining/i.test(k)) hd[k] = v }); return { status: x.status, j, hd, ms: Date.now() - t0, texto: j ? '' : t.slice(0, 200) } } catch (e) { return { status: 0, j: null, hd: {}, texto: String(e.message).slice(0, 100), ms: 0 } } };
  // 1) erros completos das auditorias
  r.auditorias = {};
  for (const p of ['/audits/agents', '/audits/agent-status', '/audits/agents?from=' + dia(1) + '&to=' + dia(0), '/audits/agent-status?from=' + dia(1) + '&to=' + dia(0), '/audits/agents?startDate=' + dia(1) + '&endDate=' + dia(0), '/audits/agent-status?startDate=' + dia(1) + '&endDate=' + dia(0), '/audits/agent-status?agentId=x', '/audits/sessions', '/audits/chats', '/audits/messages', '/audits/queues', '/audits/status', '/audits/login', '/audits/agents-status']) {
    const b = await get(p.replace(/(\d{4}-\d\d-\d\dT[\d:.]+Z)/g, m => encodeURIComponent(m)));
    r.auditorias[p.slice(0, 80)] = { status: b.status, corpo: b.j ? JSON.stringify(b.j).slice(0, 500) : b.texto, headers: b.hd };
  }
  // 2) filtro de datas e paginação em sessões
  const t0 = dia(3), t1 = dia(2);
  r.sessoes = {};
  for (const q of ['?limit=500', '?from=' + t0 + '&to=' + t1 + '&limit=500', '?startTime=' + t0 + '&endTime=' + t1 + '&limit=500', '?creationTime=' + t0 + '&limit=500', '?fromDate=' + t0 + '&toDate=' + t1 + '&limit=500', '?after=' + t0 + '&before=' + t1 + '&limit=500', '?since=' + t0 + '&until=' + t1 + '&limit=500', '?dateFrom=' + t0 + '&dateTo=' + t1 + '&limit=500']) {
    const b = await get('/sessions' + q.replace(/(\d{4}-\d\d-\d\dT[\d:.]+Z)/g, m => encodeURIComponent(m))); const it = b.j && b.j.items || [];
    r.sessoes[q.replace(/=[^&]*/g, m => m.length > 12 ? '=DATA' : m)] = { status: b.status, n: it.length, faixa: faixa(it), proxima: b.j && b.j.nextPage ? String(b.j.nextPage).slice(0, 160).replace(/[A-Za-z0-9_-]{24,}/g, '<token>') : null, ms: b.ms, headers: b.hd, alvo: [t0, t1] };
  }
  { // seguir a paginação por 3 páginas
    let b = await get('/sessions?limit=500'), pag = [];
    for (let i = 0; i < 3 && b.j && b.j.nextPage; i++) { const it = b.j.items; pag.push({ n: it.length, faixa: faixa(it) }); const np = String(b.j.nextPage); const u = np.startsWith('http') ? np.replace(BASE, '') : '/sessions?limit=500&nextPage=' + encodeURIComponent(np); b = await get(u.replace(/^https?:\/\/[^/]+\/v2\.0/, '')); if (b.status != 200) { pag.push({ status: b.status, corpo: b.texto || JSON.stringify(b.j).slice(0, 200) }); break } }
    r.paginacao_sessoes = pag;
  }
  // 3) mensagens: filtros de data, agentId e fila
  r.mensagens = {};
  for (const q of ['?limit=250', '?from=' + t0 + '&to=' + t1 + '&limit=250', '?startTime=' + t0 + '&endTime=' + t1 + '&limit=250']) {
    const b = await get('/messages' + q.replace(/(\d{4}-\d\d-\d\dT[\d:.]+Z)/g, m => encodeURIComponent(m))); const it = b.j && b.j.items || [];
    r.mensagens[q.replace(/=[^&]*/g, m => m.length > 12 ? '=DATA' : m)] = { status: b.status, n: it.length, faixa: faixa(it), from: cont(it, x => x.from), agentesDistintos: new Set(it.map(x => x.agentId).filter(Boolean)).size, filasDistintas: new Set(it.map(x => x.queueId).filter(Boolean)).size, sessoesDistintas: new Set(it.map(x => x.sessionId)).size, agentePorFrom: cont(it, x => x.from + ':' + (x.agentId ? 'com agentId' : 'sem agentId')), headers: b.hd };
  }
  // 4) limites: 12 chamadas seguidas sem pausa
  { const tt = []; for (let i = 0; i < 12; i++) { const t = Date.now(); const x = await fetch(BASE + '/messages?limit=50', { headers: H }); tt.push(x.status + '/' + (Date.now() - t) + 'ms'); await x.text() } r.rajada_12 = tt }
  // 5) agentes: nomes distintos x ids, e outros campos possíveis
  { const b = await get('/agents?limit=200'); const it = b.j && b.j.items || []; r.agentes = { n: it.length, campos: it[0] ? Object.keys(it[0]) : [], idsUnicos: new Set(it.map(x => x.id)).size, roles: cont(it, x => x.role) } }
  // 6) chats: outros campos de tempo para tipificação/fechamento, e rotas de chat individual (só nomes de campos)
  { const b = await get('/chats?limit=3'); const c0 = b.j && b.j.items && b.j.items[0]; r.chat_campos = c0 ? Object.keys(c0) : []; if (c0 && c0.chat) { const id = c0.chat.chatId; const m = await get('/chats/' + encodeURIComponent(id)); r.chat_individual = { status: m.status, campos: m.j ? Object.keys(m.j).slice(0, 40) : m.texto }; } }
}
fs.mkdirSync('servidor/botmaker/resultado', { recursive: true });
fs.writeFileSync('servidor/botmaker/resultado/esquema3.json', JSON.stringify(out, null, 1));
console.log('ok', CONTAS.map(c => c[0]).join(','));
