
/* ===== APRESENTAÇÃO (slides ao vivo, por mês ou semana, exportáveis em PPTX) ===== */
(()=>{
const C={navy:'00213D',yel:'F5B800',slate:'4A5D73',blue:'00487F',line:'D3DEEB',red:'C8102E',bg:'EEF3F9',card:'FBFDFF',soft:'9DB8D8',cream:'FFF7DC',white:'FFFFFF'};
const UL={UJ:'Unijorge',UVA:'UVA'},MES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],MS=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1=x=>x==null||!isFinite(x)?'–':x.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const pc=x=>x==null||!isFinite(x)?'–':f1(x*100)+'%';
const nf=x=>Math.round(x||0).toLocaleString('pt-BR');
const dmy=d=>d.split('-').reverse().join('/');
const ST={modo:'mes',org:'S',de:'',ate:'',txt:{}};
try{Object.assign(ST.txt,JSON.parse(localStorage.getItem('pres_txt')||'{}'))}catch(e){}
const TX=(k,d)=>ST.txt[k]!=null&&ST.txt[k]!==''?ST.txt[k]:d;

/* ---------- períodos ---------- */
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function periodos(){
  const ds=SR.map(x=>x.d).filter(Boolean).sort();if(!ds.length)return[];
  const min=ds[0],max=ds[ds.length-1],P=[];
  if(ST.modo=='mes'){let [y,m]=min.slice(0,7).split('-').map(Number);const [y2,m2]=max.slice(0,7).split('-').map(Number);while(y<y2||(y==y2&&m<=m2)){const k=y+'-'+String(m).padStart(2,'0');P.push({k,label:MES[m-1],curto:MS[m-1],a:k+'-01',b:k+'-31'});m++;if(m>12){m=1;y++}}}
  else{const d=new Date(min+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));const fim=new Date(max+'T12:00:00');while(d<=fim){const a=isoD(d),e=new Date(d);e.setDate(e.getDate()+6);const b=isoD(e);P.push({k:a,label:'Sem '+dmy(a).slice(0,5),curto:dmy(a).slice(0,5)+'–'+dmy(b).slice(0,5),a,b});d.setDate(d.getDate()+7)}}
  const ini=ST.de||P[Math.max(0,P.length-(ST.modo=='mes'?3:8))].a,fi=ST.ate||max;
  const r=P.filter(p=>p.b>=ini&&p.a<=fi);return r.length?r:P.slice(-3);
}
const okOrg=x=>ST.org=='T'||(ST.org=='S'?x.ar=='S':x.ar=='A');
const GRUPOS_MOTIVO=g=>!['Sem tipificação','Abandono','Resolvido pelo robô'].includes(g);
/* arredonda em 0,1% garantindo soma exata de 100% (maior resto) */
const a100=v=>{const t=v.reduce((s,x)=>s+x,0);if(!t)return v.map(()=>0);const r=v.map(x=>x/t*1000),f=r.map(Math.floor);let k=1000-f.reduce((s,x)=>s+x,0);r.map((x,i)=>[x-f[i],i]).sort((a,b)=>b[0]-a[0]).slice(0,k).forEach(([_,i])=>f[i]++);return f.map(x=>x/1000)};
/* catálogo oficial de tipificações do consultor (exportação da Botmaker em 04/11/2026): código → nome "Categoria - Detalhe" */
const CAT=[["usu�rio_parou_de_interagir","Improdutiva - usuario parou de interagir"],["finalizou_sem_atendimento","Improdutiva - agente finalizou sem atendimento"],["Imp._Neg�cio_J�_�_aluno","Imp. Negócio - Já e aluno"],["J�_est�_matriculado_Calouro","Imp. Negócio - Já esta matriculado - Calouro"],["Aluno_de_Outra_Institui��o","Recusa - Aluno de Outra Instituição"],["Curso_N�o_Fechou_Turma","Imp. Negócio - Curso Não Fechou Turma"],["Curso_Indispon�vel","Imp. Negócio - Curso Indisponível"],["Aceite_Fez_a_inscri��o","Aceite - Fez a inscricao"],["Aceite_Aceitou_o_contrato","Aceite - Aceitou o contrato"],["Aceite_Pagou_boleto_cart�o","Aceite - Pagou boleto - cartão"],["Aceite_Pagou_boleto","Aceite - Pagou boleto"],["Vai_realizar_inscri��o","Potencial - Vai realizar inscricao"],["Vai_analisar_a_proposta","Potencial - Vai analisar a proposta"],["dar_aceite_no_contrato","Potencial - Vai dar aceite no contrato"],["Vai_realizar_pagamento","Potencial - Vai realizar pagamento"],["Recusa_Achou_Caro","Recusa - Achou Caro"],["Hor�rio_Local_Incompat�vel","Recusa - Horário e/ou Localização Incompatível"],["Recusa_Sa�de_Gravidez_Rotina","Recusa - Saúde, Gravidez, Rotina"],["Curso_n�o_disp_na_modalidade","Recusa - Curso não disponivel na modalidade"],["Programas_Governamentais","Recusa - Programas Governamentais - SISU | PROUNI | FIES"],["Recusa_Resultado_Enem","Recusa - Resultado Enem"],["Recusa_Desempregado","Recusa - Desempregado"],["Insatisfeito_com_Atendimento","Recusa - Insatisfeito com Atendimento (Casa, Polo, Campus)"],["Refer�ncia_Negativa_da_IES","Recusa - Referência Negativa da IES"],["Informa��es_gerais","Informações - curso, valores, bolsas e porta de entrada"],["Info_portal_do_ingressante","Informações - portal do ingressante"],["Info_D�vidas_financeira","Informações - Dúvidas Financeiras - Boleto"],["Informa��es_Conv�nios","Informações - Convênios"],["Informa��es_Documentos","Informações - Documentos"],["Informa��es_Polos_e_Campi","Informações - Polos e Campi"],["Info_Reembolso_n�o_enturmado","Informações - Reembolso não enturmado"],["Solicita��es_Cancelamento","Solicitações - Cancelamento"],["Info_Resultado_de_Inscri��o","Informações - Resultado de Inscrição"],["Blacklist","Não deseja mais receber mensagens WhatsApp"],["Imp_Neg_outros_setores","Imp. Negócio - Outros Setores - Servico, academico, etc"],["Potencial_matricula_presencial","Potencial_matricula_presencial"],["Improdutiva_teste","Improdutiva - Teste"],["Imp_Neg_Nao_tem_Ensino_Medio","Imp. Negócio - Não tem Ensino Médio"],["Improdutiva_Numero_incorreto","Improdutiva - Número de contato incorreto"],["Recusa_Pendencia_Financeira","Recusa - Pendencia Financeira"],["Recusa_Inter_proximo_semestre","Recusa - Interessado no Próximo Semestre"],["crivo-aceitou-oferta","crivo-aceitou-oferta"],["crivo-cancelamento","crivo-cancelamento"],["ACA-DisciplinaNaoDisponivel","Acadêmico - Disciplinas não disponibilizadas"],["ACA-Insercao/AjusteGrade","Acadêmico - Inserção/Ajuste grade"],["ACA-InsatisfacaoCoordenadores","Acadêmico - Insatisfação com Coordenadores/Supervisores"],["ACAs-NaoChegouCursar","Acadêmicos - Não chegou a cursar"],["ACAs-ProtocoloEmAndamento","Acadêmicos - Protocolo em andamento"],["ACAs-ProtocoloAtrasado","Acadêmicos - Protocolo atrasado"],["ACAs-Documentacao","Acadêmicos - Documentação"],["ACAs-Trancamento/Cancelamento","Acadêmicos - Trancamento/Cancelamento"],["ACA-DesistiuDoCancelamento","Acadêmicos - Desistiu do cancelamento/Trancamento"],["ACA-AguardandoSegundaChamada","Acadêmicos - Aguardando segunda chamada"],["ACA-AguardandoPostagemNota","Acadêmicos - Aguardando postagem de nota"],["ACA-Outros","Acadêmicos - Outros"],["FIN-AceitouNegociacao","Financeiro - Aceitou negociação"],["FIN-AguardandoReceberSalario","Financeiro - Aguardando receber salário"],["FIN-CobrancaIndevida","Financeiro - Cobrança indevida"],["FIN-AumentoMensalidade","Financeiro - Aumento da mensalidade/reajuste"],["FIN-VaiPagar","Financeiro - Vai pagar"],["FIN-JaPagou","Financeiro - Já pagou"],["FIN-AguardandoFinanciamento","Financeiro - Aguardando financiamento"],["FIN-ProtocolosDeContestacao","Financeiro - Aguardando Protocolos de contestação"],["FIN-AguardaFecharFaturaCartao","Financeiro - Aguarda fechar fatura do cartão"],["FIN-DesejaOutroPlanoPagamento","Financeiro - Deseja outro plano de pagamento"],["FIN-PerdeuProuni/Fies/Bolsa","Financeiro - Perdeu prouni/fies/bolsa especial"],["FIN-NaoAceitouNegociacao","Financeiro - Não aceitou negociação"],["FIN-Desempregado","Financeiro - Desempregado"],["FIN-NaoTemCondicoesPagar","Financeiro - Não tem condições de pagar"],["FIN-ReducaoBolsa","Financeiro - Redução da bolsa"],["FIN-Outros","Financeiro - Outros"],["CON-AguardandoSisfiesCorrigir","Convênio - Aguardando tratativa do SISFIES para Corrigir"],["CON-AguardandoSisfiesDilatar","Convênio - Aguardando tratativa do SISFIES para dilatar"],["CON-AguardandoSisfiesValidar","Convênio - Aguardando tratativa do SISFIES para Validar"],["CON-JaFezDilatacao","Convênio - Já fez a dilatação"],["CON-JaEntregouDocumentacao","Convênio -Já entregou documentação"],["CON-ProblemasComDocumentacao","Convênio - Problemas com a documentação"],["CON-JaFezAditamento","Convênio - Já fez aditamento"],["CON-JaFezPgtoCoparticipacao","Convênio - Já realizou pagamento coparticipação"],["CON-NaoConsegueAditamentoFies","Convênio - Não consegue realizar aditamento do FIES"],["CON-OptouPeloPravaler","Convênio - Optou pelo PRAVALER"],["CON-AlunoDesistente","Convênio - Aluno desistente"],["CON-Outros","Convênio - Outros"],["REM-AlunoFaraRematricula","Rematrícula - Aluno fará a rematrícula"],["REM-Rematriculado","Rematrícula - Rematriculado"],["REM-VaiPensar","Rematrícula - Vai pensar"],["REM-AlunoInformaQueJaPagou","Rematrícula - Aluno informa que já pagou"],["REM-AlunoDesistente","Rematrícula - Aluno desistente"],["REM-AlteracaoVencimentoBoleto","Rematrícula - Alteração do vencimento do boleto"],["REM-Financeiro","Rematrícula - financeiro"],["REM-InteressadoProximoSemestre","Rematrícula - Interessado no próximo semestre"],["REM-OutraIes","Rematrícula - Outra IES"],["REM-Concluinte","Rematrícula - Concluinte"],["REM-FazerInscricaoDisciplina","Rematrícula - Vai fazer inscrição das disciplinas"],["REM-InscricaoDisciplinasLinha","Rematrícula - Realizou inscrição das disciplinas em linha"],["REM-VaiRealizarAceite","Rematrícula - Vai realizar o Aceite"],["REM-RealizouAceiteEmLinha","Rematrícula - Realizou aceite em linha"],["REM-AlunoCanceladoOuTrancado","Rematrícula - Aluno Cancelado ou Trancado"],["REM-Outros","Rematrícula - Outros"],["REA-VaiPensar","Reabertura - Vai pensar"],["REA-AlunoInformaQueJaPagou","Reabertura - Aluno informa que já pagou"],["REA-AlunoDesistente","Reabertura - Aluno desistente"],["REA-AlteracaoVencimentoBoleto","Reabertura - Alteração do vencimento do boleto"],["REA-GradeCurricular","Reabertura - Grade curricular/tempo para se formar"],["REA-InteressadoProximoSemestre","Reabertura - Interessado no próximo semestre"],["REA-OutraIes","Reabertura - Outra IES"],["REA-Concluinte","Reabertura - Concluinte"],["REA-Formado","Reabertura - Formado"],["REA-FazerInscricaoDisciplina","Reabertura - Vai fazer inscrição das disciplinas"],["REA-InscricaoDisciplinasLinha","Reabertura - Realizou inscrição das disciplinas em linha"],["REA-VaiRealizarAceite","Reabertura - Vai realizar o Aceite"],["REA-RealizouAceiteEmLinha","Reabertura - Realizou aceite em linha"],["REA-Outros","Reabertura - Outros"],["PES-NaoDesejaVoltarEstudar","Pessoais - Não deseja voltar a estudar"],["PES-NaoPossuiTempoParaEstudar","Pessoais - Não possui tempo para estudar"],["PES-NaoSeAdaptou","Pessoais - Não se adaptou"],["PES-Gestante","Pessoais - Gestante"],["PES-HorarioTrabNaoCompativel","Pessoais - Horário de trabalho não é compatível"],["PES-Distancia","Pessoais - Distância"],["PES-Doenca","Pessoais - Doença"],["PES-Mudanca","Pessoais - Mudança"],["PES-Falecido","Pessoais - Falecido"],["PES-NaoDesejaReceberLigacoes","Pessoais - Não deseja receber mais ligações"],["PES-Outros","Pessoais - Outros"],["Blacklist_n�o_me_contate_mais","Não me contate mais"],["IMP-Encerradoem24Hrs","Improdutiva - Encerrado dentro das 24 Horas"],["Financeiro-Boletoindispon�vel","Financeiro - Boleto indisponível"],["matr�cula_Prouni/Fies","Potencial - Vai realizar matrícula Prouni/Fies"],["Men��o","Menção"],["Coment�rio-negativo-IES","Comentário negativo sobre a IES"],["P�s-gradua��o","Pós graduação"],["Acad�mico-Hist�ricoEscolar","Acadêmico - Histórico Escolar"],["Acad�mico?Declara��es","Acadêmico – Declarações"],["Acad�mico?Certid�es","Acadêmico – Certidões"],["Acad�mico?Diploma","Acadêmico – Diploma"],["Informa��es?PortaldoAluno/Aces","Informações – Portal do Aluno / Acessos"],["Men��onosStorys-Instagram","Menção nos Storys - Instagram"],["Pos-ACA-DiscipNaoDisponivel","Pós-Acadêmico - Disciplinas Não disponibilizadas"],["Pos-ACA-Insercao/AjusteGrade","Pós-Acadêmico - Inserc–o/Ajuste grade"],["Pos-ACA-InsatisCoordenadores","Pós-Acadêmico - Insatisfac–o com Coordenadores/Supervisores"],["Pos-ACAs-ProtocoloEmAndamento","Pós-Acadêmicos - Protocolo em andamento"],["Pos-ACAs-ProtocoloAtrasado","Pós-Acadêmicos - Protocolo atrasado"],["Pos-ACAs-Documentacao","Pós-Acadêmicos - Documentac–o"],["Pos-ACAs-Tranca/Cancelamento","Pós-Acadêmicos - Trancamento/Cancelamento"],["Pos-ACA-AguardandoPostagemNota","Pós-Acad–micos - Aguardando postagem de nota"],["Pos-ACA-Outros","Pós-Acad–micos - Outros"],["Pos-FIN-AceitouNegociacao","Pós-Financeiro - Aceitou negociac–o"],["Pos-FIN-CobrancaIndevida","Pós-Financeiro - Cobrança indevida"],["Pos-FIN-AumentoMensalidade","Pós-Financeiro - Aumento da mensalidade/reajuste"],["Pos-FIN-VaiPagar","Pós-Financeiro - Vai pagar"],["Pos-FIN-JaPagou","Pós-Financeiro - Já pagou"],["Pos-FIN-ProtoDeContestacao","Pós-Financeiro - Aguardando Protocolos de contestac–o"],["Pos-FIN-NaoAceitouNegociacao","Pós-Financeiro - Não aceitou negociac–o"],["Pos-FIN-Desempregado","Pós-Financeiro - Desempregado"],["Pos-FIN-NaoTemCondicoesPagar","Pós-Financeiro - Não tem condic–es de pagar"],["Pos-FIN-Outros","Pós-Financeiro - Outros"],["Pos-Info_portal_do_ingressante","Pós-Informações - portal do ingressante"],["Pos-Info_D?vidas_financeira","Pós-Informações - Dúvidas Financeiras - Boleto"],["Pos-Informa??es_Documentos","Pós-Informações - Documentos"],["Pos-Infor_Polos_e_Campi","Pós-Informações - Polos e Campi"],["Pos-PES-Gestante","Pós-Pessoais - Gestante"],["Pos-PES-HrTrabNaoCompativel","Pós-Pessoais - Horário de trabalho Não – compatível"],["Pos-PES-Doenca","Pós-Pessoais - Doença"],["Pos-PES-Mudanca","Pós-Pessoais - Mudança"],["Pos-PES-Falecido","Pós-Pessoais - Falecido"],["Pos-PES-NaoDesRecebLigacoes","Pós-Pessoais - Não deseja receber mais ligac–es"],["Pos-PES-Outros","Pós-Pessoais - Outros"],["Pos-Impro_ultrapassou24horas","Pós-Improdutiva - Ultrapassou 24 horas"],["Pos-Comentarionaspostagens","Pós-Improdutiva - Comentario nas postagens"],["Coment�rio-Instagram","Comentário-Instagram"],["AtendimentonoCorporativo","Atendimento no Corporativo"],["REA-Alunofar�areabertura","Reabertura - Aluno fará a reabertura"]];
const CATX=CAT.map(([id,nm])=>({nm,re:new RegExp('^'+id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\ufffd?]/g,'').replace(/\ufffd/g,'[a-z]').replace(/\?/g,'[a-z]{0,2}')+'$')})),CATC=new Map();
const IMPROD=/improdut|encerrad|ultrapassou|\b24 ?h|parou de interagir|usuario parou|inatividade|automatic|sem atendimento|teste\b/;
function catTema(nm){const l=nz(nm).replace(/^pos-/,''),p=l.split(' - ')[0].trim();
  if(/^improdutiva/.test(p))return null;
  if(/trancamento|cancelamento|desistiu/.test(l))return'Cancelamento';
  if(/duvidas financeiras|^financeiro|^convenio|boleto indisponivel/.test(l))return'Financeiro';
  if(/^academic/.test(p))return'Acadêmico';
  if(/^informacoes/.test(p))return'Informações';
  if(/^rematricula|^reabertura|^aceite|^potencial|matricula prouni/.test(l))return'Rematrícula';
  return'Outros temas'}
