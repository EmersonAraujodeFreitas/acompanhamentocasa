# Servidor de acesso — passo a passo pelo painel da Cloudflare (sem linha de comando)

> **Usando o Worker já existente `central-hubspot`:** cole no editor dele o arquivo **`servidor/worker-unico.mjs`**
> (já junta o HubSpot + o login). Mantenha as variáveis que ele já tem (HUBSPOT_TOKEN, CHAVE_ACESSO) e faça só os
> passos 1, 3 e 4 abaixo (banco, ligação `DB` e as 3 variáveis novas). O site antigo continua funcionando durante a
> transição; quando o site novo estiver no ar, crie a variável `ACEITAR_CHAVE_ANTIGA` = `nao`.
> Para regenerar o arquivo: `python3 montar.py`.


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

---
## Site novo (pasta `/v2/`) e migração

1. Abra `https://emersonaraujodefreitas.github.io/acompanhamentocasa/v2/` — o site novo, com login no servidor.
2. Entre com **EMERSON / 12345678** e crie sua senha (mín. 8 caracteres).
3. Abra o **site atual**, entre como administrador e clique em **Migrar para o servidor novo** (canto inferior esquerdo). Informe EMERSON e a senha nova. Os dados atuais (Botmaker, Olos, recorrência, análise HubSpot) são enviados ao servidor.
4. No site novo, abra **Administrativo**: crie os usuários, marque guias e botões de cada perfil e use **Publicar agora**.
5. Quando tudo estiver conferido, crie no Worker a variável `ACEITAR_CHAVE_ANTIGA` = `nao` e troque o site atual pelo novo (copiar `v2/index.html` para a raiz, ajustando os caminhos `../favicon` para `favicon`).

### O que o servidor garante
- Senha e permissão conferidas no servidor; nada de token ou dado de usuário no GitHub.
- Os dados só saem do servidor para quem tem a guia liberada (o arquivo de cada ambiente: Botmaker, Olos, HubSpot, Buscar). Gravar/apagar exige guia **e** botão.
- Atenção: dentro do ambiente Botmaker os arquivos são únicos; esconder uma guia isolada (ex.: "Consumo") só a oculta no menu — quem recebe o ambiente recebe os dados dele.
- Testes: `teste/teste-servidor.mjs` (52 verificações do servidor) e `teste/teste-navegador.py` (fluxo completo no navegador, com `teste/servidor-de-teste.mjs`).
