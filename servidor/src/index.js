/* =========================================================
   Central de Indicadores · Inovação Casa — servidor de acesso
   (Cloudflare Worker + banco D1, plano gratuito)

   - Senhas conferidas aqui (PBKDF2 + segredo do servidor); nunca saem do servidor
   - Sessão assinada (HMAC) e conferida no banco a cada pedido
   - Cada perfil só RECEBE os arquivos de dados das guias liberadas
   - Gravar, trocar e apagar são conferidos pela permissão do perfil
   - Bloqueio após 5 senhas erradas (15 min) e registro de acessos

   Variáveis (Settings → Variables and Secrets):
     SEGREDO_SESSAO  (secret) texto aleatório com 40+ caracteres
     PIMENTA         (secret) outro texto aleatório com 40+ caracteres
     ORIGENS         (text)   endereços do site, separados por vírgula
     ADMIN_SENHA_INICIAL (secret, opcional) troca a senha provisória 12345678
   Banco D1 ligado ao Worker com o nome DB
   ========================================================= */

const VERSAO_CODIGO = '2026-10-29-acesso-1';
const PERFIS = ['Leitura', 'Editor', 'Administrador'];
/* guias (páginas do site) e ambientes */
const TODAS_ABAS = ['exec', 'uni', 'sess', 'team', 'a360', 'sla', 'qual', 'prod', 'cap', 'cross', 'rec', 'cons', 'bd', 'data', 'consimp', 'stat', 'olos', 'hubspot', 'buscar'];
/* botões que precisam de permissão */
const TODOS_BOTOES = ['importar', 'remover', 'publicar', 'exportar', 'atualizar', 'parametros', 'logo'];
const PAGINAS_BOTMAKER = ['exec', 'uni', 'sess', 'team', 'a360', 'sla', 'qual', 'prod', 'cap', 'cross', 'rec', 'cons', 'bd', 'data', 'consimp', 'stat'];
const PERM_PADRAO = {
  'Leitura': { abas: ['exec', 'uni', 'sess', 'team', 'a360', 'sla', 'qual', 'prod', 'cap', 'cross', 'rec', 'cons', 'bd', 'olos', 'hubspot', 'buscar'], botoes: ['exportar'] },
  'Editor': { abas: TODAS_ABAS.slice(), botoes: ['importar', 'remover', 'publicar', 'exportar', 'atualizar', 'parametros', 'logo'] }
};
/* arquivos de dados: quem lê (qualquer uma das guias) e quem grava (uma guia E um botão) */
const ARQUIVOS = {
  data: { ler: PAGINAS_BOTMAKER, esc: { abas: ['data', 'consimp', 'stat', 'cons'], botoes: ['importar', 'remover', 'parametros', 'logo', 'publicar'] } },
  olos: { ler: ['olos', 'hubspot', 'buscar'], esc: { abas: ['olos'], botoes: ['importar', 'remover', 'publicar'] } },
  'olos-meta': { ler: ['olos', 'hubspot', 'buscar'], esc: { abas: ['olos'], botoes: ['importar', 'remover', 'publicar'] } },
  jb: { ler: ['olos', 'buscar'], esc: { abas: ['olos'], botoes: ['importar', 'remover', 'publicar'] } },
  rc: { ler: ['rec'], esc: { abas: ['rec', 'data'], botoes: ['importar', 'publicar'] } },
  analise: { ler: ['olos', 'hubspot'], esc: { abas: ['olos', 'hubspot'], botoes: ['atualizar', 'publicar'] } },
  meta: { ler: PAGINAS_BOTMAKER, esc: { abas: ['data', 'consimp', 'stat', 'cons'], botoes: ['importar', 'remover', 'parametros', 'logo', 'publicar'] } }
};
function regraArquivo(nome) {
  if (ARQUIVOS[nome]) return ARQUIVOS[nome];
  if (/^st_[a-z0-9_.-]{1,36}$/.test(nome)) return { ler: ['stat'], esc: { abas: ['stat'], botoes: ['importar', 'publicar'] } };
  return null;
}
/* valores pequenos de configuração entregues por permissão */
const CONFIG = { hskey: { ler: ['olos', 'hubspot', 'buscar'] } };