function catInfo(t){if(t==null)return null;const k=nz(t).replace(/[^a-z0-9]/g,'');if(!k)return null;if(CATC.has(k))return CATC.get(k);let r=null;for(const c of CATX)if(c.re.test(k)){r={nm:c.nm,tema:catTema(c.nm)};break}CATC.set(k,r);return r}
const EMO={'Outros temas':'➕','Acadêmico':'🎓','Financeiro':'💰','Informações gerais':'💬','Rematrícula':'📝','Cancelamento':'🚪','Cancelamento/Trancamento':'🚪'};
/* classifica o motivo pela própria tipificação (palavras-chave), para não depender do grupo gravado na importação */
function tema(t,g0){const l=nz(t).replace(/[_\-\s]+/g,' ');if(/^inferido /.test(l))return({financeiro:'Financeiro',academico:'Acadêmico',cancelamento:'Cancelamento',rematricula:'Rematrícula',informacoes:'Informações'}[l.slice(9)]||g0);
  if(/boleto|financ|^fin\b|^fin |mensalid|pagament|parcela|fatura|desconto|negocia|ddm|inad|cobranc|bolsa|fies|reembolso/.test(l))return'Financeiro';
  if(/cancel|trancamento|tranca\b|desist/.test(l))return'Cancelamento';
  if(/rematric|matricul|inscri|aceite|prouni|enem|vestibular|calouro|proposta|ingress|^vai |^rea |^rem /.test(l))return'Rematrícula';
  if(/^aca|academ|disciplin|nota|grade|prova|portal|acesso|senha|historico|declaracao|document|estagio|tcc|colacao|diploma|ava\b|plataforma|horario|calendario|aula/.test(l))return'Acadêmico';
  if(/^info|duvida|curso|contato|ouvidoria|polo|endereco|unidade/.test(l))return'Informações';
  return g0&&g0!='Outros temas'?g0:'Outros temas'}
