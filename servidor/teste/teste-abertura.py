from playwright.sync_api import sync_playwright
STUB=open('e2e.py').read().split('STUB="')[1].split('"\n')[0]
res=[]
def chk(n,c): res.append(c); print(('OK  ' if c else 'FALHOU ')+n)
def novo(b):
    ctx=b.new_context(viewport={'width':1400,'height':900}); pg=ctx.new_page()
    pg.route('**/cdnjs.cloudflare.com/**',lambda r:r.fulfill(body=STUB,content_type='application/javascript'))
    pg.route('**/fonts.g*/**',lambda r:r.abort()); return pg
def entrar(pg,u,s,nova=None):
    pg.goto('http://localhost:8000/v2/index.html'); pg.wait_for_selector('#lgn')
    pg.fill('#lgu',u); pg.fill('#lgp',s); pg.click('#lgb')
    if nova: pg.wait_for_selector('#lgn1'); pg.fill('#lgn1',nova); pg.fill('#lgn2',nova); pg.click('#lgb')
    pg.wait_for_timeout(6500)
with sync_playwright() as p:
    b=p.chromium.launch(); adm=novo(b); entrar(adm,'emerson','Admin#12345')
    adm.evaluate("""async()=>{await AUTH.j('/admin/permissoes',{method:'PUT',body:{perfis:{Leitura:{abas:['qual','prod','olos','hubspot','buscar'],botoes:[]},Editor:{abas:['exec'],botoes:[]}}}});
      await AUTH.j('/admin/usuarios',{method:'POST',body:{usuario:'soqual',nome:'So Qual',perfil:'Leitura',senha:'provisoria1',ambientes:['b']}});
      await AUTH.j('/admin/usuarios',{method:'POST',body:{usuario:'hubbusca',nome:'Hub',perfil:'Leitura',senha:'provisoria1',ambientes:['h','s']}});
      await AUTH.j('/admin/usuarios',{method:'POST',body:{usuario:'soolos',nome:'Olos',perfil:'Leitura',senha:'provisoria1',ambientes:['o']}})}""")
    u=novo(b); entrar(u,'soqual','provisoria1','Senha12345')
    chk('Botmaker-only abre na 1ª guia liberada (Qualidade)',u.evaluate("document.querySelector('aside a[data-p].on')&&document.querySelector('aside a[data-p].on').dataset.p")=='qual' and u.evaluate("!document.body.classList.contains('olos')"))
    chk('Dashboard escondido para quem não tem',u.evaluate("getComputedStyle(document.querySelector('aside a[data-p=exec]')).display")=='none')
    h=novo(b); entrar(h,'hubbusca','provisoria1','Senha12345')
    chk('HubSpot+Buscar abre em modo Buscar',h.evaluate("document.body.classList.contains('olos')&&document.querySelector('#psw button.on').dataset.pr")=='s')
    o=novo(b); entrar(o,'soolos','provisoria1','Senha12345')
    chk('Só Olos abre no Olos',o.evaluate("document.body.classList.contains('olos')&&document.querySelector('#psw button.on').dataset.pr")=='o')
    b.close()
print('RESUMO',sum(res),'ok',len(res)-sum(res),'falhas')
