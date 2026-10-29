# Junta o Worker do HubSpot (hubspot-worker/worker.mjs) com o servidor de acesso (src/index.js)
# em um único arquivo para colar no Worker central-hubspot: servidor/worker-unico.mjs
import re,sys
hs=open('../hubspot-worker/worker.mjs',encoding='utf-8').read()
ac=open('src/index.js',encoding='utf-8').read()
assert hs.count('export default {')==1 and ac.count('export default {')==1
hs=hs.replace('export default {','const HS = {')
ac=ac.replace('export default {','const ACESSO = {')
rotas_hs="['/buscar','/estrutura','/painel','/campos','/contar','/vinculo','/jornada','/emails','/propriedades','/amostra','/volume','/duracao']"
roteador='''
/* ---------------- entrada única: acesso (login/dados) + HubSpot protegido por sessão ---------------- */
const ROTAS_HUBSPOT = %s;
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method !== 'OPTIONS' && ROTAS_HUBSPOT.includes(url.pathname)) {
      try {
        const origem = req.headers.get('Origin');
        if (origem && !origensPermitidas(env).includes(origem)) throw new Erro(403, 'Origem não permitida.');
        if (!env.DB) throw new Erro(500, 'Banco de dados não ligado ao servidor (veja /saude).');
        await garantirAdmin(env);
        /* transição: o site antigo ainda envia a chave fixa; vale enquanto ACEITAR_CHAVE_ANTIGA não for "nao" */
        const tk = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
        const antiga = env.CHAVE_ACESSO && env.ACEITAR_CHAVE_ANTIGA !== 'nao' && igual(tk, env.CHAVE_ACESSO);
        if (!antiga) {
          const u = await autenticar(env, req);
          if (u.trocar_senha) throw new Erro(403, 'Troque a senha provisória antes de continuar.');
          const perm = await permissoesDe(env, u.perfil, u.ambientes);
          if (!['olos', 'hubspot', 'buscar'].some(a => perm.abas.includes(a))) { await registrar(env, u.usuario, 'hubspot-recusado', url.pathname); throw new Erro(403, 'Sem permissão para consultar o HubSpot.'); }
        }
        if (!env.CHAVE_ACESSO) throw new Erro(500, 'Falta a variável CHAVE_ACESSO no Worker.');
        const h = new Headers(req.headers); h.set('Authorization', 'Bearer ' + env.CHAVE_ACESSO);
        const r = await HS.fetch(new Request(req, { headers: h }), { ...env, ORIGEM_PERMITIDA: origem || (origensPermitidas(env)[0] || '') }, ctx);
        const hdr = new Headers(r.headers); for (const [k, v] of Object.entries(cors(env, req))) hdr.set(k, v);
        return new Response(r.body, { status: r.status, headers: hdr });
      } catch (e) {
        return resposta(env, req, { erro: e instanceof Erro ? e.message : 'Erro interno do servidor.' }, e instanceof Erro ? e.status : 500);
      }
    }
    return ACESSO.fetch(req, env, ctx);
  }
};
''' % rotas_hs
open('worker-unico.mjs','w',encoding='utf-8').write('// Worker único: servidor de acesso + consulta HubSpot. Gerado por montar.py — não edite à mão.\n'+hs+'\n'+ac+roteador)
print('ok')
