(async()=>{const mn=document.getElementById('mn'),TE=new TextEncoder(),API=__API__,LGT=__LGT__,CH=600000,F0=window.fetch.bind(window);
const b64e=u=>{u=new Uint8Array(u);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)},b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const NOMES={'data.json':'data','olos.json':'olos','olos-meta.json':'olos-meta','jb.json':'jb','rc.json':'rc','analise.json':'analise','meta.json':'meta'};
const nm=p=>{p=String(p).split('?')[0];if(NOMES[p])return NOMES[p];const m=p.match(/^st_(UJ|UVA)\.bin$/);return m?'st_'+m[1].toLowerCase()+'.bin':null};
const BOTMAKER=['exec','uni','sess','team','a360','sla','qual','prod','cap','cross','rec','cons','bd','data','consimp','stat'];
const ROLE={Administrador:'admin',Editor:'editor',Leitura:'viewer'};
const A=window.AUTH={K:1,role:'',name:'',user:'',perfil:'',tok:'',own:0,env:null,perm:{abas:[],botoes:[]},fresh:1,dk:'',ak:'',lk:'',b64e,b64d,
async stream(buf,st){return new Uint8Array(await new Response(new Blob([buf]).stream().pipeThrough(st)).arrayBuffer())},
async enc(x){const z=await A.stream(typeof x=='string'?TE.encode(x):x,new CompressionStream('gzip'));return new Blob([z],{type:'application/octet-stream'})},
async dec(buf){const z=await A.stream(new Uint8Array(buf),new DecompressionStream('gzip'));return new TextDecoder().decode(z)},
async save(){},async aes(){throw new Error('indisponível')},
can(b){return A.perm.botoes.includes(b)},guia(g){return A.perm.abas.includes(g)},
async raw(path,opt){const h=Object.assign({},(opt&&opt.headers)||{});if(A.tok)h.Authorization='Bearer '+A.tok;const r=await F0(API+path,Object.assign({cache:'no-store'},opt,{headers:h}));if(r.status==401&&A.tok&&path!='/entrar'&&path!='/trocar-senha')A.expired();return r},
async j(path,opt){const o=Object.assign({},opt||{});if(o.body&&typeof o.body!='string'){o.body=JSON.stringify(o.body)}if(o.body)o.headers=Object.assign({'Content-Type':'application/json'},o.headers||{});const r=await A.raw(path,o);let j={};try{j=await r.json()}catch(e){}if(!r.ok){const e=new Error(j.erro||('Erro '+r.status));e.status=r.status;throw e}return j},
async get(n){const r=await A.raw('/arquivo/'+n);if(r.status==403){const e=new Error('Sem permissão para estes dados.');e.status=403;throw e}if(!r.ok){const e=new Error('Erro '+r.status);e.status=r.status;throw e}const t=await r.text();return t||null},
async put(n,blob,on){const txt=b64e(await blob.arrayBuffer()),rev=Date.now(),de=Math.max(1,Math.ceil(txt.length/CH));for(let i=0;i<de;i++){const r=await A.raw('/arquivo/'+n+'?rev='+rev+'&n='+i+'&de='+de,{method:'PUT',headers:{'Content-Type':'text/plain'},body:txt.slice(i*CH,(i+1)*CH)});if(!r.ok){let j={};try{j=await r.json()}catch(e){}const e=new Error(j.erro||('Erro '+r.status));e.status=r.status;throw e}if(on)try{on((i+1)/de)}catch(e){}}},
nm,
wipe(){try{localStorage.clear();sessionStorage.clear()}catch(e){}try{if(indexedDB.databases)indexedDB.databases().then(l=>l.forEach(d=>d.name&&indexedDB.deleteDatabase(d.name)))}catch(e){}try{if(window.caches)caches.keys().then(k=>k.forEach(x=>caches.delete(x)))}catch(e){}},
expired(){if(A._exp)return;A._exp=1;A.wipe();try{localStorage.setItem('msglogin','Sua sessão foi encerrada. Entre novamente.')}catch(e){}setTimeout(()=>location.reload(),150)},
async out(){try{if(A.tok)await F0(API+'/estado',{headers:{Authorization:'Bearer '+A.tok}}).catch(()=>0)}catch(e){}A.tok='';A._exp=1;A.wipe();setTimeout(()=>location.reload(),150)}};
window.can=b=>A.can(b);
/* leitura de arquivos de dados passa pelo servidor (nunca pelo GitHub) */
window.fetch=async(u,o)=>{if(typeof u=='string'&&!/^https?:/.test(u)){const n=nm(u);if(n){let t;try{t=await A.get(n)}catch(e){return new Response('',{status:e.status||500})}return t==null?new Response('',{status:404}):new Response(b64d(t))}if(/^(users\.json|lg_)/.test(u))return new Response('',{status:404})}return F0(u,o)};
/* ---------- tela de entrada ---------- */
function loginUI(msg){return new Promise(res=>{const o=document.createElement('div');o.id='lgn';o.innerHTML=LGT;document.body.appendChild(o);let f=o.querySelector('#lgf'),e=o.querySelector('#lge'),b=o.querySelector('#lgb');const u0=o.querySelector('#lgu');u0.focus();if(msg)e.textContent=msg;
{const tg=o.querySelector('#lgt'),pw=o.querySelector('#lgp'),sw=()=>{pw.type=pw.type=='password'?'text':'password';tg.style.color=pw.type=='text'?'#00487f':''};tg.onclick=sw;tg.onkeydown=ev=>{if(ev.key=='Enter'||ev.key==' '){ev.preventDefault();sw()}}}
let fase='login',atual='';
f.onsubmit=async ev=>{ev.preventDefault();b.disabled=true;e.textContent='';
try{if(fase=='login'){const u=o.querySelector('#lgu').value,p=o.querySelector('#lgp').value;if(!u||!p){b.disabled=false;return}b.textContent='Verificando…';const r=await A.j('/entrar',{method:'POST',body:{usuario:u,senha:p,manter:true}});A.tok=r.token;if(r.usuario.trocarSenha){atual=p;fase='troca';f.innerHTML='<h2>Crie sua senha</h2><p>Por segurança, troque a senha provisória por uma senha só sua (mínimo 8 caracteres).</p><label>Nova senha<input id="lgn1" type="password" autocomplete="new-password"></label><label>Repita a nova senha<input id="lgn2" type="password" autocomplete="new-password"></label><button id="lgb">Salvar e entrar</button><div id="lge"></div><div class="ft">Inovação Casa · Unijorge × UVA</div>';e=f.querySelector('#lge');b=f.querySelector('#lgb');f.querySelector('#lgn1').focus();return}o.remove();res()}
else{const n1=f.querySelector('#lgn1').value,n2=f.querySelector('#lgn2').value;if(n1.length<8)throw new Error('A senha precisa ter ao menos 8 caracteres.');if(n1!==n2)throw new Error('As duas senhas não são iguais.');b.textContent='Salvando…';const r=await A.j('/trocar-senha',{method:'POST',body:{atual,nova:n1}});A.tok=r.token;o.remove();res()}}
catch(x){e.textContent=x.message||'Falha ao entrar.';A.tok=fase=='login'?'':A.tok;const l=o.querySelector('#lgp');if(l&&fase=='login')l.value='';b.disabled=false;b.textContent=fase=='login'?'Entrar':'Salvar e entrar'}}})}
function aplicar(est){A.user=est.usuario.usuario;A.name=est.usuario.nome;A.perfil=est.usuario.perfil;A.own=A.user=='EMERSON'?1:0;A.role=ROLE[A.perfil]||'viewer';A.perm=est.permissoes;A.revs={};for(const k in est.arquivos)A.revs[k]=est.arquivos[k].rev;A.versao=est.versao;
if(A.role=='admin'&&!est.usuario.ambientes)A.env=null;else{const ab=A.perm.abas,e=[];if(ab.some(x=>BOTMAKER.includes(x)))e.push('b');if(ab.includes('olos'))e.push('o');if(ab.includes('hubspot'))e.push('h');if(ab.includes('buscar'))e.push('s');A.env=e.length&&e.length<4?e:null}}
function parar(html){mn.innerHTML='<div class="c w" style="margin:40px;max-width:640px"><h3>Atenção</h3>'+html+'<p><button id="sairx">Sair</button></p></div>';const s=document.getElementById('sairx');if(s)s.onclick=()=>A.out()}
let est=null,msg='';try{msg=localStorage.getItem('msglogin')||'';localStorage.removeItem('msglogin')}catch(e){}
try{const sv=localStorage.getItem('sess2');if(sv){A.tok=sv;const r=await F0(API+'/estado',{headers:{Authorization:'Bearer '+sv},cache:'no-store'});if(r.ok)est=await r.json();else A.tok=''}}catch(e){A.tok=''}
while(!est){await loginUI(msg);msg='';const r=await F0(API+'/estado',{headers:{Authorization:'Bearer '+A.tok},cache:'no-store'});if(r.ok)est=await r.json();else{let j={};try{j=await r.json()}catch(e){}msg=j.erro||'Não foi possível entrar.';A.tok=''}}
try{localStorage.setItem('sess2',A.tok)}catch(e){}
aplicar(est);
let txt=null;try{let t;try{t=await A.get('data')}catch(e){if(e.status==403){parar('<p>Seu perfil não tem acesso aos dados deste painel. Peça ao administrador para liberar as guias.</p>');return}throw e}
if(!t){parar('<p>O servidor ainda não tem os dados do painel.</p><p>O administrador deve usar o botão <b>Migrar para o servidor novo</b> no site atual (ou importar as bases e publicar).</p>');return}
txt=await A.dec(b64d(t).buffer);window.__BOOT=JSON.parse(txt);txt=null}catch(e){mn.innerHTML='<div class="c w" style="margin:40px"><h3>Não foi possível carregar os dados</h3><p>Verifique a conexão e tente de novo. Detalhe: '+e.message+'</p></div>';return}
const s=document.createElement('script');s.textContent=document.getElementById('app').textContent;document.body.appendChild(s);
/* ---------- menus e botões conforme o perfil ---------- */
const ROT={data:'Importar bases',consimp:'Importar consumo',stat:'Importar status'};
function gate(){document.querySelectorAll('aside a[data-p]').forEach(a=>{const p=a.dataset.p;let ok=p=='usr'?A.role=='admin':A.guia(p);if(ok&&['data','consimp','stat'].includes(p)&&!A.can('importar'))ok=false;a.style.display=ok?'':'none'});const on=document.querySelector('aside a[data-p].on');if(!on||on.style.display=='none'){const f=[...document.querySelectorAll('aside a[data-p]')].find(a=>a.style.display!='none');if(f)try{f.click()}catch(e){}}}
setTimeout(gate,0);setTimeout(gate,800);setTimeout(gate,3000);
/* ---------- trocar a própria senha ---------- */
function senhaModal(){const m=document.createElement('div');m.style.cssText='position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.5);display:grid;place-items:center;padding:16px';m.innerHTML='<div class="c" style="background:#fff;color:#0f172a;border-radius:12px;padding:20px;max-width:360px;width:100%"><h3 style="margin:0 0 10px">Alterar minha senha</h3><label style="display:block;margin-bottom:8px">Senha atual<input id="spa" type="password" style="width:100%"></label><label style="display:block;margin-bottom:8px">Nova senha (mín. 8)<input id="spn" type="password" style="width:100%"></label><div id="spe" style="color:#d81824;min-height:18px;font-size:12.5px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="spc">Cancelar</button><button id="spo">Salvar</button></div></div>';document.body.appendChild(m);m.querySelector('#spc').onclick=()=>m.remove();m.querySelector('#spo').onclick=async()=>{try{const r=await A.j('/trocar-senha',{method:'POST',body:{atual:m.querySelector('#spa').value,nova:m.querySelector('#spn').value}});A.tok=r.token;localStorage.setItem('sess2',A.tok);m.remove();alert('Senha alterada.')}catch(e){m.querySelector('#spe').textContent=e.message}}}
window.senhaModal=senhaModal;
setTimeout(()=>{const sl=document.querySelector('#sairl');if(sl&&sl.parentElement&&!document.getElementById('pwa')){const a=document.createElement('a');a.id='pwa';a.className=sl.parentElement.className;a.style.cursor='pointer';a.textContent='Alterar minha senha';a.onclick=senhaModal;sl.parentElement.parentElement.insertBefore(a,sl.parentElement)}},900);
/* ---------- o que o administrador muda aparece para todos, sem recarregar ---------- */
function toast(t){let d=document.getElementById('srvtoast');if(!d){d=document.createElement('div');d.id='srvtoast';d.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483002;background:#00213d;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.3)';document.body.appendChild(d)}d.textContent=t}
const sujo=()=>{try{return !!(typeof DIRTY!='undefined'&&DIRTY)||!!(typeof PUBBUSY!='undefined'&&PUBBUSY)}catch(e){return false}};
let pendente=false;
async function sondar(){if(document.hidden&&!pendente)return;try{const r=await F0(API+'/estado',{headers:{Authorization:'Bearer '+A.tok},cache:'no-store'});if(r.status==401||r.status==403){A.expired();return}if(!r.ok)return;const e=await r.json();if(e.versao===A.versao&&!pendente)return;
const perm=JSON.stringify(e.permissoes)!==JSON.stringify(A.perm)||e.usuario.perfil!==A.perfil;const dados=['data','rc','meta'].some(k=>(e.arquivos[k]||{}).rev!==(A.revs[k]));
if(perm||dados){if(sujo()){pendente=true;toast('Há dados novos publicados. Publique ou descarte o que está pendente e recarregue a página.');return}pendente=false;toast(perm?'Suas permissões foram atualizadas…':'Novos dados publicados. Atualizando…');setTimeout(()=>location.reload(),1200);return}
A.versao=e.versao;try{if(typeof pubPoll=='function')pubPoll()}catch(x){}}catch(x){}}
setInterval(sondar,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sondar()});
})();
