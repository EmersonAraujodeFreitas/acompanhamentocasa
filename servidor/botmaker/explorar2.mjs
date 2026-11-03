// 2ª leitura: valores de campos categóricos (sem texto livre), suporte a filtro de datas, volume e rotas de auditoria/relatórios.
import fs from 'node:fs';
const BASE = 'https://api.botmaker.com/v2.0';
const CONTAS = [['UVA', process.env.BOTMAKER_TOKEN_UVA], ['UJ', process.env.BOTMAKER_TOKEN_UJ]].filter(c => c[1]);
const iso = n => new Date(Date.now() - n * 36e5).toISOString();
const out = { gerado_em: new Date().toISOString(), contas: {} };
const chaves = v => v && typeof v === 'object' ? (Array.isArray(v) ? ['[' + v.length + ']'] : Object.keys(v).slice(0, 40)) : typeof v;
for (const [conta, token] of CONTAS) {
  const H = { 'access-token': token, Accept: 'application/json' }, r = out.contas[conta] = {};
  const get = async (p) => { const t0 = Date.now(); try { const x = await fetch(BASE + p, { headers: H }); const t = await x.text(); let j = null; try { j = JSON.parse(t) } catch (e) { } return { status: x.status, j, ms: Date.now() - t0, texto: j ? '' : t.slice(0, 160) } } catch (e) { return { status: 0, j: null, texto: String(e.message).slice(0, 100), ms: 0 } } };
  const cont = (arr, f) => { const m = {}; for (const x of arr) { const v = f(x); const k = v === undefined || v === null ? '(nulo)' : String(v).slice(0, 40); m[k] = (m[k] || 0) + 1 } return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25)) };
  // sessões: filtro de datas e causa de início
  let a = await get('/sessions?limit=500'); const s1 = a.j && a.j.items || [];
  r.sessoes = { status: a.status, ms: a.ms, n: s1.length, startingCause: cont(s1, x => x.startingCause), primeira: s1[0] && s1[0].creationTime, ultima: s1.length && s1[s1.length - 1].creationTime };
  for (const q of ['?from=' + iso(3) + '&to=' + iso(2) + '&limit=500', '?startDate=' + iso(3) + '&endDate=' + iso(2) + '&limit=500', '?creationTimeFrom=' + iso(3) + '&creationTimeTo=' + iso(2) + '&limit=500', '?sessionCreationTimeFrom=' + iso(3) + '&sessionCreationTimeTo=' + iso(2) + '&limit=500']) {
    const b = await get('/sessions' + q.replace(/\+/g, '%2B')); const it = b.j && b.j.items || [];
    r.sessoes['filtro ' + q.split('=')[0]] = { status: b.status, n: it.length, primeira: it[0] && it[0].creationTime, ultima: it.length && it[it.length - 1].creationTime };
  }
  // mensagens
  a = await get('/messages?limit=250'); const m1 = a.j && a.j.items || [];
  r.mensagens = { status: a.status, ms: a.ms, n: m1.length, from: cont(m1, x => x.from), tipo: cont(m1, x => x.content && x.content.type), comQueue: cont(m1, x => x.queueId ? 'com fila' : 'sem fila'), campos: m1[0] ? Object.keys(m1[0]) : [] };
  if (m1[0] && m1[0].sessionId) { const b = await get('/messages?sessionId=' + encodeURIComponent(m1[0].sessionId)); r.mensagens.porSessao = { status: b.status, n: b.j && b.j.items ? b.j.items.length : null }; }
  // atendentes
  a = await get('/agents?limit=200'); const ag = a.j && a.j.items || [];
  r.atendentes = { status: a.status, n: ag.length, status_valores: cont(ag, x => x.status), role: cont(ag, x => x.role), online: cont(ag, x => x.isOnline), prioridade: cont(ag, x => x.priority) };
  // chats: tags e variáveis presentes (só nomes), canais
  a = await get('/chats?limit=250'); const ch = a.j && a.j.items || [];
  r.chats = { status: a.status, n: ch.length, canais: cont(ch, x => x.chat && x.chat.channelId), variaveis_mais_comuns: (() => { const m = {}; ch.forEach(x => Object.keys(x.variables || {}).forEach(k => m[k] = (m[k] || 0) + 1)); return Object.fromEntries(Object.entries(m).sort((p, q) => q[1] - p[1]).slice(0, 40)) })() };
  // rotas possíveis de auditoria / relatórios / status de atendentes
  r.rotas = {};
  for (const p of ['/audits?limit=3', '/audits/agents?limit=3', '/audits/agent-status?limit=3', '/audit?limit=3', '/agents/status?limit=3', '/agents/audits?limit=3', '/agents/activity?limit=3', '/agents/status-history?limit=3', '/agent-status?limit=3', '/agents/reports?limit=3', '/reports?limit=3', '/reports/agents?limit=3', '/reports/conversations?limit=3', '/reports/sessions?limit=3', '/metrics?limit=3', '/dashboards/agents?limit=3', '/dashboards/sessions?limit=3', '/dashboards/conversations?limit=3', '/dashboards?limit=3', '/billing?limit=3', '/billing/usage?limit=3', '/billing/messages?limit=3', '/chats/metrics?limit=3', '/sessions/metrics?limit=3', '/attention-queues/metrics?limit=3', '/chats-actions?limit=3', '/chats/actions?limit=3', '/ratings?limit=3', '/surveys?limit=3', '/nps?limit=3']) {
    const b = await get(p + '&from=' + encodeURIComponent(iso(48)) + '&to=' + encodeURIComponent(iso(0))); r.rotas[p.split('?')[0]] = { status: b.status, topo: b.j ? chaves(b.j) : b.texto, itens: b.j && b.j.items ? chaves(b.j.items[0]) : undefined };
  }
}
fs.mkdirSync('servidor/botmaker/resultado', { recursive: true });
fs.writeFileSync('servidor/botmaker/resultado/esquema2.json', JSON.stringify(out, null, 1));
console.log('ok', CONTAS.map(c => c[0]).join(','));
