// Robô Botmaker -> Central: lê a API e monta linhas no MESMO formato dos relatórios exportados da Botmaker.
// O site importa essas linhas com a mesma rotina da importação manual (tempos em segundos).
//
// Modos (variável MODO):
//   validar     grava só números agregados em servidor/botmaker/resultado/validacao.json (sem telefone, nome ou texto)
//   sincronizar calcula e envia ao servidor (usuário "integração"), sem gravar nada no GitHub
// Janela: DE e ATE (aaaa-mm-dd, horário de Brasília) ou DIAS (padrão 2, contando hoje).
import fs from 'node:fs';
import zlib from 'node:zlib';

const BASE = process.env.BOTMAKER_BASE || 'https://api.botmaker.com/v2.0';
const MODO = process.env.MODO || 'validar';
const CONTAS = [['UVA', process.env.BOTMAKER_TOKEN_UVA], ['UJ', process.env.BOTMAKER_TOKEN_UJ]].filter(c => c[1]);
const TZ = -3 * 3600e3; // Brasília, sem horário de verão
const esp = ms => new Promise(r => setTimeout(r, ms));
const enc = encodeURIComponent;
const pad = n => String(n).padStart(2, '0');
const loc = iso => new Date(new Date(iso).getTime() + TZ);               // use getUTC* para ler a hora local
const diaLoc = iso => { const d = loc(iso); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) };
const brData = iso => { const d = loc(iso); return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() };
const brHora = iso => { const d = loc(iso); return brData(iso) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
const ms = iso => new Date(iso).getTime();

function janela() {
  const agora = Date.now();
  if (process.env.DE) {
    const de = new Date(process.env.DE + 'T00:00:00-03:00').getTime();
    const ate = process.env.ATE ? new Date(process.env.ATE + 'T23:59:59.999-03:00').getTime() : agora;
    return [new Date(de).toISOString(), new Date(Math.min(ate, agora)).toISOString()];
  }
  const dias = Math.max(1, Math.min(60, parseInt(process.env.DIAS || '2', 10) || 2));
  const hoje0 = new Date(new Date(agora + TZ).setUTCHours(0, 0, 0, 0) - TZ);        // 00:00 de hoje em Brasília
  return [new Date(hoje0.getTime() - (dias - 1) * 864e5).toISOString(), new Date(agora).toISOString()];
}
const [T0, T1] = janela();
const longo = Date.now() - ms(T0) > 2.5 * 864e5;                                  // a API só entrega ~3 dias sem long-term-search

const STATUS = { online: 'Online', busy: 'Ocupado', online_not_available: 'On-line (não disponível)', descanso: 'Descanso', treinamento: 'Treinamento', lanche: 'Lanche', banheiro: 'Banheiro', feedback: 'Feedback', falha_sistemica: 'Falha Sistêmica' };

function cliente(token, rotulo) {
  const H = { 'access-token': token, Accept: 'application/json' };
  return async function get(u, { minuto = false } = {}) {
    const url = u.startsWith('http') ? u : BASE + u;
    for (let i = 0; i < 8; i++) {
      await esp(250);
      let x, t;
      try { x = await fetch(url, { headers: H }); t = await x.text() } catch (e) { await esp(2000 * (i + 1)); continue }
      if (x.status === 429) { await esp(minuto || /minute/.test(t) ? 65000 : 3000 * (i + 1)); continue }
      if (x.status >= 500 && i < 3) { await esp(2000 * (i + 1)); continue }
      let j = null; try { j = JSON.parse(t) } catch (e) { }
      return { status: x.status, j, texto: j ? '' : t.slice(0, 200) };
    }
    throw new Error(rotulo + ': limite de chamadas excedido em ' + url.split('?')[0]);
  };
}
async function paginas(get, caminho, fn, opt = {}) {
  let url = caminho, n = 0, ant = null;
  const comMsgs = /include-messages=true/.test(caminho), comLongo = /long-term-search=true/.test(caminho);
  for (let p = 0; p < (opt.max || 400) && url; p++) {
    const b = await get(url, opt);
    if (b.status >= 400 || !b.j) throw new Error('Falha em ' + caminho.split('?')[0] + ' (' + b.status + '): ' + (b.j ? JSON.stringify(b.j).slice(0, 200) : b.texto));
    const it = b.j.items || [];
    const marca = it.length ? JSON.stringify([it[0].id || it[0].creationTime || '', it[it.length - 1].id || it[it.length - 1].creationTime || '']) : '';
    if (marca && marca === ant) { console.warn('Paginação repetiu a mesma página em ' + caminho.split('?')[0] + '; parando.'); break }
    ant = marca; n += it.length;
    if (fn(it) === false) break;
    let nx = b.j.nextPage;
    if (!nx || !it.length) break;
    nx = String(nx);
    if (!nx.startsWith('http')) { const tk = nx; nx = caminho.replace(/&?page-token=[^&]*/, '') + '&page-token=' + enc(tk) }
    else {   // o endereço devolvido já carrega a consulta; só refazemos o que ele pode ter perdido
      if (comMsgs) nx = nx.replace(/include-messages=false/, 'include-messages=true');
      if (comLongo && !/long-term-search=/.test(nx)) nx += '&long-term-search=true';
    }
    url = nx;
  }
  return n;
}
const mediana = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 };
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] };
const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const arred = (x, c = 1) => x == null ? null : Math.round(x * 10 ** c) / 10 ** c;