const ADMIN_INICIAL = { usuario: 'EMERSON', nome: 'Emerson', senha: '12345678' };
const ITERACOES = 10000;
const SESSAO_HORAS = 12, SESSAO_MANTER_DIAS = 30;
const PARTE_MAX = 700000;       /* caracteres por linha no D1 (limite do D1 é 2 MB por linha) */
const ARQUIVO_MAX = 40e6;       /* caracteres por arquivo */

/* ---------------- utilidades ---------------- */
const agora = () => new Date().toISOString();
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const normU = u => String(u || '').trim().toUpperCase();
function igualSeguro(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function hashSenha(env, senha, salHex) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(String(senha)), 'PBKDF2', false, ['deriveBits']);
  const sal = enc.encode(salHex + '|' + (env.PIMENTA || ''));
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITERACOES }, chave, 256));
}
async function hmac(env, texto) {
  if (!env.SEGREDO_SESSAO || env.SEGREDO_SESSAO.length < 20) throw new Erro(500, 'Servidor sem SEGREDO_SESSAO configurado.');
  const k = await crypto.subtle.importKey('raw', enc.encode(env.SEGREDO_SESSAO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
}

/* ---------------- banco ---------------- */
const um = (env, sql, ...p) => env.DB.prepare(sql).bind(...p).first();
const todos = async (env, sql, ...p) => (await env.DB.prepare(sql).bind(...p).all()).results || [];
const exec = (env, sql, ...p) => env.DB.prepare(sql).bind(...p).run();
async function registrar(env, usuario, acao, detalhe) { try { await exec(env, 'INSERT INTO log (quando, usuario, acao, detalhe) VALUES (?,?,?,?)', agora(), usuario || '', acao, String(detalhe || '').slice(0, 300)); } catch (e) { /* o registro é opcional */ } }
async function lerValor(env, chave, padrao) { const r = await um(env, 'SELECT dados FROM valores WHERE chave = ?', chave); return r ? JSON.parse(r.dados) : padrao; }
const SQL_VALOR = 'INSERT INTO valores (chave, dados, atualizado_em, por) VALUES (?,?,?,?) ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em, por = excluded.por';
async function gravarValor(env, chave, dados, por) { await exec(env, SQL_VALOR, chave, JSON.stringify(dados), agora(), por || ''); }
async function versao(env) { return (await lerValor(env, 'versao', 0)) || 0; }
const subirVersaoStmt = (env, ver) => env.DB.prepare(SQL_VALOR).bind('versao', String(ver), agora(), '');

const ESQUEMA = [
  'CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, nome TEXT NOT NULL, perfil TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, sal TEXT NOT NULL, hash TEXT NOT NULL, trocar_senha INTEGER NOT NULL DEFAULT 0, sessao INTEGER NOT NULL DEFAULT 0, criado_em TEXT, atualizado_em TEXT)',
  'CREATE TABLE IF NOT EXISTS arquivos (nome TEXT PRIMARY KEY, rev INTEGER NOT NULL DEFAULT 0, partes INTEGER NOT NULL DEFAULT 0, tamanho INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT, por TEXT)',
  'CREATE TABLE IF NOT EXISTS partes (nome TEXT NOT NULL, rev INTEGER NOT NULL, n INTEGER NOT NULL, dados TEXT NOT NULL, PRIMARY KEY (nome, rev, n))',
  'CREATE TABLE IF NOT EXISTS valores (chave TEXT PRIMARY KEY, dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, por TEXT)',
  'CREATE TABLE IF NOT EXISTS tentativas (usuario TEXT PRIMARY KEY, falhas INTEGER NOT NULL DEFAULT 0, bloqueado_ate TEXT)',
  'CREATE TABLE IF NOT EXISTS log (quando TEXT NOT NULL, usuario TEXT, acao TEXT, detalhe TEXT)',
  'CREATE INDEX IF NOT EXISTS idx_log_quando ON log (quando)'
];
const TABELAS = ['usuarios', 'arquivos', 'partes', 'valores', 'tentativas', 'log'];
let tabelasProntas = false;
async function garantirTabelas(env) {
  if (tabelasProntas || !env.DB) return;
  await env.DB.batch(ESQUEMA.map(sql => env.DB.prepare(sql)));
  tabelasProntas = true;
}
async function garantirAdmin(env) {
  await garantirTabelas(env);
  const n = await um(env, 'SELECT COUNT(*) AS n FROM usuarios');
  if (n && n.n > 0) return;
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  await exec(env, 'INSERT INTO usuarios (usuario, nome, perfil, ativo, sal, hash, trocar_senha, sessao, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ADMIN_INICIAL.usuario, ADMIN_INICIAL.nome, 'Administrador', 1, sal, await hashSenha(env, env.ADMIN_SENHA_INICIAL || ADMIN_INICIAL.senha, sal), 1, 0, agora(), agora());
}

/* ---------------- permissões ---------------- */
async function permissoesDe(env, perfil) {
  if (perfil === 'Administrador') return { abas: TODAS_ABAS.slice(), botoes: TODOS_BOTOES.slice() };
  const perfis = await lerValor(env, 'perfis', {});
  const p = perfis[perfil] || PERM_PADRAO[perfil] || { abas: [], botoes: [] };
  return { abas: (p.abas || []).filter(a => TODAS_ABAS.includes(a)), botoes: (p.botoes || []).filter(b => TODOS_BOTOES.includes(b)) };
}
const podeLer = (u, perm, nome) => { if (u.perfil === 'Administrador') return !!regraArquivo(nome); const r = regraArquivo(nome); return !!r && r.ler.some(a => perm.abas.includes(a)); };
const podeGravar = (u, perm, nome) => {
  if (u.perfil === 'Administrador') return !!regraArquivo(nome);
  const r = regraArquivo(nome); if (!r) return false;
  return r.esc.abas.some(a => perm.abas.includes(a)) && r.esc.botoes.some(b => perm.botoes.includes(b));
};
const podeApagar = (u, perm, nome) => podeGravar(u, perm, nome) && (u.perfil === 'Administrador' || perm.botoes.includes('remover'));

/* ---------------- sessão ---------------- */
async function criarSessao(env, u, manter) {
  const exp = Date.now() + (manter ? SESSAO_MANTER_DIAS * 864e5 : SESSAO_HORAS * 36e5);
  const corpo = b64u(enc.encode(JSON.stringify({ u: u.usuario, s: u.sessao, exp })));
  return corpo + '.' + await hmac(env, corpo);
}
async function autenticar(env, req) {
  const h = req.headers.get('Authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [corpo, sig] = tok.split('.');
  if (!corpo || !sig || !igualSeguro(sig, await hmac(env, corpo))) throw new Erro(401, 'Sessão inválida. Entre novamente.');
  let d; try { d = JSON.parse(new TextDecoder().decode(deb64u(corpo))); } catch (e) { throw new Erro(401, 'Sessão inválida.'); }
  if (!d.exp || d.exp < Date.now()) throw new Erro(401, 'Sessão expirada. Entre novamente.');
  const u = await um(env, 'SELECT usuario, nome, perfil, ativo, sessao, trocar_senha FROM usuarios WHERE usuario = ?', d.u);
  if (!u || !u.ativo || u.sessao !== d.s) throw new Erro(401, 'Acesso encerrado. Entre novamente.');
  return u;
}
const perfilPublico = u => ({ usuario: u.usuario, nome: u.nome, perfil: u.perfil, trocarSenha: !!u.trocar_senha });

/* ---------------- rotas de acesso ---------------- */
async function rotaLogin(env, req) {
  const { usuario, senha, manter } = await req.json();
  const id = normU(usuario);
  if (!id || !senha) throw new Erro(400, 'Informe usuário e senha.');
  const t = await um(env, 'SELECT falhas, bloqueado_ate FROM tentativas WHERE usuario = ?', id);
  if (t && t.bloqueado_ate && t.bloqueado_ate > agora()) throw new Erro(429, 'Muitas tentativas. Tente de novo em alguns minutos.');
  const u = await um(env, 'SELECT * FROM usuarios WHERE usuario = ?', id);
  const ok = u && u.ativo && igualSeguro(await hashSenha(env, senha, u.sal), u.hash);
  if (!ok) {
    const falhas = (t ? t.falhas : 0) + 1;
    await exec(env, 'INSERT INTO tentativas (usuario, falhas, bloqueado_ate) VALUES (?,?,?) ON CONFLICT(usuario) DO UPDATE SET falhas = excluded.falhas, bloqueado_ate = excluded.bloqueado_ate',
      id, falhas >= 5 ? 0 : falhas, falhas >= 5 ? new Date(Date.now() + 15 * 6e4).toISOString() : null);
    await registrar(env, id, falhas >= 5 ? 'bloqueado' : 'login-falhou', '');
    throw new Erro(401, u && !u.ativo ? 'Este usuário está desativado.' : 'Usuário ou senha incorretos.');
  }
  await exec(env, 'DELETE FROM tentativas WHERE usuario = ?', id);
  await registrar(env, id, 'login', '');
  return { token: await criarSessao(env, u, !!manter), usuario: perfilPublico(u), permissoes: await permissoesDe(env, u.perfil) };
}
async function rotaTrocarSenha(env, u, req) {
  const { atual, nova } = await req.json();
  if (!nova || String(nova).length < 8) throw new Erro(400, 'A nova senha precisa ter ao menos 8 caracteres.');
  const r = await um(env, 'SELECT sal, hash FROM usuarios WHERE usuario = ?', u.usuario);
  if (!igualSeguro(await hashSenha(env, atual, r.sal), r.hash)) throw new Erro(400, 'Senha atual incorreta.');
  if (nova === atual) throw new Erro(400, 'A nova senha precisa ser diferente da atual.');
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  await exec(env, 'UPDATE usuarios SET sal = ?, hash = ?, trocar_senha = 0, sessao = sessao + 1, atualizado_em = ? WHERE usuario = ?', sal, await hashSenha(env, nova, sal), agora(), u.usuario);
  await registrar(env, u.usuario, 'trocou-senha', '');
  return { token: await criarSessao(env, await um(env, 'SELECT * FROM usuarios WHERE usuario = ?', u.usuario), true) };
}
/* resumo leve: usado ao entrar e a cada poucos segundos para saber o que mudou (sem baixar dados) */
async function rotaEstado(env, u) {
  const perm = await permissoesDe(env, u.perfil);
  const lista = await todos(env, 'SELECT nome, rev, tamanho, atualizado_em, por FROM arquivos');
  const arquivos = {};
  for (const a of lista) if (podeLer(u, perm, a.nome)) arquivos[a.nome] = { rev: a.rev, tamanho: a.tamanho, em: a.atualizado_em, por: a.por };
  const config = {};
  for (const [k, r] of Object.entries(CONFIG)) if (u.perfil === 'Administrador' || r.ler.some(a => perm.abas.includes(a))) config[k] = await lerValor(env, 'cfg:' + k, null);
  return { versao: await versao(env), usuario: perfilPublico(u), permissoes: perm, pode: Object.fromEntries(Object.keys(ARQUIVOS).map(n => [n, { ler: podeLer(u, perm, n), gravar: podeGravar(u, perm, n), apagar: podeApagar(u, perm, n) }])), arquivos, config };
}
/* ---------------- arquivos de dados ---------------- */
function nomeValido(n) { return /^[a-z0-9][a-z0-9_.-]{0,39}$/.test(n) && !!regraArquivo(n); }
async function rotaArquivoLer(env, u, nome) {
  if (!nomeValido(nome)) throw new Erro(404, 'Arquivo não encontrado.');
  const perm = await permissoesDe(env, u.perfil);
  if (!podeLer(u, perm, nome)) throw new Erro(403, 'Sem permissão para ver estes dados.');
  const a = await um(env, 'SELECT rev, partes, tamanho FROM arquivos WHERE nome = ?', nome);
  if (!a || !a.partes) return { __texto: '', rev: 0 };
  const ps = await todos(env, 'SELECT dados FROM partes WHERE nome = ? AND rev = ? ORDER BY n', nome, a.rev);
  if (ps.length !== a.partes) throw new Erro(503, 'Arquivo em atualização. Tente de novo em instantes.');
  return { __texto: ps.map(p => p.dados).join(''), rev: a.rev };
}
/* envio em partes: PUT /arquivo/<nome>?rev=<nova>&n=<parte>&de=<total> (corpo = texto da parte) */
async function rotaArquivoGravar(env, u, nome, url, req) {
  if (!nomeValido(nome)) throw new Erro(404, 'Arquivo não encontrado.');
  const perm = await permissoesDe(env, u.perfil);
  if (!podeGravar(u, perm, nome)) { await registrar(env, u.usuario, 'gravar-recusado', nome); throw new Erro(403, 'Sem permissão para gravar estes dados.'); }
  const rev = parseInt(url.searchParams.get('rev'), 10), n = parseInt(url.searchParams.get('n'), 10), de = parseInt(url.searchParams.get('de'), 10);
  if (!(rev > 0) || !(n >= 0) || !(de > 0) || n >= de || de > 80) throw new Erro(400, 'Parâmetros de envio inválidos.');
  const texto = await req.text();
  if (texto.length > PARTE_MAX) throw new Erro(413, 'Parte grande demais.');
  const atual = await um(env, 'SELECT rev FROM arquivos WHERE nome = ?', nome);
  if (atual && rev <= atual.rev) throw new Erro(409, 'Já existe uma versão mais nova. Atualize a página.');
  await exec(env, 'INSERT OR REPLACE INTO partes (nome, rev, n, dados) VALUES (?,?,?,?)', nome, rev, n, texto);
  if (n < de - 1) return { ok: true, parcial: true };
  /* última parte: conferir que todas chegaram e publicar de uma vez */
  const ps = await todos(env, 'SELECT n, LENGTH(dados) AS t FROM partes WHERE nome = ? AND rev = ?', nome, rev);
  if (ps.length !== de) throw new Erro(400, 'Faltaram partes do arquivo.');
  const tam = ps.reduce((s, p) => s + p.t, 0);
  if (tam > ARQUIVO_MAX) throw new Erro(413, 'Arquivo grande demais.');
  const ver = (await versao(env)) + 1;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO arquivos (nome, rev, partes, tamanho, atualizado_em, por) VALUES (?,?,?,?,?,?) ON CONFLICT(nome) DO UPDATE SET rev = excluded.rev, partes = excluded.partes, tamanho = excluded.tamanho, atualizado_em = excluded.atualizado_em, por = excluded.por').bind(nome, rev, de, tam, agora(), u.usuario),
    env.DB.prepare('DELETE FROM partes WHERE nome = ? AND rev <> ?').bind(nome, rev),
    subirVersaoStmt(env, ver),
    env.DB.prepare('INSERT INTO log (quando, usuario, acao, detalhe) VALUES (?,?,?,?)').bind(agora(), u.usuario, 'gravou', nome + ' (' + tam + ' caracteres)')
  ]);
  return { ok: true, rev, versao: ver };
}
async function rotaArquivoApagar(env, u, nome) {
  if (!nomeValido(nome)) throw new Erro(404, 'Arquivo não encontrado.');
  const perm = await permissoesDe(env, u.perfil);
  if (!podeApagar(u, perm, nome)) { await registrar(env, u.usuario, 'apagar-recusado', nome); throw new Erro(403, 'Sem permissão para apagar estes dados.'); }
  const ver = (await versao(env)) + 1;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM partes WHERE nome = ?').bind(nome),
    env.DB.prepare('DELETE FROM arquivos WHERE nome = ?').bind(nome),
    subirVersaoStmt(env, ver),
    env.DB.prepare('INSERT INTO log (quando, usuario, acao, detalhe) VALUES (?,?,?,?)').bind(agora(), u.usuario, 'apagou', nome)
  ]);
  return { ok: true, versao: ver };
}

