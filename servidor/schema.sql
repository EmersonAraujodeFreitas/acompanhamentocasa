-- Banco da Central de Indicadores · Inovação Casa (Cloudflare D1)
-- O servidor também cria estas tabelas sozinho no primeiro acesso.
CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, nome TEXT NOT NULL, perfil TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, sal TEXT NOT NULL, hash TEXT NOT NULL, trocar_senha INTEGER NOT NULL DEFAULT 0, sessao INTEGER NOT NULL DEFAULT 0, criado_em TEXT, atualizado_em TEXT);
CREATE TABLE IF NOT EXISTS arquivos (nome TEXT PRIMARY KEY, rev INTEGER NOT NULL DEFAULT 0, partes INTEGER NOT NULL DEFAULT 0, tamanho INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT, por TEXT);
CREATE TABLE IF NOT EXISTS partes (nome TEXT NOT NULL, rev INTEGER NOT NULL, n INTEGER NOT NULL, dados TEXT NOT NULL, PRIMARY KEY (nome, rev, n));
CREATE TABLE IF NOT EXISTS valores (chave TEXT PRIMARY KEY, dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, por TEXT);
CREATE TABLE IF NOT EXISTS tentativas (usuario TEXT PRIMARY KEY, falhas INTEGER NOT NULL DEFAULT 0, bloqueado_ate TEXT);
CREATE TABLE IF NOT EXISTS log (quando TEXT NOT NULL, usuario TEXT, acao TEXT, detalhe TEXT);
CREATE INDEX IF NOT EXISTS idx_log_quando ON log (quando);