/* ------------------------------------------------------------ leitura de uma conta ------------------------------------------------------------ */
const semAcento = t => String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
function codStatus(x) { const t = semAcento(x); if (!t) return null; if (t === 'aluno' || t === 'alunoativo' || t === 'ativo') return 1; if (t === 'exaluno' || t === 'exalunos' || t === 'ex') return 2; if (t === 'lead') return 0; return null }
async function lerConta([un, token]) {
  const get = cliente(token, un), prog = (...a) => console.log('[' + un + ']', ...a), nome = { UJ: 'Unijorge', UVA: 'UVA' }[un] || un;
  const agentes = new Map(), filas = new Map();
  await paginas(get, '/agents?limit=500', it => it.forEach(a => agentes.set(a.id, a)));
  await paginas(get, '/attention-queues?limit=500', it => it.forEach(q => filas.set(q.id, q.name)));
  prog('atendentes', agentes.size, 'filas', filas.size);
  await avanco(un, 10, 'Lendo ' + nome + ': atendentes e filas…');

  // sessões com as mensagens aninhadas (uma passada só)
  const sessoes = [];
  const q = `/sessions?from=${enc(T0)}&to=${enc(T1)}&limit=100&include-messages=true` + (longo ? '&long-term-search=true' : '');
  const vistas = new Set(), i0 = ms(T0), i1 = ms(T1);
  await paginas(get, q, it => { it.forEach(s => { const t = ms(s.creationTime); if (t >= i0 && t <= i1 && !vistas.has(s.id)) { vistas.add(s.id); sessoes.push(s) } }); if (it.length && ms(it[it.length - 1].creationTime) > i1) return false; if (sessoes.length % 1000 < it.length) prog('sessões lidas', sessoes.length) });
  prog('sessões', sessoes.length);
  await avanco(un, 45, 'Lendo ' + nome + ': ' + sessoes.length + ' sessões com mensagens…');

  // variáveis dos chats (tipificação e NPS): só guardam o último valor, por isso o robô precisa rodar com frequência
  const vars = new Map(), precisa = new Set(sessoes.map(s => s.chat && s.chat.chat && s.chat.chat.chatId).filter(Boolean));
  if (process.env.SEM_VARIAVEIS !== '1') {
    let vazias = 0;
    await paginas(get, '/chats?limit=250', it => {
      let achou = 0;
      for (const c of it) {
        const id = c.chat && c.chat.chatId || c.chatId;
        if (id && precisa.has(id)) { const v = c.variables || {}; vars.set(id, { t: v.typification || v.tipificacao || null, nps: v.nps ?? null, st: codStatus(v.status), raw: v.status == null ? null : String(v.status).slice(0, 30) }); achou++ }
      }
      vazias = achou ? 0 : vazias + 1;
      return vazias < 6 && vars.size < precisa.size;
    }, { max: 120 });
    prog('chats com variáveis', vars.size, 'de', precisa.size);
    await avanco(un, 65, 'Lendo ' + nome + ': tipificação e NPS…');
  }

  // organização do contato: a variável "status" da Botmaker (aluno, ex-aluno, lead) -> 1, 2 ou 0
  const st = {}, cob = { aluno: 0, ex: 0, lead: 0, sem: 0, outros: {} };
  for (const s of sessoes) {
    const ch = s.chat && s.chat.chat || {}, v = vars.get(ch.chatId), c = v ? v.st : null;
    if (c === 1) { cob.aluno++; if (ch.contactId) st[ch.contactId] = 1 } else if (c === 2) { cob.ex++; if (ch.contactId) st[ch.contactId] = 2 } else if (c === 0) cob.lead++; else { cob.sem++; if (v && v.raw) cob.outros[v.raw] = (cob.outros[v.raw] || 0) + 1 }
  }
  prog('status do contato (sessões): aluno', cob.aluno, 'ex-aluno', cob.ex, 'lead', cob.lead, 'sem variável', cob.sem);
  const { sess, conv } = calcular(un, sessoes, agentes, filas, vars);
  await avanco(un, 70, 'Lendo ' + nome + ': status dos atendentes (a Botmaker limita a 1 consulta por minuto)…');
  const prod = process.env.SEM_PROD === '1' ? [] : await produtividade(get, un, agentes);
  await avanco(un, 100, nome + ' lido.');
  prog('linhas: sessões', sess.length, 'conversas', conv.length, 'produtividade', prod.length);
  return { un, sess, conv, prod, st, cob, agente: porAtendente(un, conv), cand: conv.map(c => c.__c) };
}