/* ---------------- administrativo ---------------- */
function soAdmin(u) { if (u.perfil !== 'Administrador') throw new Erro(403, 'Somente o administrador.'); }
async function rotaAdmin(env, u, req, partes) {
  soAdmin(u);
  const m = req.method;
  if (partes[1] === 'usuarios') {
    if (m === 'GET') return { usuarios: await todos(env, 'SELECT usuario, nome, perfil, ativo, trocar_senha, criado_em, atualizado_em FROM usuarios ORDER BY usuario'), perfis: PERFIS };
    if (m === 'POST') {
      const { usuario, nome, perfil, senha } = await req.json();
      const id = normU(usuario).replace(/\s+/g, '.');
      if (!/^[A-Z0-9._-]{3,40}$/.test(id)) throw new Erro(400, 'Usuário inválido (use letras, números, ponto ou traço).');
      if (!PERFIS.includes(perfil)) throw new Erro(400, 'Perfil inválido.');
      if (!senha || String(senha).length < 8) throw new Erro(400, 'A senha provisória precisa ter ao menos 8 caracteres.');
      if (await um(env, 'SELECT 1 FROM usuarios WHERE usuario = ?', id)) throw new Erro(400, 'Esse usuário já existe.');
      const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
      await exec(env, 'INSERT INTO usuarios (usuario, nome, perfil, ativo, sal, hash, trocar_senha, sessao, criado_em, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?)', id, String(nome || id).slice(0, 80), perfil, 1, sal, await hashSenha(env, senha, sal), 1, 0, agora(), agora());
      await registrar(env, u.usuario, 'criou-usuario', id + ' (' + perfil + ')');
      return { ok: true };
    }
    const alvo = normU(decodeURIComponent(partes[2] || ''));
    const existe = await um(env, 'SELECT usuario, perfil FROM usuarios WHERE usuario = ?', alvo);
    if (!existe) throw new Erro(404, 'Usuário não encontrado.');
    if (m === 'PATCH') {
      const b = await req.json();
      if (alvo === u.usuario && ((b.perfil && b.perfil !== 'Administrador') || b.ativo === false)) throw new Erro(400, 'Você não pode tirar o próprio acesso de administrador.');
      if (b.perfil) { if (!PERFIS.includes(b.perfil)) throw new Erro(400, 'Perfil inválido.'); await exec(env, 'UPDATE usuarios SET perfil = ?, sessao = sessao + 1, atualizado_em = ? WHERE usuario = ?', b.perfil, agora(), alvo); }
      if (b.nome) await exec(env, 'UPDATE usuarios SET nome = ?, atualizado_em = ? WHERE usuario = ?', String(b.nome).slice(0, 80), agora(), alvo);
      if (typeof b.ativo === 'boolean') await exec(env, 'UPDATE usuarios SET ativo = ?, sessao = sessao + 1, atualizado_em = ? WHERE usuario = ?', b.ativo ? 1 : 0, agora(), alvo);
      if (b.senha) {
        if (String(b.senha).length < 8) throw new Erro(400, 'A senha precisa ter ao menos 8 caracteres.');
        const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
        await exec(env, 'UPDATE usuarios SET sal = ?, hash = ?, trocar_senha = 1, sessao = sessao + 1, atualizado_em = ? WHERE usuario = ?', sal, await hashSenha(env, b.senha, sal), agora(), alvo);
        await exec(env, 'DELETE FROM tentativas WHERE usuario = ?', alvo);
      }
      if (b.desbloquear) await exec(env, 'DELETE FROM tentativas WHERE usuario = ?', alvo);
      await registrar(env, u.usuario, 'alterou-usuario', alvo + ' ' + Object.keys(b).filter(k => k !== 'senha').join(','));
      return { ok: true };
    }
    if (m === 'DELETE') {
      if (alvo === u.usuario) throw new Erro(400, 'Você não pode excluir o próprio usuário.');
      await exec(env, 'DELETE FROM usuarios WHERE usuario = ?', alvo);
      await registrar(env, u.usuario, 'excluiu-usuario', alvo);
      return { ok: true };
    }
  }
  if (partes[1] === 'permissoes') {
    if (m === 'GET') return { perfis: await lerValor(env, 'perfis', {}), padrao: PERM_PADRAO, abas: TODAS_ABAS, botoes: TODOS_BOTOES };
    if (m === 'PUT') {
      const { perfis } = await req.json(); const limpo = {};
      for (const p of ['Leitura', 'Editor']) if (perfis && perfis[p]) limpo[p] = { abas: (perfis[p].abas || []).filter(a => TODAS_ABAS.includes(a)), botoes: (perfis[p].botoes || []).filter(b => TODOS_BOTOES.includes(b)) };
      const ver = (await versao(env)) + 1;
      await env.DB.batch([env.DB.prepare(SQL_VALOR).bind('perfis', JSON.stringify(limpo), agora(), u.usuario), subirVersaoStmt(env, ver)]);
      await registrar(env, u.usuario, 'alterou-permissoes', '');
      return { ok: true, versao: ver };
    }
  }
  if (partes[1] === 'config' && m === 'PUT') {
    const { chave, valor } = await req.json();
    if (!CONFIG[chave]) throw new Erro(400, 'Configuração desconhecida.');
    await gravarValor(env, 'cfg:' + chave, valor, u.usuario); await env.DB.batch([subirVersaoStmt(env, (await versao(env)) + 1)]);
    await registrar(env, u.usuario, 'alterou-config', chave);
    return { ok: true };
  }
  if (partes[1] === 'publicar' && m === 'POST') {          /* "Publicar agora": todos que estão com o site aberto recarregam os dados */
    const ver = (await versao(env)) + 1;
    await env.DB.batch([subirVersaoStmt(env, ver)]);
    await registrar(env, u.usuario, 'publicou-agora', '');
    return { ok: true, versao: ver };
  }
  if (partes[1] === 'log' && m === 'GET') return { log: await todos(env, 'SELECT quando, usuario, acao, detalhe FROM log ORDER BY quando DESC LIMIT 300') };
  throw new Erro(404, 'Rota não encontrada.');
}