const GNOME={'Informações':'Informações gerais'};
const nz=s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/* nome único para tipificações parecidas (como na apresentação de referência) */
function tipCanon(t){{const li=nz(t);if(/^inferido-/.test(li))return({financeiro:'Financeiro',academico:'Acadêmico',cancelamento:'Cancelamento',rematricula:'Rematrícula',informacoes:'Informações gerais'}[li.slice(9)]||li.slice(9))+' (inferido pelo texto)'}const raw=t==null||/^\(nulo\)$|^notypification$/i.test(String(t))?'Sem tipificação':String(t),l=nz(raw).replace(/[_\-\s]+/g,' ').trim();
  if(/parou.*interagir/.test(l))return'Usuário parou de interagir';
  if(/encerrad[ao].*autom|inatividade/.test(l))return'Encerrada automaticamente';
  if(/24 ?h(rs|oras)?\b|24 ?hr/.test(l))return'Encerrado em 24 h';
  {const ci=catInfo(t);if(ci)return ci.nm.replace(' - ',' – ')}
  if(/pagou boleto/.test(l))return/cartao/.test(l)?'Financeiro – Pagou boleto no cartão':'Financeiro – Pagou boleto (AD)';
  if(/ddm|inad\b/.test(l))return'Financeiro – DDM (INAD)';
  if(/trancamento|cancelamento/.test(l))return'Trancamento / cancelamento';
  if(/^aca/.test(l)&&/incl|excl|insercao|ajuste|disciplin|grade/.test(l))return'Acadêmico – Incl./Excl. disciplinas';
  if(/^info/.test(l)&&/gerais/.test(l))return'Informações gerais';
  if(/^rem\b|rematric/.test(l))return'Rematrícula';
  if(/finalizou sem atendimento/.test(l))return'Finalizou sem atendimento';
  if(/ja (esta|e) (matriculado|aluno)/.test(l))return'Já matriculado';
  return raw.replace(/_/g,' ').replace(/^ACAs?\s*-\s*/i,'Acadêmico – ').replace(/^FIN\s*-\s*/i,'Financeiro – ').replace(/^CON\s*-\s*/i,'Contratos – ').replace(/^REM\s*-\s*/i,'Rematrícula – ')}

/* ---------- números ---------- */
function calcular(P){
  const R={P,un:['UJ','UVA'],per:{},mot:{},tip:{},tot:{},all:{UJ:0,UVA:0,T:0}};
  for(const p of P)for(const u of ['UJ','UVA','T'])R.per[p.k+'|'+u]={n:0,tr:0,msg:0,ab:0};
  for(const x of SR){if(!x.d)continue;const p=P.find(q=>x.d>=q.a&&x.d<=q.b);if(!p)continue;
    if(R.all[x.un]!=null){R.all[x.un]+=x.n;R.all.T+=x.n}
    if(!okOrg(x))continue;
    for(const u of [x.un,'T']){const a=R.per[p.k+'|'+u];if(!a)continue;a.n+=x.n;if(x.o)a.tr+=x.n;a.msg+=(x.u||0)+(x.bt||0)+(x.op||0);if(x.g=='Abandono')a.ab+=x.n}
    const ci=catInfo(x.t),imp=!ci&&IMPROD.test(nz(x.t)),gm=ci?!!ci.tema:(GRUPOS_MOTIVO(x.g)&&!imp),g2=ci?(ci.tema||x.g):(gm?tema(x.t,x.g):x.g);
    {const dg=((R.diag??={})[x.un]??={}),kd=String(x.t==null?'(sem tipificação)':x.t),e=dg[kd]??={n:0,g:x.g,m:g2,mo:gm,nm:ci?ci.nm:''};e.n+=x.n;const cv=((R.cov??={})[x.un]??={tot:0,mot:0,ab:0,sem:0,rob:0,inf:0});cv.tot+=x.n;if(/^inferido-/i.test(String(x.t||'')))cv.inf+=x.n;if(gm)cv.mot+=x.n;else if(x.g=='Abandono'||imp||(ci&&!ci.tema))cv.ab+=x.n;else if(x.g=='Sem tipificação')cv.sem+=x.n;else cv.rob+=x.n}
    if(gm&&g2=='Outros temas'){const o=(R.out??={UJ:{n:0,l:{}},UVA:{n:0,l:{}}})[x.un];if(o){o.n+=x.n;const k=tipCanon(x.t);o.l[k]=(o.l[k]||0)+x.n}}
    if(gm){const mmk=(((R.mm??={})[x.un]??={})[g2]??={});mmk[p.k]=(mmk[p.k]||0)+x.n}
    if(gm){const tgm=((R.tgm??={})[x.un]??={})[g2]??={},kk=tipCanon(x.t);tgm[kk]=(tgm[kk]||0)+x.n;const m=R.mot[g2]??={UJ:0,UVA:0};m[x.un]+=x.n;const t=R.tip[kk]??={n:0,g:g2};t.n+=x.n;const rw=String(x.t==null?'(sem tipificação)':x.t).replace(/_/g,' '),tr=(R.tipr??={})[kk]??={};tr[rw]=(tr[rw]||0)+x.n}}
  return R;
}
const val=(R,p,u,k)=>{const a=R.per[p.k+'|'+u];return !a||!a.n?null:k=='tr'?a.tr/a.n:k=='msg'?a.msg/a.n:k=='ab'?a.ab/a.n:a.n};
/* recorrência: voltas em 24 h, motivo do retorno e última sessão (usa a base de contatos já carregada) */
function retornos(P){
  const a=P[0].a,b=P[P.length-1].b,out={contatos:0,dist:[0,0,0,0,0,0],voltas:0,quemVolta:0,motivo:{},ult:{robo:0,cons:0},ultTip:{},ok:false,semOrg:false};
  for(const u of ['UJ','UVA']){const r=RC[u];if(!r||!r.len||!r.s)continue;out.ok=true;
    const d0=r.d0,da=rcd(a)-d0,db=rcd(b)-d0;let i=0;if(ST.org!='T'&&!r.z)out.semOrg=true;
    for(const n of r.len){const L=[];for(let k=0;k<n;k++){const c=r.s[i+k],z=r.z?r.z.charCodeAt(i+k)-35:0;L.push({day:Math.floor(c/131072),hh:c%32,op:Math.floor(c/256)%2,ti:Math.floor(c/512)%256,z})}i+=n;
      if(ST.org!='T'&&r.z){const z=L[0].z;if(ST.org=='S'?z!=2:z!=1)continue}
      L.forEach(x=>x.h=x.day*24+x.hh);L.sort((x,y)=>x.h-y.h);
      const dentro=L.filter(x=>x.day>=da&&x.day<=db);if(!dentro.length)continue;
      out.contatos++;const h0=dentro[0].h,v=L.filter(x=>x.h>h0&&x.h<=h0+24).length;out.dist[Math.min(5,v)]++;if(v){out.quemVolta++;out.voltas+=v;const ult=dentro[dentro.length-1];if(ult.op){out.ult.cons++;const lb=tipCanon(r.T[ult.ti]);out.ultTip[lb]=(out.ultTip[lb]||0)+1}else out.ult.robo++}
      for(let k=0;k<L.length-1;k++){const x=L[k];if(x.day<da||x.day>db)continue;if(L[k+1].h-x.h<=168){const lb=tipCanon(r.T[x.ti]);out.motivo[lb]=(out.motivo[lb]||0)+1}}}}
  return out;
}

