// Explora a API da Botmaker e grava SÓ A ESTRUTURA (nomes e tipos dos campos). Nenhum valor/conteúdo de cliente é salvo.
import fs from 'node:fs';
const BASE = 'https://api.botmaker.com/v2.0';
const CONTAS = [['UVA', process.env.BOTMAKER_TOKEN_UVA], ['UJ', process.env.BOTMAKER_TOKEN_UJ]].filter(c => c[1]);
const CAMINHOS = ['chats', 'chats-actions', 'channels', 'agents', 'roles', 'calls', 'billing', 'whatsapp-accounts', 'whatsapp-templates', 'intents', 'contacts', 'audits', 'webhooks', 'dashboards', 'attention-queues', 'tickets', 'notifications', 'messages', 'sessions', 'customers'];
const SPECS = ['https://go.botmaker.com/apidocs/swagger.json', 'https://go.botmaker.com/apidocs/swagger.yaml', 'https://api.botmaker.com/v2.0/swagger.json', 'https://api.botmaker.com/swagger.json', 'https://api.botmaker.com/v2.0/docs/swagger.json', 'https://api.botmaker.com/v2.0/api-docs'];
const tipo = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
function esquema(v, prof = 0) {
  if (Array.isArray(v)) return { _t: 'array', n: v.length, item: v.length ? esquema(v[0], prof + 1) : null };
  if (v && typeof v === 'object') { if (prof > 5) return { _t: 'object' }; const o = {}; for (const k of Object.keys(v).slice(0, 80)) o[k] = esquema(v[k], prof + 1); return o; }
  return tipo(v);
}
const dias = n => new Date(Date.now() - n * 864e5).toISOString();
const saida = { gerado_em: new Date().toISOString(), contas: {} };
for (const [conta, token] of CONTAS) {
  const r = saida.contas[conta] = { endpoints: {}, specs: {} };
  const H = { 'access-token': token, Accept: 'application/json' };
  for (const u of SPECS) { try { const x = await fetch(u, { headers: H }); const t = await x.text(); let paths = null; try { const j = JSON.parse(t); paths = Object.fromEntries(Object.entries(j.paths || {}).map(([p, m]) => [p, Object.fromEntries(Object.entries(m).map(([mm, d]) => [mm, { resumo: d.summary || '', params: (d.parameters || []).map(q => q.name + (q.required ? '*' : '') + ':' + (q.in || '')) }]))])); } catch (e) { } r.specs[u] = { status: x.status, paths }; } catch (e) { r.specs[u] = { erro: String(e.message).slice(0, 100) }; } }
  for (const c of CAMINHOS) {
    for (const q of ['?limit=3', '?from=' + encodeURIComponent(dias(2)) + '&to=' + encodeURIComponent(dias(0)) + '&limit=3', '']) {
      try {
        const x = await fetch(BASE + '/' + c + q, { headers: H }); const t = await x.text(); let j = null; try { j = JSON.parse(t) } catch (e) { }
        const e = { status: x.status, query: q.replace(/=[^&]*/g, '=…') };
        if (j && x.ok) { e.esquema = esquema(j); r.endpoints[c] = e; break }
        e.erro = j && (j.message || j.error) ? String(j.message || j.error).slice(0, 200) : t.slice(0, 120).replace(/[0-9]{6,}/g, '#');
        r.endpoints[c] = e;
      } catch (e) { r.endpoints[c] = { erro: String(e.message).slice(0, 100) } }
    }
  }
}
fs.mkdirSync('servidor/botmaker/resultado', { recursive: true });
fs.writeFileSync('servidor/botmaker/resultado/esquema.json', JSON.stringify(saida, null, 1));
console.log('contas:', CONTAS.map(c => c[0]).join(', ') || 'NENHUMA (faltam os secrets)');
for (const [c, r] of Object.entries(saida.contas)) console.log(c, Object.entries(r.endpoints).map(([k, v]) => k + ':' + v.status).join(' '));
