from playwright.sync_api import sync_playwright
import json,time
STUB="window.Chart=function(){this.destroy=()=>{};this.update=()=>{};this.data={datasets:[]}};Chart.defaults={font:{},plugins:{legend:{labels:{}},tooltip:{}},scale:{},elements:{}};Chart.register=()=>{};Chart.getChart=()=>null;Chart.instances={};"
res=[]
def chk(n,c): res.append((n,bool(c))); print(('OK  ' if c else 'FALHOU ')+n)
with sync_playwright() as p:
    b=p.chromium.launch()
    def novo():
        ctx=b.new_context(viewport={'width':1400,'height':900}); pg=ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        pg.route('**/cdnjs.cloudflare.com/**',lambda r:r.fulfill(body=STUB,content_type='application/javascript'))
        pg.route('**/fonts.g*/**',lambda r:r.abort())
        return ctx,pg,errs
    # --- administrador
    ctx,pg,errs=novo(); reqs=[]
    pg.on('request',lambda r:reqs.append(r.url))
    pg.goto('http://localhost:8000/v2/index.html'); pg.wait_for_selector('#lgn',timeout=15000)
    chk('tela de login aparece antes de qualquer dado',pg.locator('#lgu').count()==1 and not any('/arquivo/' in u for u in reqs))
    pg.fill('#lgu','emerson'); pg.fill('#lgp','errada123'); pg.click('#lgb'); pg.wait_for_timeout(800)
    chk('senha errada mostra erro',('incorretos' in pg.inner_text('#lge')))
    pg.fill('#lgp','Admin#12345'); pg.click('#lgb'); pg.wait_for_timeout(6000)
    chk('admin entra e o painel carrega',pg.locator('#lgn').count()==0 and pg.locator('aside a[data-p=exec]').count()==1)
    print('erros de página:',errs[:4])
    pg.click('#psw button[data-pr=b]'); pg.wait_for_timeout(1500)
    pg.click('aside a[data-p=usr]'); pg.wait_for_timeout(1500)
    txt=pg.inner_text('#mn'); chk('painel Administrativo lista usuários',('Administrativo' in txt and 'LEITOR1' in txt and 'Registro de acessos' in txt))
    pg.screenshot(path='/tmp/claude-0/-home-claude/1e98c1b1-941f-5432-b42d-cd93b4a3fd68/scratchpad/e2e/admin.png')
    # criar usuário pelo painel
    pg.fill('#nuU','novo1'); pg.fill('#nuN','Pessoa Nova'); pg.fill('#nuS','provisoria9'); pg.click('#nuB'); pg.wait_for_timeout(1500)
    chk('criou usuário pelo painel','NOVO1' in pg.inner_text('#mn'))
    tokadm=pg.evaluate("AUTH.tok")
    # --- leitor: troca obrigatória de senha
    ctx2,pg2,errs2=novo(); pg2.goto('http://localhost:8000/v2/index.html'); pg2.wait_for_selector('#lgn')
    pg2.fill('#lgu','leitor1'); pg2.fill('#lgp','provisoria1'); pg2.click('#lgb'); pg2.wait_for_selector('#lgn1',timeout=8000)
    chk('leitor é obrigado a trocar a senha','Crie sua senha' in pg2.inner_text('#lgf'))
    pg2.fill('#lgn1','curta'); pg2.fill('#lgn2','curta'); pg2.click('#lgb'); pg2.wait_for_timeout(500)
    chk('senha curta recusada','8 caracteres' in pg2.inner_text('#lge'))
    pg2.fill('#lgn1','LeitorSenha1'); pg2.fill('#lgn2','LeitorSenha1'); pg2.click('#lgb'); pg2.wait_for_timeout(6000)
    chk('leitor entra após trocar',pg2.locator('#lgn').count()==0 and pg2.locator('aside a[data-p=exec]').count()==1)
    pg2.click('#psw button[data-pr=b]'); pg2.wait_for_timeout(1200)
    vis=lambda sel:pg2.evaluate("s=>{const a=document.querySelector(s);return !!a&&a.style.display!='none'}",sel)
    chk('leitor NÃO vê Importar bases nem Administrativo',not vis('aside a[data-p=data]') and not vis('aside a[data-p=usr]'))
    chk('leitor vê o Dashboard',vis('aside a[data-p=exec]'))
    # tentativas pelo console do navegador como leitor
    r=pg2.evaluate("""async()=>{const fetch0=(u,o)=>fetch('http://localhost:8787'+u,o);const h={Authorization:'Bearer '+AUTH.tok};const o={};
      o.gravaData=(await fetch0('/arquivo/data?rev=9999999999999&n=0&de=1',{method:'PUT',headers:h,body:'x'})).status;
      o.apagaData=(await fetch0('/arquivo/data',{method:'DELETE',headers:h})).status;
      o.admin=(await fetch0('/admin/usuarios',{headers:h})).status;
      o.criaAdmin=(await fetch0('/admin/usuarios',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({usuario:'hack',perfil:'Administrador',senha:'abcdefgh1'})})).status;
      o.perm=(await fetch0('/admin/permissoes',{method:'PUT',headers:{...h,'Content-Type':'application/json'},body:'{"perfis":{}}'})).status;
      o.semToken=(await fetch0('/arquivo/data')).status;
      o.hub=(await fetch0('/campos',{headers:h})).status;
      return o}""")
    print('console do leitor:',r)
    chk('leitor NÃO grava',r['gravaData']==403); chk('leitor NÃO apaga',r['apagaData']==403)
    chk('leitor NÃO usa admin',r['admin']==403 and r['criaAdmin']==403 and r['perm']==403)
    chk('sem token = 401',r['semToken']==401)
    # admin retira a guia Capacidade do perfil Leitura: leitor recebe sem recarregar manualmente
    pg.evaluate("""async()=>{const P=await AUTH.j('/admin/permissoes');const pr=Object.assign({},P.padrao,P.perfis);pr.Leitura.abas=pr.Leitura.abas.filter(a=>a!='cap');await AUTH.j('/admin/permissoes',{method:'PUT',body:{perfis:{Leitura:pr.Leitura,Editor:pr.Editor}}})}""")
    pg2.wait_for_timeout(17500)
    chk('mudança de permissão chega ao leitor sem ele recarregar',not vis('aside a[data-p=cap]') and vis('aside a[data-p=exec]'))
    # desativar derruba a sessão
    pg.evaluate("AUTH.j('/admin/usuarios/LEITOR1',{method:'PATCH',body:{ativo:false}})")
    pg2.wait_for_timeout(17500)
    chk('desativar derruba a sessão (volta ao login)',pg2.locator('#lgn').count()==1)
    chk('dados locais do leitor apagados',pg2.evaluate("localStorage.getItem('sess2')")is None)
    # sair apaga dados do computador
    pg.evaluate("localStorage.setItem('teste','x')"); pg.evaluate("AUTH.out()"); pg.wait_for_timeout(2500)
    chk('Sair apaga localStorage e volta ao login',pg.locator('#lgn').count()==1 and pg.evaluate("localStorage.getItem('teste')")is None and pg.evaluate("localStorage.getItem('sess2')")is None)
    b.close()
print('RESUMO',sum(1 for _,c in res if c),'ok',sum(1 for _,c in res if not c),'falhas')