/* ---------- desenho dos slides (um só desenho serve para a prévia e para o PPTX) ---------- */
const card=(x,y,w,h,o={})=>({k:'r',x,y,w,h,fill:o.fill||C.card,line:o.line===undefined?C.line:o.line,r:o.r==null?12:o.r});
const txt=(x,y,w,h,t,o={})=>({k:'t',x,y,w,h,t,size:o.size||14,bold:!!o.bold,color:o.color||C.navy,al:o.al||'l',va:o.va||'m',sp:o.sp||0});
const KE={'MOTIVOS':'💬','TAXA D':'🤝','EFETIV':'⚡','FRENTES':'🎯'};
const cab=(S,kick,tit)=>{kick=(KE[Object.keys(KE).find(k=>kick.startsWith(k))]||'')+' '+kick;S.push(txt(64,40,1150,24,kick,{size:13,bold:1,color:C.blue,sp:2,va:'t'}));S.push(txt(64,66,1150,44,tit,{size:30,bold:1,va:'t'}))};
const leg=(S,x,y,itens)=>{let cx=x;for(const [c,n] of itens){S.push({k:'r',x:cx,y:y+5,w:14,h:14,fill:c,line:null,r:3});S.push(txt(cx+20,y,90,24,n,{size:12,color:C.slate}));cx+=34+n.length*8}};
function slides(R,RT){
  const P=R.P,p0=P[0],pn=P[P.length-1],pa=P[P.length-2]||p0,out=[],ref=(ST.org=='S'?'SERVIÇOS':ST.org=='A'?'ADMISSÃO':'TODOS')+' · '+(P.length>1?p0.curto.toUpperCase()+(ST.modo=='mes'?'–':' → ')+pn.curto.toUpperCase():p0.curto.toUpperCase());
  const orgN=ST.org=='S'?'Serviços':ST.org=='A'?'Admissão':'Todas as sessões';
  /* 1 · motivos de contato */
  {const S=[],tot=u=>P.reduce((s,p)=>s+(R.per[p.k+'|'+u].n),0),mots=Object.entries(R.mot).map(([g,m])=>({g:GNOME[g]||g,UJ:m.UJ,UVA:m.UVA,T:m.UJ+m.UVA})).sort((a,b)=>b.T-a.T).slice(0,6),sj=mots.reduce((s,m)=>s+m.UJ,0)||1,sv=mots.reduce((s,m)=>s+m.UVA,0)||1,st=mots.reduce((s,m)=>s+m.T,0)||1;
   const lid=mots.filter(m=>m.g!='Outros temas');cab(S,'MOTIVOS DE CONTATO · '+ref,lid.length>1?lid[0].g+' e '+lid[1].g+' lideram os motivos de contato':'Motivos de contato');
   [['🏫 Sessões · Unijorge',R.all.UJ,64],['🎒 Sessões · UVA',R.all.UVA,441],['🚀 Total de sessões',R.all.T,818]].forEach(([l,v,x])=>{S.push(card(x,128,360,64,{fill:C.navy,line:null}));S.push(txt(x+18,128,150,64,l+' · '+(P.length>1?p0.curto+(ST.modo=='mes'?'–':' → ')+pn.curto:p0.curto),{size:12,color:C.soft}));S.push(txt(x+170,128,175,64,nf(v),{size:28,bold:1,color:C.yel,al:'r'}))});
   const mx=Math.max(...mots.map(m=>Math.max(m.UJ/(mots.reduce((s,x)=>s+x.UJ,0)||1),m.UVA/(mots.reduce((s,x)=>s+x.UVA,0)||1))),.01);
   const linhas=(u)=>{const ou=(R.out||{})[u],ls=ou?Object.entries(ou.l).sort((a,b)=>b[1]-a[1]):[];
     return{rs:mots.map(m=>({g:m.g,v:m[u]})).filter(m=>m.v>0).sort((a,b)=>b.v-a.v),rest:ls}};
   const LL={UJ:linhas('UJ'),UVA:linhas('UVA')};
   [['UJ','Unijorge',C.red,sj,64],['UVA','UVA',C.yel,sv,430]].forEach(([u,nm,col,sm,x0])=>{
     S.push(card(x0,208,350,430));S.push({k:'r',x:x0+20,y:223,w:14,h:14,fill:col,line:null,r:3});S.push(txt(x0+42,216,290,28,nm,{size:16,bold:1}));
     S.push(txt(x0+20,244,316,34,'% das sessões com motivo registrado · os motivos somam 100%',{size:11,color:C.slate,va:'t'}));
     const ord=LL[u].rs,so=ord.reduce((s,m)=>s+m.v,0)||1;
     if(!ord.length)S.push(txt(x0+20,300,310,40,'Sem motivos registrados no período',{size:13,color:C.slate}));
     const ad=a100(ord.map(m=>m.v));ord.forEach((m,i)=>{const y=284+i*49,v=ad[i],w=Math.max(4,v/mx*226);
       S.push(txt(x0+20,y,190,22,(EMO[m.g]||(m.t?'🔹':''))+' '+m.g,{size:14,bold:1}));S.push(txt(x0+206,y,124,22,pc((m.t?m.v:(mots.find(z=>z.g==m.g)||{T:m.v}).T)/st)+' do total',{size:11,color:C.slate,al:'r'}));
       S.push({k:'r',x:x0+20,y:y+26,w,h:20,fill:col,line:null,r:3});S.push(txt(x0+20+w+8,y+24,84,24,pc(v),{size:13,bold:1}))});
     const ou=ord.find(m=>m.g=='Outros temas');if(ou&&ou.v>0){const ls=LL[u].rest.slice(0,3).map(x=>x[0].replace(/^Sem tipificação$/,'sem tipificação')).join(', ');
       S.push({k:'l',x:x0+20,y:586,w:310,c:C.line});S.push(txt(x0+20,590,310,42,'➕ Outros temas ('+pc(ou.v/so)+' das sessões): '+ls+'.',{size:10.5,color:C.slate,va:'t'}))}});
   S.push(card(800,208,414,430));S.push(txt(822,220,370,30,'🔎 Principais tipificações',{size:16,bold:1}));S.push(txt(822,248,370,20,'% das sessões com motivo registrado · soma 100%',{size:12,color:C.slate}));
   const tp0=Object.entries(R.tip).sort((a,b)=>b[1].n-a[1].n),tt=tp0.reduce((s,x)=>s+x[1].n,0)||1,rs=tp0.slice(5),tp=tp0.slice(0,5).concat(rs.length?[['Demais tipificações',{n:rs.reduce((s,x)=>s+x[1].n,0)}]]:[]);
   const at=a100(tp.map(x=>x[1].n)),mic=(t,x)=>{if(t=='Demais tipificações'){const L=rs.slice(0,3).map(z=>(z[0].length>26?z[0].slice(0,25)+'…':z[0])+' '+pc(z[1].n/tt));return L.join(' · ')+(rs.length>3?' · +'+(rs.length-3)+' outras':'')}
     const rw=Object.entries((R.tipr||{})[t]||{}).sort((a,b)=>b[1]-a[1]);if(!/outros$|^outras tipifica/i.test(t)&&t!='Encerrado em 24 h')return'';
     return rw.length>1?'Reúne: '+rw.slice(0,3).map(z=>(z[0].length>26?z[0].slice(0,25)+'…':z[0])+' '+pc(z[1]/x.n)).join(' · '):(rw.length?'Tipificação genérica "'+rw[0][0]+'", sem detalhe do motivo':'')};
   tp.forEach(([t,x],i)=>{const y=282+i*57,mc=mic(t,x[1]||x);S.push({k:'l',x:822,y:y-4,w:370,c:C.line});S.push(txt(822,y,310,mc?20:38,t.length>44?t.slice(0,43)+'…':t,{size:13}));if(mc)S.push(txt(822,y+20,290,34,mc,{size:9.5,color:C.slate,va:'t'}));S.push(txt(1120,y,72,38,pc(at[i]),{size:14,bold:1,al:'r'}))});
   out.push(S)}
  /* 2 · transbordo */
  {const S=[],N=P.length;cab(S,'TAXA DE TRANSBORDO · '+ref,'Transbordo '+((val(R,pn,'T','tr')??0)<(val(R,p0,'T','tr')??0)?'caiu':'foi')+' para '+pc(val(R,pn,'T','tr'))+' em '+pn.label.toLowerCase());
   S.push(card(64,128,716,500));S.push(txt(86,140,290,30,'% de sessões com atendente',{size:16,bold:1}));leg(S,380,142,[[C.red,'Unijorge'],[C.yel,'UVA'],[C.blue,'Total']]);
   const base=560,top=200,vm=Math.max(...P.flatMap(p=>['UJ','UVA','T'].map(u=>val(R,p,u,'tr')||0)),.05),gw=(716-44)/N,bw=Math.min(58,gw/3.6);
   S.push({k:'l',x:86,y:base,w:672,c:C.line});
   P.forEach((p,i)=>{const gx=86+i*gw+gw/2-bw*1.5-6;['UJ','UVA','T'].forEach((u,j)=>{const v=val(R,p,u,'tr'),h=v==null?0:Math.max(2,v/vm*(base-top-30)),x=gx+j*(bw+6),c=[C.red,C.yel,C.blue][j];S.push({k:'r',x,y:base-h,w:bw,h,fill:c,line:null,r:4});S.push(txt(x-12,base-h-26,bw+24,24,pc(v),{size:N>6?10:13,bold:1,al:'c'}))});S.push(txt(86+i*gw,base+6,gw,26,N>6?p.curto:p.label,{size:N>6?10:14,bold:1,al:'c'}))});
   const tn=val(R,pn,'T','tr'),t0=val(R,p0,'T','tr'),tm=val(R,pa,'T','tr'),dd=tn!=null&&t0!=null?(tn-t0)*100:null;
   S.push(card(800,128,414,170,{fill:C.navy,line:null}));S.push(txt(822,140,370,22,'TOTAL · '+pn.label.toUpperCase(),{size:12,bold:1,color:C.soft,sp:1.5}));S.push(txt(822,164,370,56,pc(tn),{size:44,bold:1,color:C.yel}));
   S.push(txt(822,224,370,24,P.length>1?'era '+pc(t0)+' em '+p0.label.toLowerCase()+(P.length>2?' e '+pc(tm)+' em '+pa.label.toLowerCase():''):'',{size:14,color:C.white}));S.push(txt(822,250,370,24,dd==null||P.length<2?'':(dd<=0?'queda':'alta')+' de '+f1(Math.abs(dd))+' p.p. desde '+p0.label.toLowerCase(),{size:13,bold:1,color:C.soft}));
   [['UJ',800],['UVA',1010]].forEach(([u,x])=>{S.push(card(x,312,204,100));S.push(txt(x+14,318,180,24,UL[u].toUpperCase()+' · '+pn.label.toUpperCase(),{size:11,bold:1,color:C.blue,sp:1}));S.push(txt(x+14,342,180,38,pc(val(R,pn,u,'tr')),{size:28,bold:1}));S.push(txt(x+14,382,180,24,P.length>1?pc(val(R,p0,u,'tr'))+' em '+p0.label.toLowerCase():'',{size:11,color:C.slate}))});
   {const cn=p=>R.per[p.k+'|T'],rt=P.map(p=>({p,v:val(R,p,'T','tr')})).filter(x=>x.v!=null),mx2=rt.length?rt.reduce((m,x)=>x.v>m.v?x:m):null,mn2=rt.length?rt.reduce((m,x)=>x.v<m.v?x:m):null,cl=cn(pn);
    S.push(card(800,428,414,200,{fill:C.cream,line:'F0D37A'}));S.push(txt(822,440,370,24,'👥 ATENDIMENTO HUMANO · '+pn.label.toUpperCase(),{size:12,bold:1,color:C.blue,sp:1.5}));
    S.push(txt(822,466,370,50,nf(cl.tr),{size:36,bold:1}));S.push(txt(822,516,370,24,'sessões com atendente de '+nf(cl.n)+' no período',{size:13,color:C.slate}));
    if(mx2&&mn2&&P.length>1){S.push({k:'l',x:822,y:552,w:370,c:'F0D37A'});S.push(txt(822,560,370,26,'▲ Maior transbordo: '+mx2.p.label+' · '+pc(mx2.v),{size:13,bold:1,color:C.red}));S.push(txt(822,590,370,26,'▼ Menor transbordo: '+mn2.p.label+' · '+pc(mn2.v),{size:13,bold:1,color:C.blue}))}}
   out.push(S)}
  /* 3 · efetividade */
  {const S=[],N=P.length;cab(S,'EFETIVIDADE DOS ATENDIMENTOS · '+ref,'Mensagens por sessão '+((val(R,pn,'T','msg')??0)<(val(R,p0,'T','msg')??0)?'caíram':'variaram')+' e a retenção no robô '+((1-(val(R,pn,'T','tr')??0))>(1-(val(R,p0,'T','tr')??0))?'subiu':'variou'));
   const k=(l,f,x)=>{S.push(card(x,122,380,68,{fill:C.navy,line:null}));S.push(txt(x+18,126,340,22,l,{size:12,color:C.soft}));S.push(txt(x+18,148,340,38,f,{size:24,bold:1,color:C.yel,va:'t'}))};
   const g=(u,kk)=>val(R,p0,u,kk),h=(u,kk)=>val(R,pn,u,kk),ret=v=>v==null?null:1-v;
   k('Mensagens por sessão',f1(g('T','msg'))+' → '+f1(h('T','msg')),64);k('Retenção no robô',pc(ret(g('T','tr')))+' → '+pc(ret(h('T','tr'))),450);k('Abandono',pc(g('T','ab'))+' → '+pc(h('T','ab')),836);
   S.push(card(64,206,380,330));S.push(txt(84,216,340,28,'Mensagens por sessão',{size:16,bold:1}));leg(S,84,246,[[C.red,'Unijorge'],[C.yel,'UVA']]);
   const vm=Math.max(...P.flatMap(p=>['UJ','UVA'].map(u=>val(R,p,u,'msg')||0)),1),gw=340/N,bw=Math.min(40,gw/2.5),base=500;
   P.forEach((p,i)=>{const gx=84+i*gw+gw/2-bw-3;['UJ','UVA'].forEach((u,j)=>{const v=val(R,p,u,'msg'),hh=v==null?0:Math.max(2,v/vm*(base-300)),x=gx+j*(bw+6);S.push({k:'r',x,y:base-hh,w:bw,h:hh,fill:[C.red,C.yel][j],line:null,r:4});S.push(txt(x-10,base-hh-22,bw+20,20,f1(v),{size:N>5?9:12,bold:1,al:'c'}))});S.push(txt(84+i*gw,base+4,gw,24,N>5?p.curto:p.label,{size:N>5?9:12,bold:1,al:'c'}))});
   S.push(card(460,206,320,330));S.push(txt(480,216,290,26,'Quantas vezes volta em 24 h',{size:16,bold:1}));S.push(txt(480,242,290,20,'% dos contatos, por nº de voltas',{size:12,color:C.slate}));
   if(RT.ok&&RT.contatos){const lb=['Não volta','1 vez','2 vezes','3 vezes','4 vezes','5 ou mais'];lb.forEach((l,i)=>{const y=270+i*38,v=RT.dist[i]/RT.contatos;S.push(txt(480,y,120,22,l,{size:13}));S.push(txt(690,y,70,22,pc(v),{size:13,bold:1,al:'r'}));S.push({k:'r',x:480,y:y+24,w:Math.max(3,v*280),h:8,fill:i?C.blue:C.soft,line:null,r:3})});
     S.push(card(480,490,280,40,{fill:C.yel,line:null}));S.push(txt(490,490,260,40,pc(RT.quemVolta/RT.contatos)+' voltam em até 24 h'+(RT.quemVolta?' · média '+f1(RT.voltas/RT.quemVolta)+' voltas':''),{size:12,bold:1}))}
   else S.push(txt(480,300,290,120,'Base de recorrência não carregada para este recorte. Importe Usuários e sessões em Importar bases.',{size:13,color:C.slate,va:'t'}));
   S.push(card(796,206,418,330));S.push(txt(816,216,380,26,'Motivo do retorno',{size:16,bold:1}));S.push(txt(816,242,380,20,'Top 5 · % dos retornos em até 7 dias (total 100%)',{size:12,color:C.slate}));
   const mo0=Object.entries(RT.motivo).sort((a,b)=>b[1]-a[1]),mt=mo0.reduce((s,x)=>s+x[1],0)||1,rest=mo0.slice(5),mo=mo0.slice(0,5).concat(rest.length?[['Outros motivos',rest.reduce((s,x)=>s+x[1],0)]]:[]);
   if(rest.length)S.push(txt(816,500,380,32,'Outros: '+rest.slice(0,5).map(x=>x[0].toLowerCase()).join(', ')+'.',{size:10,color:C.slate,va:'t'}));
   mo.forEach(([l,n],i)=>{const y=262+i*40;S.push(txt(816,y,300,22,l.length>34?l.slice(0,33)+'…':l,{size:13}));S.push(txt(1120,y,76,22,pc(n/mt),{size:13,bold:1,al:'r'}));S.push({k:'r',x:816,y:y+24,w:Math.max(3,n/mt*340),h:8,fill:i?C.blue:C.red,line:null,r:3})});
   S.push(card(64,552,1150,76,{fill:C.navy,line:null}));S.push(txt(86,552,170,76,'ÚLTIMA SESSÃO DE QUEM VOLTA',{size:12,bold:1,color:C.yel,sp:1}));
   const ut=RT.ult.robo+RT.ult.cons;S.push(txt(270,556,150,38,ut?pc(RT.ult.robo/ut):'–',{size:28,bold:1,color:C.yel}));S.push(txt(270,596,170,24,'terminam no robô',{size:12,color:C.white}));S.push(txt(450,556,150,38,ut?pc(RT.ult.cons/ut):'–',{size:28,bold:1,color:C.yel}));S.push(txt(450,596,200,24,'terminam com consultor',{size:12,color:C.white}));
   const ct=Object.entries(RT.ultTip).sort((a,b)=>b[1]-a[1])[0];S.push(txt(690,556,500,68,ct?'Com consultor, a última tipificação mais comum é “'+ct[0]+'” ('+pc(ct[1]/(RT.ult.cons||1))+').':'',{size:13,color:C.white}));
   out.push(S)}
  /* 4 · frentes de atuação */
  {const S=[];cab(S,'OPORTUNIDADES DE MELHORIA','Frentes de atuação');
   const itens=[[TX('f1_t','Acompanhamento diário, hora a hora'),TX('f1_d','Todo dia, por hora'),'FREQUÊNCIA'],['Redução do fluxo',(val(R,pn,'T','tr')!=null&&val(R,p0,'T','tr')!=null?f1((val(R,pn,'T','tr')-val(R,p0,'T','tr'))*100).replace('-','−')+' p.p. de transbordo':'–'),'TRANSBORDO',pc(val(R,p0,'T','tr'))+' → '+pc(val(R,pn,'T','tr'))],['Aplicação de flows',(val(R,pn,'T','msg')!=null&&val(R,p0,'T','msg')!=null?f1(val(R,pn,'T','msg')-val(R,p0,'T','msg')).replace('-','−')+' mensagens por sessão':'–'),'MSGS POR SESSÃO',f1(val(R,p0,'T','msg'))+' → '+f1(val(R,pn,'T','msg'))]];
   itens.forEach((it,i)=>{const x=64+i*386;S.push(card(x,128,378,290));S.push({k:'r',x:x+20,y:146,w:46,h:46,fill:C.navy,line:null,r:23});S.push(txt(x+20,146,46,46,String(i+1),{size:20,bold:1,color:C.yel,al:'c'}));S.push(txt(x+20,204,340,56,it[0],{size:19,bold:1,va:'t'}));
     if(i){S.push(card(x+20,262,338,52,{fill:C.bg,line:null}));S.push(txt(x+30,262,320,52,it[1],{size:20,bold:1}))}
     S.push(card(x+20,326,338,76,{fill:C.bg,line:null}));S.push(txt(x+32,332,300,22,it[2],{size:11,bold:1,color:C.blue,sp:1.5}));S.push(txt(x+32,356,310,38,i?it[3]:it[1],{size:20,bold:1}))});
   S.push(card(64,436,1150,200));S.push(txt(90,448,1000,24,'PARA REDUZIR O TRANSBORDO AO HUMANO',{size:12,bold:1,color:C.blue,sp:1.5}));
   [['Revisão da árvore diária','Árvore de atendimento revista todos os dias.'],['Otimização da base de conhecimento','Base de conhecimento otimizada diariamente.'],['Análise de interações','Busca de oportunidades de redução nas interações.']].forEach((d,i)=>{const x=90+i*376;S.push({k:'r',x,y:488,w:46,h:46,fill:C.yel,line:null,r:23});S.push(txt(x,488,46,46,String(4+i),{size:20,bold:1,al:'c'}));S.push(txt(x+58,484,290,54,TX('s'+i+'_t',d[0]),{size:17,bold:1,va:'t'}));S.push(txt(x+58,540,290,80,TX('s'+i+'_d',d[1]),{size:13,color:C.slate,va:'t'}))});
   S.push(txt(64,650,1150,24,'Indicadores de '+orgN+' Unijorge + UVA · '+dmy(P[0].a)+' a '+dmy(P[P.length-1].b>(SR.map(x=>x.d).sort().pop())?SR.map(x=>x.d).sort().pop():P[P.length-1].b),{size:12,color:C.slate}));out.push(S)}
  return out;
}

