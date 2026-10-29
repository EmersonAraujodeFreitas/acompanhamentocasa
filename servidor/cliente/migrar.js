/* Migração única: o administrador, já logado no site atual, envia os dados (descriptografados na memória) ao servidor novo. */
(()=>{
const API=__API__,CH=600000,NOMES=[['data.json','data'],['rc.json','rc'],['meta.json','meta'],['olos.json','olos'],['olos-meta.json','olos-meta'],['jb.json','jb'],['analise.json','analise']];
const b64=u=>{let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
async function gz(t){return new Uint8Array(await new Response(new Blob([new TextEncoder().encode(t)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())}
window.__migrar=async function(get,usuario,senha,log){
 const jr=async(p,o,tk)=>{const r=await fetch(API+p,Object.assign({cache:'no-store'},o,{headers:Object.assign({'Content-Type':'application/json'},tk?{Authorization:'Bearer '+tk}:{},(o&&o.headers)||{})}));let j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.erro||('Erro '+r.status));return j};
 const e=await jr('/entrar',{method:'POST',body:JSON.stringify({usuario,senha})});if(e.usuario.trocarSenha)throw new Error('Entre primeiro no site novo (/v2/) e troque a senha provisória.');if(e.usuario.perfil!='Administrador')throw new Error('Use um usuário Administrador.');
 const tk=e.token;let n=0;
 for(const[orig,nome]of NOMES){log('Lendo '+orig+'…');const t=await get(orig);if(t==null){log(orig+': não existe, pulando.');continue}
  const txt=b64(await gz(t)),rev=Date.now(),de=Math.max(1,Math.ceil(txt.length/CH));
  for(let i=0;i<de;i++){const r=await fetch(API+'/arquivo/'+nome+'?rev='+rev+'&n='+i+'&de='+de,{method:'PUT',headers:{Authorization:'Bearer '+tk,'Content-Type':'text/plain'},body:txt.slice(i*CH,(i+1)*CH)});if(!r.ok){let j={};try{j=await r.json()}catch(x){}throw new Error(orig+': '+(j.erro||r.status))}log(orig+': enviado '+(i+1)+'/'+de)}
  n++}
 await jr('/admin/publicar',{method:'POST',body:'{}'},tk);return n};
/* botão (só para administrador, no site atual) */
if(window.AUTH&&AUTH.dec&&!window.__migBtn){window.__migBtn=1;const t=setInterval(()=>{if(!(window.AUTH&&AUTH.role=='admin'&&document.querySelector('aside')))return;clearInterval(t);
 const b=document.createElement('button');b.textContent='Migrar para o servidor novo';b.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9999;padding:8px 12px;border-radius:8px;border:1px solid #00487f;background:#fff;color:#00487f;cursor:pointer;font-size:12px';document.body.appendChild(b);
 b.onclick=async()=>{const u=prompt('Usuário ADMINISTRADOR do servidor novo (ex.: EMERSON). Ele precisa já ter entrado no site novo e trocado a senha.');if(!u)return;const s=prompt('Senha desse usuário:');if(!s)return;b.disabled=true;const say=m=>{b.textContent=m};
  try{const n=await window.__migrar(async f=>{const r=await fetch(f+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)return null;return AUTH.dec(await r.arrayBuffer())},u,s,say);say('Pronto: '+n+' arquivos enviados');alert('Migração concluída ('+n+' arquivos). Agora abra o site novo e confira.')}catch(e){say('Falhou: '+e.message);b.disabled=false;alert('Falhou: '+e.message)}}},1500)}
})();