/* ------------------------------------------------------------ cálculo por sessão ------------------------------------------------------------ */
function calcular(un, sessoes, agentes, filas, vars) {
  const sess = [], conv = [];
  for (const s of sessoes) {
    const ch = s.chat && s.chat.chat || {}, v = vars.get(ch.chatId) || {};
    const m = (s.messages || []).slice().sort((a, b) => ms(a.creationTime) - ms(b.creationTime));
    const nu = m.filter(x => x.from === 'user').length, nb = m.filter(x => x.from === 'bot').length, ag = m.filter(x => x.from === 'agent'), np = ag.length;
    const tip = v.t || null;
    sess.push({
      'ID da sessão': s.id, 'Data da sessão': brData(s.creationTime), 'Horário da sessão': loc(s.creationTime).getUTCHours(),
      'ID do canal': ch.channelId || '', 'ID do contato/Telefone': ch.contactId || '', 'Mensagens do usuário': nu, 'Mensagens do Bot': nb,
      'Mensagens do operador': np, 'Operador falou': np ? 1 : 0, 'Tipificação': tip, 'Link da conversa': ''
    });
    if (!np) continue;
    const t = m.map(x => ms(x.creationTime)), i1 = m.findIndex(x => x.from === 'agent'), tAg1 = t[i1];
    const ult = m[m.length - 1], tUlt = ms(ult.creationTime), ultAg = [...m].reverse().find(x => x.from === 'agent');
    // tempo de resposta: da última mensagem do cliente (antes de uma resposta do atendente) até essa resposta
    const resp = [], respApos1 = [], respU = [], respUApos1 = [];
    let pend = null, pendU = null, primeira = true;
    for (const x of m) {
      if (x.from === 'user') { if (pend == null) pend = ms(x.creationTime); pendU = ms(x.creationTime) }
      else if (x.from === 'agent' && pend != null) { const d = (ms(x.creationTime) - pend) / 1000, du = (ms(x.creationTime) - pendU) / 1000; resp.push(d); respU.push(du); if (!primeira) { respApos1.push(d); respUApos1.push(du) } primeira = false; pend = null; pendU = null }
      else if (x.from === 'agent') primeira = false;
    }
    // espera: desde a última mensagem do bot (ou do cliente) antes do 1º atendente
    const antes = m.slice(0, i1);
    const ultBot = [...antes].reverse().find(x => x.from === 'bot'), ultUser = [...antes].reverse().find(x => x.from === 'user');
    const aBot = ultBot ? (tAg1 - ms(ultBot.creationTime)) / 1000 : null, aUser = ultUser ? (tAg1 - ms(ultUser.creationTime)) / 1000 : null;
    // atendente e fila: quem falou por último; transferências = trocas de atendente ou de fila entre mensagens do atendente
    let tr = 0; for (let k = 1; k < ag.length; k++) if (ag[k].agentId !== ag[k - 1].agentId || (ag[k].queueId && ag[k - 1].queueId && ag[k].queueId !== ag[k - 1].queueId)) tr++;
    const idAg = ultAg.agentId, nomeAg = (agentes.get(idAg) || {}).name || idAg || '';
    const qid = ultAg.queueId || [...m].reverse().find(x => x.queueId)?.queueId, fila = filas.get(qid) || qid || '—';
    const pq = m.findIndex(x => x.queueId), tQ = pq >= 0 ? t[pq] : null, tUserPrimeira = (m.find(x => x.from === 'user') || {}).creationTime;
    const c = {
      esperaInicio: (tAg1 - t[0]) / 1000, esperaFila1: tQ != null && tQ <= tAg1 ? (tAg1 - tQ) / 1000 : null,
      esperaUser1: tUserPrimeira ? Math.max(0, (tAg1 - ms(tUserPrimeira)) / 1000) : null, respPrimeira: resp.length ? resp[0] : null,
      co1: (tUlt - tAg1) / 1000, co2: (ms(ultAg.creationTime) - tAg1) / 1000, tt: (tUlt - t[0]) / 1000,
      eoUser: aUser, efBot: aBot, tmrTodas: media(resp), tmrApos1: media(respApos1), tmrUltTodas: media(respU), tmrUltApos1: media(respUApos1), tmrMedUlt: mediana(respUApos1)
    };
    conv.push({
      'ID da sessão': s.id, 'Data do início da sessão': brHora(s.creationTime), 'Nome do operador': nomeAg, 'Fila': fila, 'Tipificação': tip,
      'Quantidade de Respostas': np, 'Tempo médio de resposta': arred(c.tmrMedUlt, 0), 'Espera em Fila': null, 'Espera por operador': null,
      'Conversa com operador': arred(c.co2, 0), 'Total de conversa': arred(c.tt, 0), 'Operador saiu': 0, 'Usuário saiu': 0,
      'dashboardDownload.header.agentTimeout': 0, 'dashboardDownload.header.userTimeout': 0, 'Transferências realizadas': tr,
      __nps: v.nps, __c: c, __d: diaLoc(s.creationTime), __ag: idAg
    });
  }
  return { sess, conv };
}