/* ---------- prévia na tela ---------- */

/* ícones SVG animados (substituem os emojis na visualização) */
const SV=(b,c)=>'<svg class="psv '+c+'" viewBox="0 0 24 24" width="1.25em" height="1.25em" style="vertical-align:-.3em;margin-right:.2em">'+b+'</svg>';
const ICO={
'🎓':SV('<path d="M12 3 1.5 9 12 15l10.5-6z" fill="#00487F"/><path d="M6 12.5v4.2c0 1.3 2.7 2.8 6 2.8s6-1.500 6-2.800v-4.200L12 16z" fill="#F5B800"/><path d="M21 9.500v6" stroke="#C8102E" stroke-width="1.500" stroke-linecap="round"/>','pa-b'),
'💰':SV('<path d="M8 3h8l-2 4h-4z" fill="#B8860B"/><path d="M9.500 7C4 11 3 21 12 21s8-10 2.500-14z" fill="#F5B800"/><text x="12" y="18" font-size="9" font-weight="700" text-anchor="middle" fill="#7A5A00" font-family="Arial">R$</text>','pa-b'),
'💬':SV('<path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#00487F"/><circle cx="8" cy="10.500" r="1.400" fill="#fff"/><circle cx="12" cy="10.500" r="1.400" fill="#fff"/><circle cx="16" cy="10.500" r="1.400" fill="#fff"/>','pa-p'),
'📝':SV('<rect x="4" y="3" width="13" height="18" rx="2" fill="#fff" stroke="#00487F" stroke-width="1.600"/><path d="M7 8h7M7 12h7M7 16h4" stroke="#00487F" stroke-width="1.500" stroke-linecap="round"/><path d="m14 19 7-7 2 2-7 7-3 1z" fill="#F5B800" stroke="#B8860B" stroke-width=".8"/>','pa-w'),
'🚪':SV('<rect x="5" y="2.500" width="12" height="19" rx="1.500" fill="#C8102E"/><circle cx="14" cy="12" r="1.200" fill="#F5B800"/><path d="M18 12h4m-2-2 2 2-2 2" stroke="#00213D" stroke-width="1.500" fill="none" stroke-linecap="round"/>','pa-s'),
'🏫':SV('<path d="M2 11 12 4l10 7z" fill="#C8102E"/><rect x="4" y="11" width="16" height="10" fill="#F5E6C8"/><rect x="10" y="14" width="4" height="7" fill="#00487F"/><rect x="5.500" y="13" width="3" height="3" fill="#00487F"/><rect x="15.500" y="13" width="3" height="3" fill="#00487F"/>','pa-b'),
'🎒':SV('<rect x="5" y="6" width="14" height="16" rx="5" fill="#F5B800"/><path d="M9 6a3 3 0 0 1 6 0" stroke="#B8860B" stroke-width="1.600" fill="none"/><rect x="8" y="13" width="8" height="6" rx="1.500" fill="#B8860B"/>','pa-w'),
'🚀':SV('<path d="M12 2c4 3 5 8 4 13H8c-1-5 0-10 4-13z" fill="#E8EEF4" stroke="#00487F" stroke-width="1"/><circle cx="12" cy="9" r="2" fill="#00487F"/><path d="M8 13 4 17l4-1zM16 13l4 4-4-1z" fill="#C8102E"/><path class="pfl" d="M10 17c0 3 2 5 2 5s2-2 2-5z" fill="#F5B800"/>','pa-r'),
'🔎':SV('<circle cx="10" cy="10" r="6.500" fill="#DCEBFA" stroke="#00487F" stroke-width="2.200"/><path d="m15 15 6.500 6.500" stroke="#00213D" stroke-width="3" stroke-linecap="round"/>','pa-p'),
'🔹':SV('<path d="M12 2 21 12 12 22 3 12z" fill="#00487F"/><path d="M12 2 21 12H3z" fill="#4F94D4"/>','pa-p'),
'➕':SV('<circle cx="12" cy="12" r="10" fill="#00487F"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.600" stroke-linecap="round"/>','pa-s'),
'🤝':SV('<path d="M2 11l5-4 5 2 5-2 5 4-4 5-3-1-3 3-3-3-3 1z" fill="#F5B800" stroke="#B8860B" stroke-width="1"/>','pa-w'),
'⚡':SV('<path d="M13.500 2 4 13.500h7L10 22l10-12.500h-7z" fill="#F5B800" stroke="#B8860B" stroke-width="1"/>','pa-s'),
'👥':SV('<circle cx="8" cy="8" r="3.500" fill="#00487F"/><path d="M1.500 20c0-4 3-6.500 6.500-6.500s6.500 2.500 6.500 6.500z" fill="#00487F"/><circle cx="17" cy="9" r="3" fill="#F5B800"/><path d="M13.500 14.500c1-.7 2.200-1 3.500-1 3 0 5.500 2.200 5.500 6.500h-7.500" fill="#F5B800"/>','pa-p'),
'🔹':SV('<path d="M12 2 21 12 12 22 3 12z" fill="#00487F"/>','pa-s'),
'🎯':SV('<circle cx="12" cy="12" r="10" fill="#fff" stroke="#C8102E" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="#fff" stroke="#C8102E" stroke-width="2"/><circle cx="12" cy="12" r="2.400" fill="#C8102E"/>','pa-p')
};
const SVGCSS='.psv{display:inline-block;transform-origin:50% 60%}.pa-b,.pa-p,.pa-w,.pa-s,.pa-r{animation:pam 5s ease-in-out infinite}.pa-w{animation-delay:.8s}.pa-s{animation-delay:1.600s}.pa-r{animation-delay:2.400s}@keyframes pam{0%,82%,100%{transform:none}90%{transform:translateY(-2px) scale(1.06)}}@media(prefers-reduced-motion:reduce){.psv{animation:none!important}}';
function html(S,i){const e=S.map(o=>{const b='left:'+o.x+'px;top:'+o.y+'px;';if(o.k=='r')return'<div style="position:absolute;'+b+'width:'+o.w+'px;height:'+o.h+'px;background:#'+o.fill+';'+(o.line?'border:1px solid #'+o.line+';box-sizing:border-box;':'')+'border-radius:'+o.r+'px"></div>';
    if(o.k=='l')return'<div style="position:absolute;'+b+'width:'+o.w+'px;height:1px;background:#'+o.c+'"></div>';
    return'<div style="position:absolute;'+b+'width:'+o.w+'px;height:'+o.h+'px;display:flex;align-items:'+(o.va=='t'?'flex-start':'center')+';justify-content:'+(o.al=='r'?'flex-end':o.al=='c'?'center':'flex-start')+';font-size:'+o.size+'px;font-weight:'+(o.bold?700:400)+';color:#'+o.color+';letter-spacing:'+o.sp+'px;text-align:'+(o.al=='r'?'right':o.al=='c'?'center':'left')+';line-height:1.18;overflow:hidden"><span>'+esc(o.t).replace(/(\p{Extended_Pictographic}\uFE0F?)/gu,(m,e)=>ICO[e.replace(/\uFE0F/,'')]||'')+'</span></div>'}).join('');
  return'<style>'+SVGCSS+'</style><div class="psl" style="width:1280px;height:720px;position:relative;background:#'+C.bg+';font-family:\'IBM Plex Sans\',Arial,sans-serif;overflow:hidden;transform-origin:0 0">'+e+'<div style="position:absolute;right:24px;bottom:10px;font-size:11px;color:#'+C.slate+'">'+(i+1)+'</div></div>'}
