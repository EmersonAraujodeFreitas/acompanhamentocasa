import { DatabaseSync } from 'node:sqlite';
import W from '../worker-unico.mjs';
const db = new DatabaseSync(':memory:');
const stmt = (sql, p=[]) => ({ bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...p) || null,
  all: async () => ({ results: db.prepare(sql).all(...p) }),
  run: async () => { db.prepare(sql).run(...p); return {}; }, _s: sql, _p: p });
const DB = { prepare: s => stmt(s), batch: async list => { db.exec('BEGIN'); try { for (const s of list) db.prepare(s._s).run(...s._p); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return []; } };
const O = 'https://emersonaraujodefreitas.github.io';
const env = { CHAVE_ACESSO:'k'.repeat(40), HUBSPOT_TOKEN:'tok', DB, SEGREDO_SESSAO: 'x'.repeat(48), PIMENTA: 'y'.repeat(48), ORIGENS: O };
let ok = 0, bad = 0;
const chk = (n, c) => { c ? ok++ : (bad++, console.log('FALHOU:', n)); };
async function call(m, path, body, tok, raw) {
  const r = await W.fetch(new Request('https://w.test' + path, { method: m, headers: { Origin: O, ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) }), env);
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { __t: t }; } return { s: r.status, j, h: r.headers };
}
let r = await call('GET', '/saude'); chk('saude ok', r.j.ok === true && r.j.tabelas.length === 6);
const bare = await W.fetch(new Request('https://w.test/saude'), { }); const bj = await bare.json(); chk('saude sem config lista problemas', bj.problemas.length >= 3);
r = await call('POST', '/entrar', { usuario: 'emerson', senha: '12345678' }); chk('admin entra', r.s === 200 && r.j.usuario.trocarSenha);
let adm = r.j.token;
r = await call('GET', '/estado', undefined, adm); chk('bloqueado até trocar senha', r.s === 403);
r = await call('POST', '/trocar-senha', { atual: '12345678', nova: '1234' }, adm); chk('senha curta recusada', r.s === 400);
r = await call('POST', '/trocar-senha', { atual: '12345678', nova: 'SenhaForte#1' }, adm); chk('troca ok', r.s === 200); const novo = r.j.token;
r = await call('GET', '/estado', undefined, adm); chk('token antigo derrubado', r.s === 401);
adm = novo; r = await call('GET', '/estado', undefined, adm); chk('estado admin', r.s === 200 && r.j.permissoes.abas.length > 10);
for (const [u, p] of [['leitor1', 'Leitura'], ['edit1', 'Editor']]) { r = await call('POST', '/admin/usuarios', { usuario: u, nome: u, perfil: p, senha: 'provisoria1' }, adm); chk('cria ' + u, r.s === 200); }
const login = async (u, s) => (await call('POST', '/entrar', { usuario: u, senha: s }));
let L = await login('leitor1', 'provisoria1'); chk('leitor deve trocar', L.j.usuario.trocarSenha);
r = await call('POST', '/trocar-senha', { atual: 'provisoria1', nova: 'LeitorSenha1' }, L.j.token); const lt = r.j.token;
let E = await login('edit1', 'provisoria1'); r = await call('POST', '/trocar-senha', { atual: 'provisoria1', nova: 'EditorSenha1' }, E.j.token); const et = r.j.token;
// gravar arquivos
const up = async (tok, nome, txt, rev) => { const parts = []; for (let i = 0; i < txt.length; i += 600000) parts.push(txt.slice(i, i + 600000)); let x; for (let i = 0; i < parts.length; i++) x = await call('PUT', `/arquivo/${nome}?rev=${rev}&n=${i}&de=${parts.length}`, parts[i], tok, true); return x; };
r = await up(lt, 'data', 'abc', 1); chk('leitor NÃO grava data', r.s === 403);
r = await up(lt, 'olos', 'abc', 1); chk('leitor NÃO grava olos', r.s === 403);
r = await call('DELETE', '/arquivo/data', undefined, lt); chk('leitor NÃO apaga', r.s === 403);
r = await call('GET', '/admin/usuarios', undefined, lt); chk('leitor NÃO usa admin', r.s === 403);
r = await call('POST', '/admin/usuarios', { usuario: 'x1x', perfil: 'Administrador', senha: 'abcdefgh1' }, lt); chk('leitor NÃO cria admin', r.s === 403);
r = await call('PUT', '/admin/permissoes', { perfis: {} }, et); chk('editor NÃO muda permissões', r.s === 403);
const grande = 'Z'.repeat(1500000);
r = await up(et, 'data', grande, 1); chk('editor grava data em 3 partes', r.s === 200 && r.j.rev === 1);
r = await up(et, 'data', 'velha', 1); chk('rev repetida recusada', r.s === 409);
r = await up(et, 'olos', 'OLOS1', 1); chk('editor grava olos', r.s === 200);
r = await call('GET', '/arquivo/data', undefined, lt); chk('leitor lê data completo', r.s === 200 && r.j.__t === grande);
r = await call('PUT', '/arquivo/..%2Fx?rev=2&n=0&de=1', 'a', et, true); chk('nome inválido', r.s === 404);
r = await call('GET', '/arquivo/usuarios', undefined, adm); chk('tabela não é arquivo', r.s === 404);
// permissões editáveis: tira 'olos' do leitor
r = await call('GET', '/estado', undefined, lt); chk('leitor vê olos', r.j.arquivos.olos && r.j.pode.olos.ler);
r = await call('PUT', '/admin/permissoes', { perfis: { Leitura: { abas: ['exec', 'uni'], botoes: [] }, Editor: { abas: ['exec', 'olos', 'data'], botoes: ['importar', 'publicar'] } } }, adm); chk('admin salva perm', r.s === 200);
r = await call('GET', '/arquivo/olos', undefined, lt); chk('leitor sem guia olos => 403', r.s === 403);
r = await call('GET', '/arquivo/data', undefined, lt); chk('leitor com exec lê data', r.s === 200);
r = await call('GET', '/estado', undefined, lt); chk('estado do leitor sem olos', !r.j.arquivos.olos && !!r.j.arquivos.data && r.j.versao > 0);
r = await up(et, 'st_abc', 'x', 1); chk('editor sem guia stat não grava st_abc', r.s === 403);
r = await call('DELETE', '/arquivo/olos', undefined, et); chk('editor sem botão remover não apaga', r.s === 403);
// bloqueio 5 erros
for (let i = 0; i < 5; i++) await login('edit1', 'errada' + i);
r = await login('edit1', 'EditorSenha1'); chk('bloqueado após 5 erros', r.s === 429);
r = await call('PATCH', '/admin/usuarios/EDIT1', { desbloquear: true }, adm); r = await login('edit1', 'EditorSenha1'); chk('desbloqueado', r.s === 200);
// derrubar sessão ao desativar
const e2 = r.j.token; r = await call('GET', '/estado', undefined, e2); chk('editor ok', r.s === 200);
await call('PATCH', '/admin/usuarios/EDIT1', { ativo: false }, adm); r = await call('GET', '/estado', undefined, e2); chk('desativado cai', r.s === 401);
r = await login('edit1', 'EditorSenha1'); chk('desativado não entra', r.s === 401);
await call('PATCH', '/admin/usuarios/EDIT1', { ativo: true }, adm);
r = await call('PATCH', '/admin/usuarios/LEITOR1', { perfil: 'Editor' }, adm); r = await call('GET', '/estado', undefined, lt); chk('troca de perfil derruba sessão', r.s === 401);
r = await call('DELETE', '/admin/usuarios/EMERSON', undefined, adm); chk('admin não se exclui', r.s === 400);
r = await call('DELETE', '/admin/usuarios/LEITOR1', undefined, adm); chk('exclui usuário', r.s === 200);
r = await call('POST', '/admin/publicar', {}, adm); chk('publicar agora', r.s === 200 && r.j.versao > 0);
r = await call('GET', '/admin/log', undefined, adm); chk('log', r.j.log.length > 10 && r.j.log.some(x => x.acao === 'gravar-recusado'));
// token forjado / sem token / origem
r = await call('GET', '/estado'); chk('sem token 401', r.s === 401);
r = await call('GET', '/estado', undefined, adm.slice(0, -3) + 'abc'); chk('token adulterado', r.s === 401);
const ro = await W.fetch(new Request('https://w.test/estado', { headers: { Origin: 'https://evil.com' } }), env); chk('origem estranha 403', ro.status === 403);

