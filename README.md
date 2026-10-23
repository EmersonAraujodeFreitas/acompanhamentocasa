# Acompanhamento CASA — Painel Botmaker (Unijorge e UVA)

Painel de indicadores de atendimento gerado a partir das exportações da Botmaker.

- Acesso: https://emersonaraujodefreitas.github.io/acompanhamentocasa/
- `index.html`: o painel. `data.json`: os dados exibidos. `meta.json`: data e hora da última atualização.
- Modo backup: quem tem o token do GitHub (Contents: Read and write neste repositório) importa os arquivos na aba "Importar bases" e a atualização é publicada automaticamente para todos. Quem não tem o token vê as alterações só no próprio navegador.
- Cada publicação é um commit, então o histórico do repositório guarda as versões anteriores e permite restaurar uma delas.
- A data e hora da última atualização aparecem no topo do painel.

## Olos (importação manual)

- Botões **Botmaker** e **Olos** no topo do painel. Botmaker é o painel de sempre; Olos mostra indicadores dos arquivos exportados do Olos.
- Na aba Olos > Importar arquivos, arraste os arquivos (.txt ou .csv). O modelo é reconhecido sozinho: tabulações (EAGLLE), pausas, abandonadas e rejeitadas, desconexões, pesquisa NPS, discagem automática (TabAuto) e acessos à URA (UJ e UVA).
- Publicação para todos (mesmo processo da Botmaker): depois de importar, o administrador/editor clica em **Publicar para todos**, usando o mesmo token do GitHub da atualização da Botmaker. Os registros (já sem dados pessoais) são criptografados com a chave do painel e gravados em `olos.json` (mais `olos-meta.json` com a data). Os demais usuários recebem a versão publicada sozinhos, sem importar nada. Usuários de leitura só visualizam.
- Segurança: CPF, telefone, IDs e comentários livres são descartados na leitura; números únicos usam um código irreversível derivado da chave do painel. Antes de publicar, uma verificação bloqueia o envio se achar padrão de CPF/telefone. Nada vai para localStorage, IndexedDB ou cookies. O que ainda não foi publicado some ao sair, recarregar, fechar a aba ou após 15 minutos sem uso.
- Se a chave de acesso do painel for trocada, publique o Olos de novo (reimporte e publique), pois o `olos.json` antigo deixa de abrir.
- Filtros do Olos: universidade, área, tipo (ativo/receptivo/manual), período, dia da semana, faixa de hora, campanha, operador e resultado (produtiva/improdutiva). Há uma guia **Ativo × Receptivo** que separa os indicadores por tipo.
- Todo registro tem universidade e área (Admissão ou Serviços). Quando o arquivo não traz, o painel deduz pelo id da campanha, pelo id da chamada, pelo operador ou pelo telefone; para esse cruzamento, telefone e id da chamada viram um código irreversível (nunca o número). A quantidade deduzida aparece em Importar arquivos.
- **Buscar** (botão ao lado de Olos/Hubspot): digite um telefone com DDD ou um CPF e o painel monta a jornada do contato cruzando Olos, Botmaker e HubSpot (tabulações, abandonadas, discagem, URA, pesquisa, sessões do Botmaker, formulários, mudanças de etapa, e-mails, WhatsApp, ligações e negócios do HubSpot). A busca usa um código irreversível do número; o número digitado só aparece mascarado e é apagado ao sair ou após 15 min parado.
- **Botmaker na Buscar**: ao importar o arquivo de **Sessões** do Botmaker, o painel também guarda, por telefone (código irreversível), data, hora, canal, tipificação e se houve operador, e publica em `jb.json` (criptografado, junto com a publicação normal). Sessões já importadas antes dessa versão precisam ser reimportadas e publicadas de novo.
- **Hubspot**: importe as exportações (contatos, negócios, atividades; .csv ou .xlsx). Nome, e-mail e assunto são descartados; telefone/CPF viram código irreversível. Os eventos entram na publicação do Olos (`olos.json`).
- Ligação ao vivo com o HubSpot (webhook/API) exige um serviço intermediário (por exemplo uma função serverless) que guarde a chave do HubSpot; o site é estático e o repositório é público, então a chave não pode ficar aqui.

## Consulta ao vivo no HubSpot
A guia **Hubspot** tem um campo para a chave de acesso (`CHAVE_ACESSO` do Worker). Ela fica salva só no navegador. Com a chave, a **Buscar** consulta `https://central-hubspot.emerson-freitas.workers.dev` e inclui os eventos do HubSpot na jornada. Nesse caso o telefone/CPF digitado é enviado ao Worker (não ao GitHub). Se o site usar outro domínio, ajuste `ORIGEM_PERMITIDA` no Worker; se o CPF estiver em outra propriedade, ajuste `CPF_PROP`.