/* ---------- PPTX ---------- */
function baixar(SL){
  if(typeof PptxGenJS=='undefined'){alert('A biblioteca de PPTX não carregou (verifique a conexão).');return}
  const px=new PptxGenJS();px.layout='LAYOUT_WIDE';px.title='Indicadores de Serviços';const q=v=>v/96;
  SL.forEach(S=>{const s=px.addSlide();s.background={color:C.bg};
    S.forEach(o=>{if(o.k=='r')s.addShape(o.r>=8?px.ShapeType.roundRect:px.ShapeType.rect,Object.assign({x:q(o.x),y:q(o.y),w:q(o.w),h:q(o.h),fill:{color:o.fill},line:o.line?{color:o.line,width:.75}:{type:'none'}},o.r>=8?{rectRadius:Math.min(.5,o.r/Math.min(o.w,o.h))*.5}:{}));
      else if(o.k=='l')s.addShape(px.ShapeType.line,{x:q(o.x),y:q(o.y),w:q(o.w),h:0,line:{color:o.c,width:.75}});
      else s.addText(String(o.t),{x:q(o.x),y:q(o.y),w:q(o.w),h:q(o.h),fontFace:'Arial',fontSize:Math.max(7,Math.round(o.size*.75*10)/10),bold:o.bold,color:o.color,align:o.al=='c'?'center':o.al=='r'?'right':'left',valign:o.va=='t'?'top':'middle',margin:0,charSpacing:o.sp?o.sp*.75:0,fit:'shrink'})})});
  px.writeFile({fileName:'Indicadores_'+(ST.org=='S'?'Servicos':ST.org=='A'?'Admissao':'Geral')+'_'+(ST.modo=='mes'?'mensal':'semanal')+'_'+new Date().toISOString().slice(0,10)+'.pptx'});
}
/* ---------- página ---------- */
let SL=[];
function desenhar(){
  const m=document.getElementById('mn'),P=periodos();
  if(!P.length){m.innerHTML='<h1>Apresentação</h1><div class="c w"><h3>Sem dados de sessões</h3><p style="color:var(--mu)">Importe ou atualize as bases (Usuários e sessões) para montar a apresentação.</p></div>';return}
  if(typeof RCOK!='undefined'&&!RCOK&&typeof rcLoad=='function'&&!window.__PRCL){window.__PRCL=1;rcLoad().then(()=>{window.__PRCL=0;if(!RC.UJ&&!RC.UVA&&!window.__PRC2){window.__PRC2=1;RCP=null;return rcLoad().then(()=>{if(document.getElementById('psls'))desenhar()})}if(document.getElementById('psls'))desenhar()})}
  const R=calcular(P),RT=retornos(P);SL=slides(R,RT);
  const semOrg=ST.org!='T'&&!SR.some(x=>x.ar&&x.ar!='U');
  const meses=P.length,opt=(v,t,c)=>'<option value="'+v+'"'+(c?' selected':'')+'>'+t+'</option>';
  const ed=[['mot_t','Principal motivador (título)','Aplicação de flows no robô'],['mot_d','Principal motivador (explicação)','Mais sessões resolvidas dentro da conversa, sem precisar de atendente'],['f1_t','Frente 1 (título)','Acompanhamento diário, hora a hora'],['f1_d','Frente 1 (detalhe)','Todo dia, por hora'],['s0_t','Ação 4 (título)','Revisão da árvore diária'],['s0_d','Ação 4 (texto)','Árvore de atendimento revista todos os dias.'],['s1_t','Ação 5 (título)','Otimização da base de conhecimento'],['s1_d','Ação 5 (texto)','Base de conhecimento otimizada diariamente.'],['s2_t','Ação 6 (título)','Análise de interações'],['s2_d','Ação 6 (texto)','Busca de oportunidades de redução nas interações.']];
  m.innerHTML='<h1>Apresentação</h1><p class="sub">Slides montados ao vivo com os dados que já estão no painel, por mês ou por semana. O que você ajustar nos filtros muda os slides na hora; use <b>Baixar PPTX</b> para levar para o PowerPoint.</p>'+
   '<div class="c w" style="margin-bottom:12px"><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end"><label class="fl">Visão<select id="prm">'+opt('mes','Por mês',ST.modo=='mes')+opt('sem','Por semana',ST.modo=='sem')+'</select></label><label class="fl">Organização<select id="pro">'+opt('S','Serviços (aluno e ex-aluno)',ST.org=='S')+opt('A','Admissão (lead)',ST.org=='A')+opt('T','Todas',ST.org=='T')+'</select></label><label class="fl">De<input type="date" id="prd" value="'+P[0].a+'"></label><label class="fl">Até<input type="date" id="pra" value="'+(ST.ate||SR.map(x=>x.d).sort().pop())+'"></label><button id="prb">Baixar PPTX</button><span class="tag">'+meses+' '+(ST.modo=='mes'?'mês(es)':'semana(s)')+'</span></div>'+
   '<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--ac)">Editar textos dos slides</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin-top:8px">'+ed.map(([k,l,d])=>'<label class="fl">'+l+'<input data-pt="'+k+'" value="'+esc(TX(k,d))+'" style="width:100%"></label>').join('')+'</div></details></div>'+
   (semOrg?'<div class="fbar" style="margin-bottom:10px"><svg class="i"><use href="#ic-info"/></svg><span>As sessões ainda não têm a organização (Lead, aluno ou ex-aluno), por isso Serviços e Admissão aparecem vazios. Importe as planilhas em <b>Importar status</b> e reimporte <b>Usuários e sessões</b>, ou escolha <b>Todas</b>.</span></div>':'')+
   '<div id="psls">'+SL.map((S,i)=>'<div class="pwr" style="margin:0 0 18px;border:1px solid var(--bd,#d3deeb);border-radius:10px;overflow:hidden">'+html(S,i)+'</div>').join('')+'</div>'+
   '<details style="margin:10px 0"><summary style="cursor:pointer;color:var(--ac)">Diagnóstico das tipificações (mesmos filtros dos slides)</summary>'+['UJ','UVA'].map(u=>{const cv=(R.cov||{})[u],dg=Object.entries((R.diag||{})[u]||{}).sort((a,b)=>b[1].n-a[1].n);if(!cv)return'<p class="sub"><b>'+UL[u]+'</b>: sem sessões no recorte.</p>';const pt=v=>(cv.tot?(v/cv.tot*100).toFixed(1).replace('.',','):'0')+'%';
     return'<p class="sub" style="margin-top:10px"><b>'+UL[u]+'</b> · '+nf(cv.tot)+' sessões · com motivo: '+nf(cv.mot)+' ('+pt(cv.mot)+', inferidos pelo texto: '+nf(cv.inf)+') · abandono: '+nf(cv.ab)+' ('+pt(cv.ab)+') · sem tipificação: '+nf(cv.sem)+' ('+pt(cv.sem)+') · resolvido pelo robô: '+nf(cv.rob)+' ('+pt(cv.rob)+')</p><div style="max-height:260px;overflow:auto"><table class="ot" style="width:100%;font-size:12px"><thead><tr><th>Tipificação</th><th>Sessões</th><th>Grupo gravado</th><th>Tema na apresentação</th></tr></thead><tbody>'+dg.slice(0,60).map(([t,e])=>'<tr><td>'+esc(t)+(e.nm?'<br><span style="color:var(--mu)">'+esc(e.nm)+'</span>':'')+'</td><td>'+nf(e.n)+'</td><td>'+esc(e.g)+'</td><td>'+esc(e.mo?(GNOME[e.m]||e.m):'não conta como motivo')+'</td></tr>').join('')+'</tbody></table></div>'+(()=>{const mm=(R.mm||{})[u]||{},ts=Object.keys(mm).sort((a,b)=>P.reduce((s,p)=>s+(mm[b][p.k]||0),0)-P.reduce((s,p)=>s+(mm[a][p.k]||0),0));if(!ts.length)return'';const tot=P.map(p=>ts.reduce((s,t)=>s+(mm[t][p.k]||0),0));return'<p class="sub" style="margin-top:8px"><b>'+UL[u]+' · motivos por '+(ST.modo=='mes'?'mês':'semana')+'</b> (sessões e % do período)</p><div style="overflow:auto"><table class="ot" style="width:100%;font-size:12px"><thead><tr><th>Tema</th>'+P.map(p=>'<th>'+p.curto+'</th>').join('')+'</tr></thead><tbody>'+ts.map(t=>'<tr><td>'+esc(GNOME[t]||t)+'</td>'+P.map((p,i)=>{const v=mm[t][p.k]||0;return'<td>'+nf(v)+' · '+(tot[i]?(v/tot[i]*100).toFixed(1).replace('.',','):'0')+'%</td>'}).join('')+'</tr>').join('')+'<tr><td><b>Total com motivo</b></td>'+tot.map(v=>'<td><b>'+nf(v)+'</b></td>').join('')+'</tr></tbody></table></div>'})()}).join('')+'</details>'+
   '<p class="sub">O slide “Orçamento × Realizado” do modelo não entra aqui porque o painel não guarda o orçamento. Definições: transbordo = sessões com atendente ÷ sessões; retenção no robô = 100% − transbordo; abandono = sessões tipificadas como usuário parou de interagir, encerradas automaticamente ou sem atendimento.</p>';
  const ajusta=()=>{const w=document.getElementById('psls').clientWidth,k=Math.min(1,w/1280);document.querySelectorAll('#psls .pwr').forEach(d=>{d.style.height=720*k+'px';d.firstChild.style.transform='scale('+k+')'})};ajusta();window.addEventListener('resize',ajusta,{once:true});
  const $=id=>document.getElementById(id);
  $('prm').onchange=e=>{ST.modo=e.target.value;ST.de='';desenhar()};$('pro').onchange=e=>{ST.org=e.target.value;desenhar()};
  $('prd').onchange=e=>{ST.de=e.target.value;desenhar()};$('pra').onchange=e=>{ST.ate=e.target.value;desenhar()};
  $('prb').onclick=()=>baixar(SL);
  m.querySelectorAll('[data-pt]').forEach(i=>i.onchange=()=>{ST.txt[i.dataset.pt]=i.value;try{localStorage.setItem('pres_txt',JSON.stringify(ST.txt))}catch(e){}desenhar()});
}
{const sty=document.createElement('style');sty.textContent='.prp .tb{display:none}';document.head.appendChild(sty);const sync=()=>{const on=typeof PG!='undefined'&&PG=='pres';if(document.body.classList.contains('prp')!=on){document.body.classList.toggle('prp',on);try{tbh()}catch(e){}}};setInterval(sync,300)}
PAGES.pres=()=>{document.body.classList.add('prp');try{tbh()}catch(e){}try{desenhar()}catch(e){document.getElementById('mn').innerHTML='<h1>Apresentação</h1><div class="c w"><p>Não foi possível montar os slides: '+esc(e.message)+'</p></div>'}};
PN.pres='Apresentação';
})();
