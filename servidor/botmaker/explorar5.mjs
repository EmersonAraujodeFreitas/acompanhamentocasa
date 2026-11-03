// 5ª leitura: variáveis dos chats e sessões (onde mora a "typification"). Grava só nomes e contagens de valores de variáveis categóricas.
import fs from 'node:fs';
const BASE = 'https://api.botmaker.com/v2.0';
const CONTAS = [['UVA', process.env.BOTMAKER_TOKEN_UVA], ['UJ', process.env.BOTMAKER_TOKEN_UJ]].filter(c => c[1]);
const esp = ms => new Promise(r => setTimeout(r, ms));
const enc = encodeURIComponent;
const dia = n => new Date(Date.now() - n * 864e5).toISOString();
const CAT = /typif|tipif|nps|nota|avali|motivo|encerr|classif|status|fluxo|finaliz|resolv|assunto|categoria|tema|reason|rating|score/i;
async function conta([nome, token]) {
  const H = { 'access-token': token, Accept: 'application/json' };
  const get = async u => { for (let i = 0; i < 5; i++) { await esp(600); try { const x = await fetch(u.startsWith('http') ? u : BASE + u, { headers: H }); const t = await x.text(); if (x.status == 429) { await esp(3000 * (i + 1)); continue } let j = null; try { j = JSON.parse(t) } catch (e) { } return { status: x.status, j, texto: j ? '' : t.slice(0, 200) } } catch (e) { return { status: 0, j: null, texto: String(e.message).slice(0, 100) } } } return { status: 429, j: null } };
  const r = {};
  async function varrer(rotulo, caminho, paginas) {
    const nomes = {}, valores = {}, outrasChaves = {}; let n = 0, url = caminho, aviso;
    for (let p = 0; p < paginas && url; p++) {
      const b = await get(url);
      if (b.status >= 400 || !b.j) { aviso = { status: b.status, erro: b.j ? JSON.stringify(b.j).slice(0, 300) : b.texto }; break }
      const it = b.j.items || [];
      for (const c of it) {
        n++;
        for (const k of Object.keys(c)) if (/typif|tipif|nps/i.test(k)) outrasChaves[k] = (outrasChaves[k] || 0) + 1;
        const v = c.variables || {};
        for (const [k, val] of Object.entries(v)) {
          nomes[k] = (nomes[k] || 0) + 1;
          if (CAT.test(k)) { const m = valores[k] = valores[k] || {}; const s = String(val).slice(0, 60); m[s] = (m[s] || 0) + 1 }
        }
      }
      const nx = b.j.nextPage || b.j.next || b.j.nextPageToken || b.j['next-page'];
      if (!nx || !it.length) break;
      url = String(nx).startsWith('http') ? nx : caminho + (caminho.includes('?') ? '&' : '?') + 'page-token=' + enc(nx);
    }
    const top = o => Object.fromEntries(Object.entries(o).sort((a, c) => c[1] - a[1]).slice(0, 30));
    r[rotulo] = { n, aviso, variaveis: top(nomes), chaves_tipificacao_no_item: outrasChaves, valores: Object.fromEntries(Object.entries(valores).map(([k, m]) => [k, top(m)])) };
  }
  await varrer('chats', '/chats?limit=100', 15);
  await varrer('sessoes_7d', `/sessions?from=${enc(dia(7))}&to=${enc(dia(0))}&limit=100`, 15);
  return [nome, r];
}
const out = { gerado_em: new Date().toISOString(), contas: Object.fromEntries(await Promise.all(CONTAS.map(conta))) };
fs.mkdirSync('servidor/botmaker/resultado', { recursive: true });
fs.writeFileSync('servidor/botmaker/resultado/esquema5.json', JSON.stringify(out, null, 1));
console.log('ok');