globalThis.fetch = async (u, o) => { globalThis.__ult = { u: String(u), a: o && o.headers && o.headers.Authorization }; return new Response(JSON.stringify({ results: [], total: 0 }), { status: 200 }); };
r = await call('GET', '/contar'); chk('hubspot sem sessão => 401', r.s === 401); r = await call('GET', '/campos', undefined, 'k'.repeat(40)); chk('chave antiga ainda passa (transição)', r.s !== 401 && r.s !== 403); env.ACEITAR_CHAVE_ANTIGA = 'nao'; r = await call('GET', '/campos', undefined, 'k'.repeat(40)); chk('chave antiga recusada quando desligada', r.s === 401); delete env.ACEITAR_CHAVE_ANTIGA;
r = await call('GET', '/campos', undefined, 'abc.def'); chk('hubspot token falso => 401', r.s === 401);
r = await call('GET', '/campos', undefined, adm); chk('hubspot com sessão admin passa', r.s !== 401 && r.s !== 403 && r.s !== 404);
r = await call('PUT', '/admin/permissoes', { perfis: { Leitura: { abas: ['exec'], botoes: [] }, Editor: { abas: ['exec', 'olos'], botoes: [] } } }, adm);
let L2 = await login('edit1', 'EditorSenha1'); const e3 = L2.j.token;
r = await call('GET', '/campos', undefined, e3); chk('editor com guia olos usa hubspot', r.s !== 401 && r.s !== 403);
await call('PUT', '/admin/permissoes', { perfis: { Editor: { abas: ['exec'], botoes: [] } } }, adm);
r = await call('GET', '/campos', undefined, e3); chk('perfil sem guias olos/hubspot => 403', r.s === 403);
r = await call('GET', '/rota-que-nao-existe', undefined, adm); chk('rota inexistente 404', r.s === 404);
const op = await W.fetch(new Request('https://w.test/campos', { method: 'OPTIONS', headers: { Origin: O } }), env); chk('preflight ok', op.status === 204 && /PUT/.test(op.headers.get('Access-Control-Allow-Methods')));

