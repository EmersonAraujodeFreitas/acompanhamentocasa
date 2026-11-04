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

## Atualização pela API da Botmaker (botão “Atualizar via API”)

O robô roda no **GitHub Actions** (de hora em hora e quando alguém clica no botão), lê a API da Botmaker com os tokens que já estão nos secrets `UNIJORGE` e `UNIVERSIDADEVEIGAALMEIDA`, calcula as bases no formato dos relatórios e **envia ao servidor** (nada fica no GitHub). Quem clica no botão importa esses dados para o painel. A importação manual continua igual e o consumo do WhatsApp continua só por importação.

### Configuração única (tudo pelo navegador)
1. **Worker**: cole o `worker-unico.mjs` novo no `central-hubspot` e clique em **Deploy**.
2. **Token do GitHub** para o botão disparar o robô: GitHub → foto do perfil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**. Em *Repository access* escolha **Only select repositories → acompanhamentocasa**. Em *Permissions → Repository permissions* marque **Actions: Read and write** (e nada mais). Defina uma validade e copie o token.
3. **Cloudflare** → Workers → `central-hubspot` → **Settings → Variables and Secrets**: adicione o secret **GH_TOKEN** (o token acima) e a variável **GH_REPO** = `EmersonAraujodeFreitas/acompanhamentocasa`. Depois **Deploy**.
4. **Usuário de integração**: no painel, **Administrativo → novo usuário** `integracao`, perfil **Editor**, ambiente **Botmaker**. Entre uma vez com ele (pode ser em outra janela anônima) para trocar a senha provisória por uma senha forte.
5. **Secrets do repositório** (GitHub → repositório → Settings → Secrets and variables → Actions → New repository secret): `SERVIDOR_URL` = `https://central-hubspot.emerson-freitas.workers.dev`, `INTEGRACAO_USUARIO` = `integracao`, `INTEGRACAO_SENHA` = a senha que você definiu no passo 4.
6. Em **Actions**, confirme que o workflow **Botmaker - atualizar dados pela API** está ativo.

### Uso
- Botão **Atualizar via API** no topo (ambiente Botmaker, para quem tem Importar): escolha o período, acompanhe a barra e os dados entram sozinhos. Se o robô já tiver rodado, aparece “Há dados novos prontos” com o botão **Importar agora**.
- Para a produtividade e a tipificação dos últimos dias o robô precisa rodar com frequência: a Botmaker só guarda a tipificação do último atendimento de cada contato.

### Cuidados
- Os secrets `INTEGRACAO_*` dão a quem os tiver o poder de um Editor: nunca coloque em arquivos ou no chat.
- Limites da Botmaker: mensagens só dos últimos ~3 dias sem busca longa (o robô já trata), auditorias de status 1 consulta por minuto (por isso a produtividade vem só do dia atual).
- Validado contra o painel para a Unijorge em 01/10/2026: conversas (≈91%), filas, atendentes, tempo de resposta, conversa com operador e total da conversa ficaram próximos dos relatórios. **Não existem na API** (ficam em branco nas linhas vindas por API): Espera em fila, Espera por operador, Operador saiu, Usuário saiu e os tempos limite. Esses vêm só da importação manual.

## Página “Apresentação”
Monta ao vivo slides no estilo do modelo de Serviços (motivos de contato, transbordo, efetividade e frentes de atuação), **por mês ou por semana**, com os filtros de organização e período, e exporta em **PPTX**. Usa os dados já carregados no painel; os textos editoriais (principal motivador, ações) são editáveis e ficam salvos neste navegador. O slide “Orçamento × Realizado” não está incluído porque o painel não guarda orçamento.

## Período fechado e ano inteiro (Atualizar via API)
No botão **Atualizar via API** há: Mês atual, Mês anterior, Escolher um mês e **Ano inteiro (mês a mês)**. O site pede um mês por vez ao robô (máximo de 35 dias por rodada), importa e segue para o próximo; a janela precisa ficar aberta. Em período fechado o status dos atendentes (Produtividade) só é buscado se a caixa for marcada, porque a Botmaker limita a 1 consulta por minuto. Depois de atualizar o Worker (`worker-unico.mjs`), o workflow novo já aceita `de`, `ate` e `produtividade`.
