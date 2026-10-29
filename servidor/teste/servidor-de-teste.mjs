import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import W from './worker.mjs';
const db = new DatabaseSync(':memory:');
const stmt = (sql, p=[]) => ({ bind: (...a) => stmt(sql, a), first: async () => db.prepare(sql).get(...p) || null, all: async () => ({ results: db.prepare(sql).all(...p) }), run: async () => { db.prepare(sql).run(...p); return {}; }, _s: sql, _p: p });
const DB = { prepare: s => stmt(s), batch: async list => { db.exec('BEGIN'); try { for (const s of list) db.prepare(s._s).run(...s._p); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return []; } };
const O = 'http://localhost:8000';
const env = { DB, SEGREDO_SESSAO: 'x'.repeat(48), PIMENTA: 'y'.repeat(48), ORIGENS: O, CHAVE_ACESSO: 'k'.repeat(40), HUBSPOT_TOKEN: 't' };
const call = async (m, p, body, tok) => { const r = await W.fetch(new Request('http://x' + p, { method: m, headers: { Origin: O, ...(tok ? { Authorization: 'Bearer ' + tok } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env); return { s: r.status, j: await r.json().catch(() => ({})) }; };
// semente
let r = await call('POST', '/entrar', { usuario: 'EMERSON', senha: '12345678' });
r = await call('POST', '/trocar-senha', { atual: '12345678', nova: 'Admin#12345' }, r.j.token); const adm = r.j.token;
await call('POST', '/admin/usuarios', { usuario: 'leitor1', nome: 'Leitor Um', perfil: 'Leitura', senha: 'provisoria1' }, adm);
await call('POST', '/admin/usuarios', { usuario: 'editor1', nome: 'Editor Um', perfil: 'Editor', senha: 'provisoria1' }, adm);
const D = fs.readFileSync('/tmp/w/D.json'); const b64 = zlib.gzipSync(D).toString('base64');
for (let i = 0, n = Math.ceil(b64.length / 600000); i < n; i++) { const x = await W.fetch(new Request(`http://x/arquivo/data?rev=1&n=${i}&de=${n}`, { method: 'PUT', headers: { Origin: O, Authorization: 'Bearer ' + adm }, body: b64.slice(i * 600000, (i + 1) * 600000) }), env); if (!x.ok) console.log('semente falhou', await x.text()); }
http.createServer(async (q, s) => { const ch = []; for await (const c of q) ch.push(c); const body = Buffer.concat(ch);
  const h = {}; for (const [k, v] of Object.entries(q.headers)) h[k] = v;
  const rr = await W.fetch(new Request('http://localhost:8787' + q.url, { method: q.method, headers: h, body: ['GET', 'HEAD', 'OPTIONS'].includes(q.method) ? undefined : body }), env);
  const hh = {}; rr.headers.forEach((v, k) => hh[k] = v); s.writeHead(rr.status, hh); s.end(Buffer.from(await rr.arrayBuffer())); }).listen(8787, () => console.log('pronto'));
