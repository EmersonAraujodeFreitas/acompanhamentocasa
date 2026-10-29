# Servidor de acesso — passo a passo pelo painel da Cloudflare (sem linha de comando)

## 1. Criar o banco (D1)
1. Entre em dash.cloudflare.com → **Storage & databases → D1 SQL database → Create database**.
2. Nome: `central-inovacao` → **Create**.
(As tabelas são criadas sozinhas pelo servidor. Se quiser, na aba **Console** do banco cole o conteúdo de `schema.sql` e execute.)

## 2. Criar o Worker
1. **Compute → Workers & Pages → Create → Create Worker**. Nome: `central-inovacao-acesso` → **Deploy**.
2. **Edit code**: apague tudo, cole o conteúdo de `src/index.js` → **Deploy**.

## 3. Ligar o banco
Worker → **Settings → Bindings → Add → D1 database**: nome da variável **DB**, banco `central-inovacao` → **Deploy**.

## 4. Variáveis (Settings → Variables and Secrets)
| Nome | Tipo | Valor |
|---|---|---|
| `SEGREDO_SESSAO` | Secret | texto aleatório com 40+ caracteres |
| `PIMENTA` | Secret | outro texto aleatório com 40+ caracteres |
| `ORIGENS` | Text | `https://emersonaraujodefreitas.github.io` |

Guarde `SEGREDO_SESSAO` e `PIMENTA`: se mudar a PIMENTA depois, todas as senhas deixam de funcionar.

## 5. Conferir
Abra `https://SEU-WORKER.workers.dev/saude`. Deve mostrar `"ok": true`. Se não, a lista `problemas` diz o que falta (nenhum segredo é exibido).

## 6. Primeiro acesso
Usuário **EMERSON**, senha **12345678**. O sistema obriga a trocar a senha na hora. (Opcional: crie o secret `ADMIN_SENHA_INICIAL` antes do primeiro acesso para usar outra senha provisória.)

## Regras do servidor
- Perfis: **Leitura**, **Editor**, **Administrador** (o administrador tem tudo).
- Cada perfil só recebe os arquivos das guias liberadas; gravar exige a guia **e** o botão liberados.
- 5 senhas erradas = bloqueio de 15 min. Desativar, trocar perfil ou senha derruba a sessão.
- Teste automático: `node teste/teste-servidor.mjs` (43 verificações, incl. usuário sem permissão lendo/gravando).