/* ---------------- diagnóstico (não mostra nenhum valor secreto) ---------------- */
async function diagnostico(env) {
  const d = { servico: 'central-inovacao-acesso', versao_codigo: VERSAO_CODIGO, banco_ligado: !!(env.DB && env.DB.prepare), tabelas: [], segredo_sessao: !!(env.SEGREDO_SESSAO && env.SEGREDO_SESSAO.length >= 20), pimenta: !!(env.PIMENTA && env.PIMENTA.length >= 20), origens: String(env.ORIGENS || '') };
  if (d.banco_ligado) {
    try { await garantirTabelas(env); } catch (e) { d.erro_criar_tabelas = String(e.message || e).slice(0, 200); }
    for (const t of TABELAS) { try { await um(env, `SELECT 1 AS x FROM ${t} LIMIT 1`); d.tabelas.push(t); } catch (e) { d.erro_banco = String(e.message || e).slice(0, 200); } }
  }
  const faltam = TABELAS.filter(t => !d.tabelas.includes(t));
  d.problemas = [];
  if (!d.banco_ligado) d.problemas.push('O banco não está ligado: no Worker, em Settings → Bindings, adicione D1 com o nome DB.');
  else if (faltam.length) d.problemas.push('Faltam tabelas no banco (' + faltam.join(', ') + '). O servidor tenta criá-las sozinho; se continuar, rode o schema.sql no Console do D1.');
  if (!d.segredo_sessao) d.problemas.push('Falta o segredo SEGREDO_SESSAO (mínimo 20 caracteres) em Settings → Variables and Secrets.');
  if (!d.pimenta) d.problemas.push('Falta o segredo PIMENTA (mínimo 20 caracteres) em Settings → Variables and Secrets.');
  if (!d.origens) d.problemas.push('Falta a variável ORIGENS com o endereço do site (ex.: https://emersonaraujodefreitas.github.io).');
  d.ok = d.problemas.length === 0;
  return d;
}

