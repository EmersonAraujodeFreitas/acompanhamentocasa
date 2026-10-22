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