// ambientes por usuário
await call('PUT', '/admin/permissoes', { perfis: { Leitura: { abas: ['exec', 'olos', 'hubspot', 'buscar'], botoes: [] }, Editor: { abas: ['exec'], botoes: [] } } }, adm);
r = await call('POST', '/admin/usuarios', { usuario: 'elinai', nome: 'Elinai', perfil: 'Leitura', senha: 'provisoria1', ambientes: ['h', 's'] }, adm); chk('cria usuário com ambientes', r.s === 200);
let EL = await login('elinai', 'provisoria1'); r = await call('POST', '/trocar-senha', { atual: 'provisoria1', nova: 'ElinaiSenha1' }, EL.j.token); const elt = r.j.token;
r = await call('GET', '/estado', undefined, elt); chk('ambientes h/s: sem guias do Botmaker', !r.j.permissoes.abas.includes('exec') && r.j.permissoes.abas.includes('hubspot') && r.j.usuario.ambientes.join() === 'h,s');
r = await call('GET', '/arquivo/data', undefined, elt); chk('elinai NÃO lê dados do Botmaker', r.s === 403);
r = await call('GET', '/arquivo/olos', undefined, elt); chk('elinai lê olos', r.s === 200);
r = await call('GET', '/campos', undefined, elt); chk('elinai usa HubSpot', r.s !== 401 && r.s !== 403);
await call('POST', '/admin/usuarios', { usuario: 'admuj', nome: 'Admuj', perfil: 'Administrador', senha: 'provisoria1', ambientes: ['b'] }, adm);
let AJ = await login('admuj', 'provisoria1'); r = await call('POST', '/trocar-senha', { atual: 'provisoria1', nova: 'AdmujSenha1' }, AJ.j.token); const ajt = r.j.token;
r = await call('GET', '/arquivo/olos', undefined, ajt); chk('admin restrito ao Botmaker NÃO lê olos', r.s === 403);
r = await call('GET', '/arquivo/data', undefined, ajt); chk('admin restrito lê data', r.s === 200);
r = await call('GET', '/admin/usuarios', undefined, ajt); chk('admin restrito ainda administra', r.s === 200);
r = await call('PATCH', '/admin/usuarios/ELINAI', { ambientes: null }, adm); r = await call('GET', '/estado', undefined, elt); chk('mudar ambientes derruba sessão', r.s === 401);
// atualização pela API da Botmaker
await call('PUT', '/admin/permissoes', { perfis: { Leitura: { abas: ['exec', 'sess'], botoes: [] }, Editor: { abas: ['exec', 'sess', 'data'], botoes: ['importar', 'publicar'] } } }, adm);
const novoUsuario = async (u, perfil, senha) => { await call('POST', '/admin/usuarios', { usuario: u, nome: u, perfil, senha: 'provisoria1' }, adm); const l = await login(u, 'provisoria1'); return (await call('POST', '/trocar-senha', { atual: 'provisoria1', nova: senha }, l.j.token)).j.token; };
const ea = await novoUsuario('api-ed', 'Editor', 'EditorApi123'), la = await novoUsuario('api-le', 'Leitura', 'LeitorApi123');
r = await call('GET', '/botmaker/estado', undefined, ea); chk('estado api (editor)', r.s === 200 && r.j.fase === 'ocioso' && r.j.configurado === false);
r = await call('POST', '/botmaker/atualizar', { dias: 2 }, ea); chk('sem GH_TOKEN: 503', r.s === 503);
r = await call('GET', '/botmaker/estado', undefined, la); chk('leitor NÃO vê estado api', r.s === 403);
env.GH_TOKEN = 'ghp_teste'; env.GH_REPO = 'EmersonAraujodeFreitas/acompanhamentocasa';
const f0 = globalThis.fetch; let chamadas = [];
globalThis.fetch = async (u, o) => { chamadas.push([String(u), o]); return new Response(null, { status: 204 }); };
r = await call('POST', '/botmaker/atualizar', { dias: 999 }, la); chk('leitor NÃO dispara robô', r.s === 403 && chamadas.length === 0);
r = await call('POST', '/botmaker/atualizar', { dias: 999 }, ea);
chk('editor dispara robô (dias limitado a 60)', r.s === 200 && r.j.fase === 'iniciado' && chamadas.length === 1 && /botmaker-sync\.yml\/dispatches$/.test(chamadas[0][0]) && JSON.parse(chamadas[0][1].body).inputs.dias === '60' && chamadas[0][1].headers.Authorization === 'Bearer ghp_teste');
r = await call('POST', '/botmaker/atualizar', { dias: 2 }, ea); chk('segunda chamada seguida: 409', r.s === 409 && chamadas.length === 1);
r = await call('POST', '/botmaker/progresso', { fase: 'pronto', mensagem: 'ok', pct: 100, rev: 5, contagem: { UJ: { sess: 3 } } }, la); chk('leitor NÃO informa progresso', r.s === 403);
r = await call('POST', '/botmaker/progresso', { fase: 'pronto', mensagem: 'ok', pct: 100, rev: 5, contagem: { UJ: { sess: 3 } } }, ea); chk('progresso ok', r.s === 200);
r = await call('GET', '/botmaker/estado', undefined, ea); chk('estado pronto', r.j.fase === 'pronto' && r.j.rev === 5 && r.j.configurado === true);
globalThis.fetch = async () => new Response(null, { status: 401 });
r = await call('POST', '/botmaker/progresso', { fase: 'importado', pct: 100 }, ea); r = await call('POST', '/botmaker/atualizar', {}, ea); chk('GitHub recusa token: 502', r.s === 502);
globalThis.fetch = f0;
r = await up(ea, 'api-fila', 'dados-do-robo', 7); chk('editor grava api-fila', r.s === 200);
r = await up(la, 'api-fila', 'x', 8); chk('leitor NÃO grava api-fila', r.s === 403);
r = await call('GET', '/arquivo/api-fila', undefined, la); chk('leitor NÃO lê api-fila', r.s === 403);
// robô que falha antes de avisar: o servidor consulta o GitHub e mostra o erro
globalThis.fetch = async (u) => String(u).includes('/dispatches') ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ workflow_runs: [{ created_at: new Date(Date.now() + 5000).toISOString(), status: 'completed', conclusion: 'failure' }] }), { status: 200 });
await call('POST', '/botmaker/progresso', { fase: 'importado', pct: 100 }, ea);
r = await call('POST', '/botmaker/atualizar', { dias: 2 }, ea); chk('inicia de novo', r.s === 200);
r = await call('GET', '/botmaker/estado', undefined, ea); chk('falha no GitHub vira erro explicado', r.j.fase === 'erro' && /secrets/.test(r.j.mensagem));
r = await call('POST', '/botmaker/atualizar', { dias: 2 }, ea); chk('depois do erro dá para tentar de novo', r.s === 200);
globalThis.fetch = async () => new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 });
await db.exec("UPDATE valores SET dados = json_set(dados, '$.em', '2020-01-01T00:00:00.000Z') WHERE chave = 'api:estado'");
r = await call('GET', '/botmaker/estado', undefined, ea); chk('robô parado há mais de 30 min vira erro', r.j.fase === 'erro' && /30 minutos/.test(r.j.mensagem));
await call('POST', '/botmaker/progresso', { fase: 'importado', pct: 100 }, ea);
r = await call('POST', '/botmaker/atualizar', { de: '2026-01-01', ate: '2026-12-31' }, ea); chk('período maior que 35 dias recusado', r.s === 400);
r = await call('POST', '/botmaker/atualizar', { de: '2026-03-01', ate: '2026-02-01' }, ea); chk('datas invertidas recusadas', r.s === 400);
r = await call('POST', '/botmaker/atualizar', { de: '2026-10-01' }, ea); chk('só uma data recusada', r.s === 400);
chamadas.length = 0;
globalThis.fetch = async (u, o) => { chamadas.push([String(u), o]); return new Response(null, { status: 204 }); };
r = await call('POST', '/botmaker/atualizar', { de: '2026-01-01', ate: '2026-01-31', produtividade: false }, ea);
chk('mês fechado dispara o robô com de/ate', r.s === 200 && chamadas.length === 1 && JSON.parse(chamadas[0][1].body).inputs?.de === '2026-01-01');
globalThis.fetch = f0;
console.log(`ok=${ok} falhas=${bad}`);
