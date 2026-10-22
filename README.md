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
- Segurança: tudo é lido e calculado só no navegador, em memória. Nada é enviado nem salvo (sem localStorage, IndexedDB ou cookies). CPF, telefone, IDs e comentários livres são descartados na leitura; números únicos usam um código irreversível com sal aleatório da sessão. Os dados somem ao sair, recarregar, fechar a aba ou após 15 minutos sem uso. O módulo roda só depois do login, junto com o restante do painel.