/* ---------------- entrada ---------------- */
const origensPermitidas = env => String(env.ORIGENS || '').split(',').map(s => s.trim()).filter(Boolean);
function cors(env, req) {
  const origem = req.headers.get('Origin') || '', perm = origensPermitidas(env);
  return { 'Access-Control-Allow-Origin': perm.includes(origem) ? origem : (perm[0] || 'null'), 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const resposta = (env, req, corpo, status = 200) => {
  const h = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors(env, req) };
  if (corpo && corpo.__texto !== undefined) return new Response(corpo.__texto, { status, headers: { ...h, 'Content-Type': 'text/plain; charset=utf-8', 'X-Rev': String(corpo.rev || 0) } });
  return new Response(JSON.stringify(corpo), { status, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' } });
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    try {
      const origem = req.headers.get('Origin');
      if (origem && !origensPermitidas(env).includes(origem)) throw new Erro(403, 'Origem não permitida.');
      const url = new URL(req.url);
      const partes = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
      const rota = partes[0];
      if (rota === 'saude' || rota === '') return resposta(env, req, await diagnostico(env));
      if (!env.DB) throw new Erro(500, 'Banco de dados não ligado ao servidor (veja /saude).');
      await garantirAdmin(env);
      if (rota === 'entrar' && req.method === 'POST') return resposta(env, req, await rotaLogin(env, req));
      const u = await autenticar(env, req);
      if (rota === 'trocar-senha' && req.method === 'POST') return resposta(env, req, await rotaTrocarSenha(env, u, req));
      if (u.trocar_senha) throw new Erro(403, 'Troque a senha provisória antes de continuar.');
      if (rota === 'estado' && req.method === 'GET') return resposta(env, req, await rotaEstado(env, u));
      if (rota === 'arquivo') {
        const nome = decodeURIComponent(partes[1] || '');
        if (req.method === 'GET') return resposta(env, req, await rotaArquivoLer(env, u, nome));
        if (req.method === 'PUT') return resposta(env, req, await rotaArquivoGravar(env, u, nome, url, req));
        if (req.method === 'DELETE') return resposta(env, req, await rotaArquivoApagar(env, u, nome));
      }
      if (rota === 'admin') return resposta(env, req, await rotaAdmin(env, u, req, partes));
      throw new Erro(404, 'Rota não encontrada.');
    } catch (e) {
      const status = e instanceof Erro ? e.status : 500;
      return resposta(env, req, { erro: e instanceof Erro ? e.message : 'Erro interno do servidor.' }, status);
    }
  }
};