/* ------------------------------------------------------------ produtividade (auditorias, 1 chamada por minuto) ------------------------------------------------------------ */
// as auditorias só aceitam 1 consulta por minuto: no uso normal busca só hoje (e ontem até as 02h, para fechar o último trecho do dia)
function janelaProd() {
  if (process.env.DE) return T0;
  const agora = Date.now(), hoje0 = new Date(new Date(agora + TZ).setUTCHours(0, 0, 0, 0) - TZ).getTime(), h = loc(new Date(agora).toISOString()).getUTCHours();
  return new Date(Math.max(ms(T0), hoje0 - (h < 2 ? 864e5 : 0))).toISOString();
}
async function produtividade(get, un, agentes) {
  const ev = new Map(), P0 = janelaProd();
  for (const sec of ['agent-login', 'agent']) {
    await paginas(get, `/audits/${sec}?from=${enc(P0)}&to=${enc(T1)}&limit=500`, it => {
      for (const a of it) {
        const c = a.change || {}, st = c.AVAILABLE_STATUS, quando = c.LAST_STATUS_CHANGE || a.creationTime;
        if (!st || !quando) continue;
        const email = (c.EMAIL || a.authorEmail || '').toLowerCase(), nome = c.NAME || a.authorName || email;
        ev.set(email + '|' + quando + '|' + st, { email, nome, st: String(st).toLowerCase(), t: ms(quando) });
      }
    }, { minuto: true });
    await esp(1000);
  }
  const por = new Map();
  for (const e of ev.values()) { if (!por.has(e.email)) por.set(e.email, []); por.get(e.email).push(e) }
  const out = [], fim = ms(T1);
  for (const [email, l] of por) {
    l.sort((a, b) => a.t - b.t);
    for (let i = 0; i < l.length; i++) {
      const e = l[i], t0 = Math.max(e.t, ms(P0)), t1 = i + 1 < l.length ? l[i + 1].t : fim;
      if (e.st === 'offline' || t1 <= t0) continue;
      const iso0 = new Date(t0).toISOString(), iso1 = new Date(t1).toISOString();
      out.push({ 'Atendente': e.nome, 'E-mail': email, 'Status': STATUS[e.st] || e.st, 'Checkin': brHora(iso0), 'Checkout': brHora(iso1), 'Duração (min)': arred((t1 - t0) / 6e4, 2), 'Fila': '' });
    }
  }
  return out;
}

