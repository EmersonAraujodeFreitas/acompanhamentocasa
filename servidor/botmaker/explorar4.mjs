// 4ª leitura: parâmetros de data das mensagens, sessões com mensagens, auditorias (1 chamada/min). Sem conteúdo de clientes.
import fs from 'node:fs';
const BASE = 'https://api.botmaker.com/v2.0';
const CONTAS = [['UVA', process.env.BOTMAKER_TOKEN_UVA], ['UJ', process.env.BOTMAKER_TOKEN_UJ]].filter(c => c[1]);
const dia = (n, h = 0) => { const d = new Date(Date.now() - n * 864e5); d.setUTCHours(h, 0, 0, 0); return d.toISOString() };
const esp = ms => new Promise(r => setTimeout(r, ms));
const enc = encodeURIComponent;
const tipo = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
function esquema(v, p = 0) { if (Array.isArray(v)) return { _t: 'array', n: v.length, item: v.length ? esquema(v[0], p + 1) : null }; if (v && typeof v === 'object') { if (p > 4) return 'object'; const o = {}; for (const k of Object.keys(v).slice(0, 60)) o[k] = esquema(v[k], p + 1); return o } return tipo(v) }
const faixa = it => it && it.length ? [it[0].creationTime || it[0].date || it[0].timestamp || null, it[it.length - 1].creationTime || it[it.length - 1].date || it[it.length - 1].timestamp || null] : null;
const T0 = dia(3), T1 = dia(2);
async function conta([nome, token]) {
  const H = { 'access-token': token, Accept: 'application/json' }, r = {};
  const get = async (p) => { for (let i = 0; i < 4; i++) { await esp(500); try { const x = await fetch(BASE + p, { headers: H }); const t = await x.text(); if (x.status == 429 && !/minute/.test(t)) { await esp(2000); continue } let j = null; try { j = JSON.parse(t) } catch (e) { } return { status: x.status, j, texto: j ? '' : t.slice(0, 200) } } catch (e) { return { status: 0, j: null, texto: String(e.message).slice(0, 100) } } } return { status: 429, j: null, texto: 'limite' } };
  // mensagens: nomes de parâmetros
  r.mensagens = {};
  for (const q of [`?from=${enc(T0)}&to=${enc(T1)}&limit=50`, `?fromDate=${enc(T0)}&toDate=${enc(T1)}&limit=50`, `?sessionCreationTimeFrom=${enc(T0)}&limit=50`, `?startDate=${enc(T0)}&endDate=${enc(T1)}&limit=50`, `?creationTimeFrom=${enc(T0)}&creationTimeTo=${enc(T1)}&limit=50`, `?from=${enc(T0)}&limit=50`, `?to=${enc(T1)}&limit=50`, `?start=${enc(T0)}&end=${enc(T1)}&limit=50`]) {
    const b = await get('/messages' + q); const it = b.j && b.j.items || [];
    r.mensagens[q.replace(/=[^&]*/g, m => m.length > 14 ? '=DATA' : m)] = { status: b.status, n: it.length, faixa: faixa(it), erro: b.status >= 400 ? (b.j ? JSON.stringify(b.j).slice(0, 400) : b.texto) : undefined };
  }
  // sessões com mensagens
  { const b = await get(`/sessions?from=${enc(T0)}&to=${enc(T1)}&limit=3&include-messages=true`); const it = b.j && b.j.items || []; r.sessao_com_mensagens = { status: b.status, n: it.length, esquema: it[0] ? esquema(it[0]) : null, erro: b.status >= 400 ? (b.j ? JSON.stringify(b.j).slice(0, 300) : b.texto) : undefined } }
  // sessão individual e chat individual
  { const b = await get(`/sessions?from=${enc(T0)}&to=${enc(T1)}&limit=1`); const s = b.j && b.j.items && b.j.items[0]; if (s) { const i = await get('/sessions/' + enc(s.id)); r.sessao_individual = { status: i.status, esquema: i.j ? esquema(i.j) : i.texto } } }
  // auditorias (1 por minuto)
  r.auditorias = {};
  for (const sec of ['agent-state', 'agent-login', 'typification', 'queue', 'agent']) {
    for (const q of [`?from=${enc(T0)}&to=${enc(T1)}&limit=50`]) {
      let b = await get('/audits/' + sec + q); if (b.status == 429) { await esp(65000); b = await get('/audits/' + sec + q) }
      const it = b.j && (b.j.items || b.j.audits || b.j.results) || []; const campos = b.j ? Object.keys(b.j) : [];
      const valores = {}; if (it[0]) for (const k of Object.keys(it[0])) if (/type|state|status|action|section|event|origin|reason/i.test(k)) { const m = {}; it.forEach(x => { const v = String(x[k]).slice(0, 40); m[v] = (m[v] || 0) + 1 }); valores[k] = Object.fromEntries(Object.entries(m).sort((a, c) => c[1] - a[1]).slice(0, 15)) }
      r.auditorias[sec] = { status: b.status, campos_topo: campos, n: it.length, faixa: faixa(it), esquema_item: it[0] ? esquema(it[0]) : null, valores, erro: b.status >= 400 ? (b.j ? JSON.stringify(b.j).slice(0, 500) : b.texto) : undefined };
      await esp(65000);
    }
  }
  return [nome, r];
}
const out = { gerado_em: new Date().toISOString(), janela: [T0, T1], contas: Object.fromEntries(await Promise.all(CONTAS.map(conta))) };
fs.mkdirSync('servidor/botmaker/resultado', { recursive: true });
fs.writeFileSync('servidor/botmaker/resultado/esquema4.json', JSON.stringify(out, null, 1));
console.log('ok');