### Visão gerencial do HubSpot (guia Hubspot › Visão gerencial)
Com milhões de contatos e negócios, o painel **não baixa registros**: o Worker (rotas `/estrutura`, `/contar`) pergunta ao HubSpot os **totais exatos** de cada recorte (universidade, pipeline, etapa, origem, ciclo de vida, mês) e devolve só números. Os dados carregam sozinhos ao abrir a guia (últimos 12 meses por padrão) e ficam guardados só neste navegador; o botão atualiza em tempo real. Não há valores em R$ (a busca do HubSpot não soma).
A universidade vem da propriedade `universidade` (contatos e negócios) ou, se não houver, do nome do pipeline. Defina `UNI_PROP` no Worker para outro nome. **Atualize o código do Worker** com `hubspot-worker/worker.mjs` sempre que este arquivo mudar.

> Atualização: a guia **Buscar** agora consulta **somente o HubSpot** (telefone ou CPF), sem cruzar Olos nem Botmaker.

### Modelo executivo (guia Hubspot)
Guias **Contatos**, **Negócios** e **E-mails e comunicação**, cada uma com faixa escura de números, leitura automática dos dados, **duelo UVA × Unijorge** (jornada passo a passo lado a lado), gráficos de comunicação (receberam, abriram, clicaram, responderam), mapa de calor por etapa/status/origem e **Modo apresentação** (tela cheia, setas do teclado). A guia de e-mails ranqueia os modelos de e-mail de marketing por entrega, abertura, clique e resposta (exige a permissão de e-mails de marketing no token do HubSpot). A universidade dos contatos é descoberta sozinha pelo Worker (propriedade `universidade`, nome do formulário, origem etc.).

- **Comunicações em detalhe** (Buscar › Jornada completa): tabela com data, hora, tipo, direção, situação (lido, não lido/sem leitura registrada, respondeu, atendida, falhou), etapa do negócio na época e todos os detalhes de cada ligação, e-mail, WhatsApp/mensagem e reunião. Requer o Worker `cpf-estrito-2026-10-22g`.
- Em **Etapas da jornada por negócio**, cada etapa lista abaixo as comunicações dela (data, hora, tipo, direção, situação e todos os dados).
- **Matrículas e candidaturas** (Buscar › Visão geral): um cartão por negócio do CPF com situação acadêmica, situação do aluno, curso, período, etapa, RA e todos os campos; sinaliza quando há mais de uma matrícula. Também há o painel "Visão executiva" e "Leitura rápida", e gráficos de atividade por mês, canal e situação na Jornada completa.
- **Rastreio de origem**: painel "De onde o contato veio" na Visão geral (fonte original, detalhamento, primeira página vista, referenciador, campanha, UTM) e resumo "Veio de" no bloco "Antes do negócio". Worker `cpf-estrito-2026-10-22h`.
- **Financeiro** (Buscar › Visão geral): tabela de adimplência, valores devidos e dívidas (acordo, biblioteca, mensalidade, outros) por contato e por negócio, com alertas de inconsistência. Worker `cpf-estrito-2026-10-23i` ignora propriedades marcadas como desuso/não utilizado.
- **HubSpot** agora tem só as guias Contatos e Negócios. Em cada uma: "Jornada até cada etapa" (média de e-mails, WhatsApp e ligações antes de formulário, inscrito, convocado, contrato, pagamento, enturmado, matriculado e rematrícula; contatos por marco e por UTM) e "Marketing" (fonte original x mais recente, conversão por fonte, sazonalidade por mês e recomendações). Requer o Worker `cpf-estrito-2026-10-23j` (rota /jornada). O painel de Contatos mostra Matriculados.

## Jornada média da base (Contatos e Negócios)
- Mesmo modelo da jornada do Buscar, mas com a média da base inteira: blocos em sequência com seta animada, quantidade que chegou em cada etapa, % sem comunicação, média de comunicações e tempo médio desde a etapa anterior (ingresso e rematrícula; contatos do cadastro ao cliente).
- Universidade pelo vínculo (rota `/vinculo` do Worker): para contatos com negócio, usa a universidade do cadastro e, se faltar, deduz pelos negócios ligados (funil, nome, campos). Somente leitura — nada é gravado no HubSpot.
- Cruzamento por CPF: contatos sem universidade são cruzados com os negócios de mesmo CPF; a taxa de resolução da amostra é aplicada como estimativa ao "Não identificada" dos gráficos e da visão executiva de Contatos.