/* ------------------------------------------------------------ por atendente (a partir das conversas da janela) ------------------------------------------------------------ */
function porAtendente(un, conv) {
  const g = new Map();
  for (const c of conv) {
    const k = c['Nome do operador'] + '|' + c['Fila'];
    if (!g.has(k)) g.set(k, { o: c['Nome do operador'], q: c['Fila'], n: 0, r: 0, tmr: [], nps: [], tr: 0, co: [] });
    const x = g.get(k); x.n++; x.r += c['Quantidade de Respostas'] || 0; x.tr += c['Transferências realizadas'] || 0;
    if (c['Tempo médio de resposta'] != null) x.tmr.push(c['Tempo médio de resposta']);
    if (c['Conversa com operador'] != null) x.co.push(c['Conversa com operador']);
    const n = parseFloat(String(c.__nps ?? '').match(/\d+/)?.[0]); if (n >= 1 && n <= 5) x.nps.push(n);
  }
  return [...g.values()].map(x => ({ 'Atendente': x.o, 'Fila': x.q, 'Conversas fechadas': x.n, 'Quantidade de respostas': x.r, 'Tempo médio de resposta': arred(media(x.tmr), 0), 'NPS': arred(media(x.nps), 2), 'Transferências recebidas': 0, 'Transferências realizadas': x.tr, 'Atendente saiu': 0, 'Usuário saiu': 0, 'Conversa com atendente': arred(media(x.co), 0) }));
}

/* ------------------------------------------------------------ validação: só números agregados ------------------------------------------------------------ */
function resumo(r) {
  const dias = {};
  const d = x => dias[x] ??= { sessoes: 0, comOperador: 0, prod_linhas: 0, prod_min: {}, filas: {}, operadores: {}, tip: {}, c: { co1: [], co2: [], tt: [], eoUser: [], efBot: [], tmrTodas: [], tmrApos1: [], esperaInicio: [], esperaFila1: [], esperaUser1: [], respPrimeira: [], tmrUltTodas: [], tmrUltApos1: [], tmrMedUlt: [] }, r: [], tr: 0 };
  for (const s of r.sess) d(s['Data da sessão'].split('/').reverse().join('-')).sessoes++;
  for (const c of r.conv) {
    const x = d(c.__d); x.comOperador++; x.filas[c.Fila] = (x.filas[c.Fila] || 0) + 1; x.operadores[c['Nome do operador']] = (x.operadores[c['Nome do operador']] || 0) + 1;
    x.tip[c['Tipificação'] || '(nulo)'] = (x.tip[c['Tipificação'] || '(nulo)'] || 0) + 1; x.r.push(c['Quantidade de Respostas']); x.tr += c['Transferências realizadas'];
    for (const k in x.c) if (c.__c[k] != null && isFinite(c.__c[k])) x.c[k].push(c.__c[k]);
  }
  for (const p of r.prod) { const x = d(p.Checkin.slice(0, 10).split('/').reverse().join('-')); x.prod_linhas++; x.prod_min[p.Status] = arred((x.prod_min[p.Status] || 0) + p['Duração (min)'], 1) }
  const top = (o, n = 12) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));
  return Object.fromEntries(Object.entries(dias).sort().map(([k, x]) => [k, {
    sessoes: x.sessoes, comOperador: x.comOperador, respostas_media: arred(media(x.r), 2), transferencias: x.tr, prod_linhas: x.prod_linhas, prod_min: x.prod_min,
    filas: top(x.filas), operadores: top(x.operadores, 15), tipificacao: top(x.tip),
    candidatos_seg: Object.fromEntries(Object.entries(x.c).map(([c, a]) => [c, { n: a.length, p25: arred(pct(a, .25), 0), mediana: arred(mediana(a), 0), p75: arred(pct(a, .75), 0), media: arred(media(a), 0) }]))
  }]));
}

