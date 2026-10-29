# Gera a cópia /v2/index.html (login e permissões no servidor) a partir do index.html atual.
import json,re,sys,os
API=sys.argv[1] if len(sys.argv)>1 else 'https://central-hubspot.emerson-freitas.workers.dev'
R=os.path.dirname(os.path.abspath(__file__))
s=open(R+'/../index.html',encoding='utf-8').read()
def sub(old,new,cnt=1):
    global s
    assert s.count(old)>=1,('não achei: '+old[:80])
    s=s.replace(old,new,cnt)
# 1) modelo da tela de login
i=s.find("o.innerHTML=`");j=s.find("`;",i);tpl=s[i+len("o.innerHTML=`"):j]
# 2) shell novo
a=s.find("<script>(async()=>{const mn=document.getElementById('mn')");b=s.find("})();</script>",a)+len("})();</script>")
assert a>0 and b>a
shell=open(R+'/cliente/shell.js',encoding='utf-8').read().replace('__API__',json.dumps(API)).replace('__LGT__',json.dumps(tpl,ensure_ascii=False))
s=s[:a]+'<script>'+shell+'</script>'+s[b:]
# 3) app: dados e permissões pelo servidor
k=re.search(r"const tokGet=\(\)=>\{try\{return localStorage.getItem\('ghtok'\)\|\|''\}catch\(e\)\{return''\}\}",s); assert k
s=s.replace(k.group(0),"const tokGet=()=>(window.AUTH&&AUTH.tok)||''",1)
k=re.search(r"async function ghGet\(p\)\{.*?\n",s); assert k
s=s.replace(k.group(0),"async function ghGet(p){const n=AUTH.nm(p);if(!n)return null;const t=await AUTH.get(n);return t?{content:t,sha:'x'}:null}\n",1)
k=re.search(r"async function ghPut\(p,blob,msg,on\)\{.*?\n",s); assert k
s=s.replace(k.group(0),"async function ghPut(p,blob,msg,on){const n=AUTH.nm(p);if(!n)throw new Error('arquivo desconhecido: '+p);return AUTH.put(n,blob,on)}\n",1)
sub("hsKey=()=>{try{return localStorage.getItem('hskey')||''}catch(e){return''}}","hsKey=()=>(window.AUTH&&AUTH.tok)||''")
sub("function lgEv(a,d){","function lgEv(a,d){return;")
sub("async function publish(force){if(!tokGet()){","async function publish(force){if(!AUTH.can('publicar')){setPub('Seu perfil não pode publicar.',1);return false}if(!tokGet()){")
sub("function setLogo(f){","function setLogo(f){if(!AUTH.can('logo'))return;")
sub('<a data-p="usr"><svg class="i"><use href="#ic-users"/></svg>Usuários</a>','<a data-p="usr"><svg class="i"><use href="#ic-users"/></svg>Administrativo</a>')
# 4) painel Administrativo no fim do app
end=s.rfind("</script>",0,s.find("</body>")) if "</body>" in s else -1
m=re.search(r'(<script type="text/plain" id="app">)(.*?)(</script>)',s,re.S); assert m
s=s[:m.end(2)]+open(R+'/cliente/admin.js',encoding='utf-8').read()+s[m.end(2):]
# 5) cabeçalho: sem GitHub, favicons relativos, API liberada no CSP
sub("https://api.github.com https://central-hubspot.emerson-freitas.workers.dev",API)
s=s.replace('href="favicon','href="../favicon')
os.makedirs(R+'/../v2',exist_ok=True)
open(R+'/../v2/index.html','w',encoding='utf-8').write(s)
print('v2/index.html',len(s))
