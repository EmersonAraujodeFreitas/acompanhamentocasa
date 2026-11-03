
/* ---------- Atualizar pela API da Botmaker (botão no topo; a importação manual continua igual) ---------- */
(()=>{
const UNN={UJ:'Unijorge',UVA:'UVA'},PER=[['Hoje e ontem',2],['Últimos 7 dias',7],['Últimos 15 dias',15],['Últimos 30 dias',30]];
let EST=null,TM=null,BUSY=0,MODAL=null;
const e_=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pode=()=>{try{return AUTH.role!='viewer'&&AUTH.guia('data')&&AUTH.can('importar')}catch(e){return false}};
const csv=(rows)=>{if(!rows||!rows.length)return'';const cols=[];rows.forEach(r=>Object.keys(r).forEach(k=>{if(!cols.includes(k))cols.push(k)}));const q=v=>{if(v==null)return'';v=String(v);return/[;"\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};return '﻿'+cols.map(q).join(';')+'\n'+rows.map(r=>cols.map(c=>q(r[c])).join(';')).join('\n')};
const dh=iso=>{if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
async function estado(){try{EST=await AUTH.j('/botmaker/estado')}catch(e){EST={fase:'ocioso',erro:e.message}}return EST}
function css(){if(document.getElementById('apicss'))return;const c=document.createElement('style');c.id='apicss';c.textContent='#apib{margin-left:10px;display:none;align-items:center;gap:6px;border:1px solid var(--ac,#00487f);background:var(--ac,#00487f);color:#fff;border-radius:8px;padding:6px 12px;font:600 13px inherit;cursor:pointer}#apib:disabled{opacity:.6;cursor:wait}#apib svg{width:15px;height:15px}#apim{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.5);display:grid;place-items:center;padding:16px}#apim .b{width:min(560px,100%);max-height:88vh;overflow:auto;background:var(--sf,#fff);color:var(--tx,#0f172a);border-radius:12px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.3)}#apim h3{margin:0 0 6px}#apim .pg{height:10px;background:rgba(127,127,127,.2);border-radius:6px;overflow:hidden;margin:10px 0}#apim .pg i{display:block;height:100%;background:var(--ac,#00487f);transition:width .4s}#apim label{display:block;margin:8px 0;font-size:13px}#apim select{max-width:none}#apim .ac{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}#apim .ok{color:#15803d}#apim .er{color:#b91c1c}#apim small{color:var(--mu,#64748b)}';document.head.appendChild(c)}
function botao(){css();let b=document.getElementById('apib');if(!b){const host=document.getElementById('psw');if(!host)return;b=document.createElement('button');b.id='apib';b.type='button';b.title='Busca na API da Botmaker os dados mais recentes, sem precisar exportar relatórios';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg><span>Atualizar via API</span>';b.onclick=abrir;host.appendChild(b)}
  const mostra=pode()&&document.getElementById('psw')&&!document.body.classList.contains('olos');b.style.display=mostra?'inline-flex':'none'}
function fechar(){if(BUSY)return;clearInterval(TM);TM=null;if(MODAL){MODAL.remove();MODAL=null}}
function tela(){
  if(!MODAL)return;const s=EST||{fase:'ocioso'},ativo=['iniciado','lendo','enviando'].includes(s.fase),pronto=s.fase=='pronto';
  const cfg=s.configurado!==false;
  let h='<h3>Atualizar pela API da Botmaker</h3><small>A importação manual continua disponível em <b>Importar bases</b>. O consumo do WhatsApp continua só por importação.</small>';
  if(!cfg)h+='<p class="er">O servidor ainda não está configurado para disparar o robô (faltam <b>GH_TOKEN</b> e <b>GH_REPO</b> no Worker). Veja o passo a passo no guia.</p>';
  if(ativo||BUSY){h+='<p><b>'+e_(BUSY?(s.mensagem||'Trabalhando…'):s.mensagem||'Em andamento…')+'</b></p><div class="pg"><i style="width:'+Math.max(5,s.pct||5)+'%"></i></div><small>Iniciado por '+e_(s.por||'')+' em '+dh(s.em)+'. Pode levar alguns minutos: o robô espera o limite da Botmaker entre algumas leituras.</small>'}
  else{
    if(s.fase=='erro')h+='<p class="er">A última tentativa falhou: '+e_(s.mensagem)+'</p>';
    if(pronto)h+='<div class="c" style="padding:10px;margin:10px 0"><b>Há dados novos prontos</b> ('+dh(s.pronto_em)+') · '+Object.entries(s.contagem||{}).map(([u,x])=>UNN[u]+': '+x.sess+' sessões, '+x.conv+' conversas, '+x.prod+' status').join(' · ')+'<div class="ac"><button id="apiimp">Importar agora</button></div></div>';
    h+='<label>Período a buscar<select id="apidias">'+PER.map(p=>'<option value="'+p[1]+'">'+p[0]+'</option>').join('')+'</select></label><label><input type="checkbox" id="apiag"> Incluir Métricas por atendente <small>(substitui a base de atendentes de cada universidade pelo período buscado)</small></label>';
    if(s.fase=='importado')h+='<p class="ok">Última importação por API: '+dh(s.importado_em)+'.</p>'}
  h+='<div class="ac">'+(ativo||BUSY?'':'<button id="apigo"'+(cfg?'':' disabled')+'>Buscar e importar</button>')+'<button id="apifx" class="sec"'+(BUSY?' disabled':'')+'>Fechar</button></div>';
  MODAL.firstChild.innerHTML=h;
  const g=id=>MODAL.querySelector('#'+id);
  if(g('apifx'))g('apifx').onclick=fechar;
  if(g('apigo'))g('apigo').onclick=iniciar;
  if(g('apiimp'))g('apiimp').onclick=()=>importar(!!(g('apiag')&&g('apiag').checked));
}
async function abrir(){if(MODAL)return;css();MODAL=document.createElement('div');MODAL.id='apim';MODAL.innerHTML='<div class="b"></div>';MODAL.addEventListener('click',ev=>{if(ev.target==MODAL)fechar()});document.body.appendChild(MODAL);await estado();tela();acompanhar()}
function acompanhar(){clearInterval(TM);TM=setInterval(async()=>{if(!MODAL){clearInterval(TM);return}if(BUSY)return;const antes=EST&&EST.fase;await estado();if(['iniciado','lendo','enviando'].includes(EST.fase)||antes!=EST.fase)tela();else if(MODAL&&EST.fase=='pronto'&&!MODAL.querySelector('#apiimp'))tela();
  if(antes&&['iniciado','lendo','enviando'].includes(antes)&&EST.fase=='pronto'&&MODAL&&MODAL.dataset.auto)importar(!!MODAL.dataset.ag)},4000)}
async function iniciar(){const g=id=>MODAL.querySelector('#'+id),dias=+g('apidias').value,ag=g('apiag').checked;MODAL.dataset.auto='1';MODAL.dataset.ag=ag?'1':'';
  try{EST=await AUTH.j('/botmaker/atualizar',{method:'POST',body:{dias}});EST.configurado=true}catch(e){EST=Object.assign({},EST||{},{fase:'erro',mensagem:e.message,configurado:EST&&EST.configurado})}tela()}
async function importar(comAgente){
  if(BUSY)return;BUSY=1;const msg=(t,p)=>{EST=Object.assign({},EST,{mensagem:t,pct:p});tela()};
  try{
    msg('Baixando os dados do servidor…',10);
    const t=await AUTH.get('api-fila');if(!t)throw new Error('O servidor não tem dados do robô ainda.');
    const D=JSON.parse(await AUTH.dec(AUTH.b64d(t).buffer)),us=Object.keys(D.contas||{});
    if(!us.length)throw new Error('O robô não trouxe nenhuma universidade.');
    if(D.falhas&&D.falhas.length)console.warn('Falhas do robô:',D.falhas);
    const md=document.getElementById('md');if(typeof go=='function'&&!md){go('data');await new Promise(r=>setTimeout(r,400))}
    const sel=document.getElementById('md');if(sel)sel.value='per';
    let i=0;
    for(const u of us){
      const c=D.contas[u],fl=[];
      const mk=(tipo,rows)=>{if(rows&&rows.length)fl.push(new File([csv(rows)],'API-'+u+'-'+tipo+'.csv',{type:'text/csv'}))};
      mk('conversa',c.conv);mk('produtividade',c.prod);mk('sessoes',c.sess);if(comAgente)mk('atendente',c.agente);
      if(!fl.length)continue;
      msg('Importando '+UNN[u]+' ('+(c.sess.length)+' sessões, '+(c.conv.length)+' conversas)…',30+Math.round(60*i/us.length));
      await load(fl,u);i++;
    }
    try{await AUTH.j('/botmaker/progresso',{method:'POST',body:{fase:'importado',mensagem:'Importado',pct:100}})}catch(e){}
    BUSY=0;EST=Object.assign({},EST,{fase:'importado',importado_em:new Date().toISOString(),mensagem:''});tela();
    try{const l=document.getElementById('lg');if(l){l.style.display='inline-block'}}catch(e){}
  }catch(e){BUSY=0;EST=Object.assign({},EST,{fase:'erro',mensagem:e.message});tela()}
}
window.apiAtualizar=abrir;
setInterval(()=>{try{botao()}catch(e){}},1000);
setTimeout(botao,300);setTimeout(botao,1500);setTimeout(botao,4000);
})();