/* ------------------------------------------------------------ envio ao servidor ------------------------------------------------------------ */
let reportar = async () => { }, srv = null;
const etapas = {};
function avanco(un, pct, texto) { etapas[un] = pct; const v = Object.values(etapas), m = v.reduce((a, b) => a + b, 0) / Math.max(1, CONTAS.length); return reportar('lendo', texto, Math.round(5 + m * 0.7)) }
async function conectar() {
  const API = process.env.SERVIDOR_URL, usuario = process.env.INTEGRACAO_USUARIO, senha = process.env.INTEGRACAO_SENHA;
  if (!API || !usuario || !senha) throw new Error('Faltam SERVIDOR_URL, INTEGRACAO_USUARIO e INTEGRACAO_SENHA (secrets do repositório).');
  const j = async (p, o = {}) => { const r = await fetch(API + p, o); const t = await r.text(); let b = null; try { b = JSON.parse(t) } catch (e) { } if (!r.ok) throw new Error(p + ' → ' + r.status + ' ' + (b && b.erro || t.slice(0, 120))); return b ?? t };
  const lg = await j('/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, senha }) });
  const H = { Authorization: 'Bearer ' + lg.token };
  const progresso = (fase, mensagem, pct, extra = {}) => j('/botmaker/progresso', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ fase, mensagem, pct, ...extra }) }).catch(() => { });
  return { j, H, progresso };
}
async function enviar(saida) {
  const { j, H, progresso } = srv;
  const b64 = zlib.gzipSync(Buffer.from(JSON.stringify(saida))).toString('base64'), CH = 600000, rev = Date.now(), de = Math.max(1, Math.ceil(b64.length / CH));
  await progresso('enviando', 'Enviando ' + (b64.length / 1e6).toFixed(1) + ' MB ao servidor…', 80);
  for (let i = 0; i < de; i++) await j(`/arquivo/api-fila?rev=${rev}&n=${i}&de=${de}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'text/plain' }, body: b64.slice(i * CH, (i + 1) * CH) });
  await progresso('pronto', 'Dados novos prontos para importar.', 100, { rev, janela: saida.janela, contagem: saida.contagem });
}

/* ------------------------------------------------------------ principal ------------------------------------------------------------ */
async function principal() {
  console.log('Modo', MODO, 'janela', T0, '→', T1, longo ? '(histórico longo)' : '');
  if (MODO !== 'validar') { srv = await conectar(); reportar = (f, m, p) => srv.progresso(f, m, p); await srv.progresso('lendo', 'Robô lendo a Botmaker…', 5) }
  const rs = [];
  const tarefas = CONTAS.map(c => lerConta(c).then(r => rs.push(r)));
  const falhas = (await Promise.allSettled(tarefas)).filter(x => x.status === 'rejected').map(x => String(x.reason && x.reason.message || x.reason));
  if (MODO === 'validar') {
    const out = { gerado_em: new Date().toISOString(), janela: [T0, T1], falhas, status_contatos: Object.fromEntries(rs.map(r => [r.un, r.cob])), contas: Object.fromEntries(rs.map(r => [r.un, resumo(r)])) };
    fs.mkdirSync('servidor/botmaker/resultado', { recursive: true });
    fs.writeFileSync('servidor/botmaker/resultado/validacao.json', JSON.stringify(out, null, 1));
    console.log('validação gravada');
  } else {
    if (!rs.length) throw new Error(falhas.join(' | ') || 'Nenhuma universidade foi lida.');
    const clean = a => a.map(o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('__'))));
    const saida = { gerado_em: new Date().toISOString(), janela: [T0, T1], falhas, contas: Object.fromEntries(rs.map(r => [r.un, { sess: clean(r.sess), conv: clean(r.conv), prod: r.prod, agente: r.agente, st: r.st, cob: r.cob }])) };
    saida.contagem = Object.fromEntries(rs.map(r => [r.un, { sess: r.sess.length, conv: r.conv.length, prod: r.prod.length }]));
    await enviar(saida);
    console.log('enviado', JSON.stringify(saida.contagem));
  }
  if (falhas.length) { console.error('Falhas:', falhas.join(' | ')); if (srv && !rs.length) await srv.progresso('erro', falhas.join(' | ').slice(0, 250), 0); process.exitCode = 1 }
}
principal().catch(async e => { console.error(e); try { if (srv) await srv.progresso('erro', String(e.message || e).slice(0, 250), 0) } catch (x) { } process.exit(1) });
