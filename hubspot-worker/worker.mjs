// Serviço intermediário (Cloudflare Worker): consulta o HubSpot pelo telefone ou CPF e devolve a jornada do contato.
// Segredos (Configurações > Variáveis e segredos): HUBSPOT_TOKEN, CHAVE_ACESSO. Opcionais: ORIGEM_PERMITIDA, CPF_PROP.
const H = 'https://api.hubapi.com';
const CONTATO = ['lifecyclestage','hs_lead_status','hs_analytics_source','createdate','hubspot_owner_id','first_conversion_event_name','first_conversion_date','recent_conversion_event_name','recent_conversion_date','hs_email_last_send_date','hs_email_last_email_name','hs_email_last_open_date','hs_email_last_click_date','notes_last_contacted','hs_lifecyclestage_lead_date','hs_lifecyclestage_marketingqualifiedlead_date','hs_lifecyclestage_salesqualifiedlead_date','hs_lifecyclestage_opportunity_date','hs_lifecyclestage_customer_date','hs_analytics_first_visit_timestamp','hs_analytics_last_visit_timestamp','hs_analytics_num_visits','hs_analytics_num_page_views','hs_analytics_source_data_1','hs_analytics_source_data_2','hs_email_first_send_date','hs_email_first_open_date','hs_sales_email_last_replied','hs_sales_email_last_opened','num_conversion_events'];
const dig = s => String(s || '').replace(/\D/g, '');
const cpfOk = d => { if (d.length != 11 || /^(\d)\1+$/.test(d)) return false; for (const n of [9, 10]) { let t = 0; for (let i = 0; i < n; i++) t += +d[i] * (n + 1 - i); if ((t * 10 % 11) % 10 != +d[n]) return false } return true };
const local = v => { if (!v) return null; const t = /^\d+$/.test(String(v)) ? +v : Date.parse(v); if (!t) return null; const s = new Date(t).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); return { d: s.slice(0, 10), h: +s.slice(11, 13), hm: s.slice(11, 16) } };
const igual = (a, b) => { if (a.length != b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r == 0 };

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// [grupo, rótulo pedido, expressão sobre o rótulo normalizado, nome interno provável, evento da jornada, sensível]
const SPEC = {
  contacts: [
    ['Cadastro e ciclo', 'Status do contato de marketing', 'status do contato de marketing|marketing contact status', 'hs_marketable_status'], ['Acadêmico', 'Já é aluno matriculado', '(ja|aluno).*(aluno|matricul)|matriculad'], ['Cadastro e ciclo', 'Fase do ciclo de vida', '^(fase do ciclo|etapa do ciclo|lifecycle)', 'lifecyclestage'],
    ['Origem e marketing', 'Origem da integração', 'origem da integra'], ['Cadastro e ciclo', 'Data que entrou em lead', 'data.*(entrou|tornou).*lead|lead date', 'hs_lifecyclestage_lead_date'], ['Cadastro e ciclo', 'Data de criação do contato', '^data de cria', 'createdate'],
    ['Acadêmico', 'Modalidade de interesse', 'modalidade'], ['Acadêmico', 'Universidade', '^universidade$', 'universidade'], ['Origem e marketing', 'Origem', '^origem$', 'origem'], ['Acadêmico', 'Turno de interesse', 'turno'], ['Acadêmico', 'Campus', '^campus|^unidade$|^polo$|campus de|unidade de interesse'], ['Acadêmico', 'Curso de interesse', 'curso de interesse'], ['Acadêmico', 'Forma de ingresso', 'forma.*ingresso|tipo.*ingresso'],
    ['Origem e marketing', 'Primeira página vista', 'primeira pagina|first page seen|first url', 'hs_analytics_first_url'], ['Origem e marketing', 'Primeiro referenciador', 'primeiro referenciador|first referring|first referrer', 'hs_analytics_first_referrer'], ['Origem e marketing', 'Detalhamento da fonte 2', 'detalhamento da fonte 2|original source drill-down 2', 'hs_analytics_source_data_2'], ['Origem e marketing', 'Primeira visita ao site', 'primeira visita|first visit', 'hs_analytics_first_visit_timestamp'], ['Origem e marketing', 'Campanha do primeiro toque', 'campanha.*primeiro toque|first touch.*campaign', 'hs_analytics_first_touch_converting_campaign'], ['Origem e marketing', 'Primeira conversão', '^primeira convers|first conversion$', 'first_conversion_event_name'], ['Origem e marketing', 'UTM source', '^utm.?source', 'utm_source'], ['Origem e marketing', 'UTM medium', '^utm.?medium', 'utm_medium'], ['Origem e marketing', 'UTM campaign', '^utm.?campaign', 'utm_campaign'], ['Origem e marketing', 'Última página vista', 'ultima pagina|last page seen', 'hs_analytics_last_url'], ['Origem e marketing', 'Detalhamento da fonte', 'detalhamento da fonte|original source drill-down 1', 'hs_analytics_source_data_1'], ['Origem e marketing', 'Fonte do tráfego mais recente', 'fonte.*(mais recente|recente)|latest source', 'hs_latest_source'],
    ['Origem e marketing', 'Fonte original do tráfego', 'fonte original|original source', 'hs_analytics_source'], ['Origem e marketing', 'Fonte recente de mídia paga', 'midia paga|paid.*source|fonte recente de midia'], ['Origem e marketing', 'Categoria da fonte original', 'categoria da fonte'],
    ['Origem e marketing', 'Período original', 'periodo original'], ['Origem e marketing', 'Detalhe da fonte de registro', 'detalhe da fonte de registro|registration source detail'], ['Origem e marketing', 'Fonte de registro', '^fonte de registro|registration source', 'hs_registration_method'],
    ['Negócios', 'Primeiro negócio', 'primeiro neg|first deal', 'first_deal_created_date'], ['Negócios', 'Negócios associados', 'neg.cios associados|associated deals', 'num_associated_deals'], ['Origem e marketing', 'Primeira origem', 'primeira origem'],
    ['Acadêmico', 'Curso', '^curso'], ['Origem e marketing', 'Tipo de origem', 'tipo (de|da) origem'], ['Cadastro e ciclo', 'Recusa receber ligações', 'recus.*liga|nao ligar|do not call'],
    ['Campanha', 'Campanha', '^campanha|utm_campaign|^utm campaign'], ['Campanha', 'Conteúdo do anúncio', 'conteudo do anuncio|utm.?content'], ['Campanha', 'Fonte', '^fonte$|utm.?source'], ['Campanha', 'Meio', '^meio$|utm.?medium'], ['Campanha', 'Termo do anúncio', 'termo do anuncio|utm.?term'],
    ['Campanha', 'URL campanha WhatsApp', 'url.*whats'], ['Campanha', 'Referral source', 'referral'], ['Negócios', 'Pipeline', '^pipeline'], ['Negócios', 'Nome da etapa do negócio', 'etapa do neg'],
    ['Financeiro', 'Aluno adimplente', 'adimpl'], ['Financeiro', 'Valores devidos', 'valores? devidos'], ['Financeiro', 'Dívidas de acordo', 'divida.* de acordo|dividas? acordo'], ['Financeiro', 'Dívidas de biblioteca', 'divida.*biblioteca|biblioteca'], ['Financeiro', 'Dívidas de mensalidade', 'divida.*mensalidade|^mensalidade'], ['Financeiro', 'Outros valores', 'outros valores'], ['Financeiro', 'Outros acordos', 'outros acordos'], ['Financeiro', 'Faixa de dívida', 'faixa de divida']
  ],
  deals: [
    ['Negócio', 'Data de criação', '^data de cria', 'createdate'], ['Negócio', 'Etapa do negócio', '^etapa do neg|deal stage', 'dealstage'], ['Acadêmico', 'Apto', '^apto'], ['Acadêmico', 'Contrato aceito', 'contrato aceit'], ['Acadêmico', 'Disciplinas inseridas', '^disciplinas inseridas'], ['Acadêmico', 'Enturmado', '^enturmado'],
    ['Acadêmico', 'Modalidade', '^modalidade'], ['Acadêmico', 'Nome do curso', 'nome do curso|^curso'], ['Acadêmico', 'Universidade', '^universidade$', 'universidade'], ['Marcos', 'Data das disciplinas inseridas', 'data.*disciplinas', null, 'Disciplinas inseridas'], ['Marcos', 'Aceite de contrato e enturmado', 'aceite.*enturmad|data.*aceite', null, 'Aceite de contrato e enturmado'],
    ['Negócio', 'Data da última modificação', 'ultima modifica|last modified', 'hs_lastmodifieddate'], ['Origem e marketing', 'Tipo da origem', 'tipo da origem|tipo de origem'], ['Origem e marketing', 'Origem do negócio', 'origem do neg'], ['Origem e marketing', 'Fonte original do tráfego', 'fonte original|original source', 'hs_analytics_source'], ['Origem e marketing', 'Fonte de tráfego mais recente', 'fonte.*(mais recente|recente)|latest source', 'hs_latest_source'],
    ['Negócio', 'Pipeline', '^pipeline', 'pipeline'], ['Acadêmico', 'Período letivo', 'periodo letivo'], ['Origem e marketing', 'Origem da integração', 'origem da integra'], ['Identificação', 'Nome do negócio', 'nome do neg', 'dealname', null, 1], ['Marcos', 'Data de fechamento', '^data de fechamento|close date', 'closedate', 'Fechamento do negócio'],
    ['Acadêmico', 'Turno', '^turno'], ['Acadêmico', 'Campus', '^campus|^unidade$|^polo$|campus de'], ['Acadêmico', 'Forma de ingresso', 'forma.*ingresso|tipo.*ingresso'], ['Acadêmico', 'Semestre / período do curso', '^semestre'], ['Financeiro', 'Aluno 5 cotas', '5 cotas|cinco cotas'], ['Marcos', 'Vencimento da mensalidade', 'vencimento.*mensalidade', null, 'Vencimento da mensalidade'], ['Marcos', 'Data da mensalidade paga', 'data.*mensalidade paga|mensalidade paga', null, 'Mensalidade paga'],
    ['Identificação', 'RA', '^ra$|registro academico', null, null, 1], ['Financeiro', 'Aluno adimplente', 'adimpl'], ['Financeiro', 'Valores devidos', 'valores? devidos'], ['Financeiro', 'Dívidas de acordo', 'divida.* de acordo|dividas? acordo'], ['Financeiro', 'Dívidas de biblioteca', 'divida.*biblioteca|biblioteca'], ['Financeiro', 'Dívidas de mensalidade', 'divida.*mensalidade|^mensalidade'],
    ['Financeiro', 'Outros valores', 'outros valores'], ['Financeiro', 'Descrição da dívida', 'descricao da divida'], ['Financeiro', 'Descrição do benefício', 'descricao do beneficio'], ['Financeiro', 'Tipo de benefício', 'tipo de beneficio'], ['Financeiro', 'Valor da bolsa', 'valor da bolsa'],
    ['Financeiro', 'Mais de 6 meses de atraso', '6 meses'], ['Financeiro', 'Faixa de dívida', 'faixa de divida'], ['Acadêmico', 'Situação acadêmica', 'situacao academica'], ['Acadêmico', 'Situação do aluno', 'situacao do aluno'], ['Acadêmico', 'Período do curso', 'periodo do curso']
  ]
};
let PCACHE = null; const PNOM = {};
const nomesDe = async (api, ob) => { if (!PNOM[ob] || Date.now() - PNOM[ob].t > 36e5) { const pj = await api('/crm/v3/properties/' + ob).catch(() => null); PNOM[ob] = { t: Date.now(), s: pj && pj.results ? new Set(pj.results.map(x => x.name)) : null } } return PNOM[ob].s };
const entrou = (S, id) => { if (!S) return 'hs_date_entered_' + id; const a = 'hs_date_entered_' + id, b = 'hs_v2_date_entered_' + id; return S.has(a) ? a : S.has(b) ? b : a };
export default {
  async fetch(req, env) {
    const orig = env.ORIGEM_PERMITIDA || 'https://emersonaraujodefreitas.github.io';
    const cors = { 'Access-Control-Allow-Origin': orig, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method == 'OPTIONS') return new Response(null, { headers: cors });
    if (req.headers.get('Origin') && req.headers.get('Origin') != orig) return out({ erro: 'origem não permitida' }, 403);
    const chave = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!env.CHAVE_ACESSO || !igual(chave, env.CHAVE_ACESSO)) return out({ erro: 'acesso negado' }, 401);
    const u = new URL(req.url); if (!['/buscar', '/estrutura', '/painel', '/campos', '/contar', '/vinculo', '/jornada', '/emails', '/propriedades', '/amostra'].includes(u.pathname)) return out({ erro: 'rota inexistente' }, 404);
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const api = async (p, o) => { for (let i = 0; ; i++) { const r = await fetch(H + p, { ...o, headers: { Authorization: 'Bearer ' + env.HUBSPOT_TOKEN, 'Content-Type': 'application/json' } }); if (r.status == 429 && i < 6) { await espera(1000 + 700 * i); continue } if (!r.ok) { const e = new Error('HubSpot ' + r.status + ' em ' + p.split('?')[0]); e.st = r.status; throw e } return r.json() } };
    const resolver = async () => {
      if (PCACHE && Date.now() - PCACHE.t < 36e5) return PCACHE.v;
      const v = { contacts: [], deals: [], faltam: { contacts: [], deals: [] }, cpf: {}, cpfp: {}, comm: [] };
      for (const o of ['contacts', 'deals']) {
        const pr = (await api('/crm/v3/properties/' + o)).results;
        const gj = await api('/crm/v3/properties/' + o + '/groups').catch(() => ({ results: [] })), gl = {}; (gj.results || []).forEach(x => gl[x.name] = x.label);
        { const lc = pr.filter(x => /cpf/i.test(x.name + ' ' + x.label) && !/respons|dependent/i.test(x.label)), od = x => /^cpf$/i.test(x.label.trim()) ? 0 : /desuso|utilizado|antigo/i.test(x.label) ? 2 : 1; lc.sort((a, b) => od(a) - od(b)); v.cpf[o] = lc.map(x => x.name).slice(0, 6); v.cpfp[o] = lc.filter(x => od(x) < 2).map(x => x.name) }
        for (const [g, rot, rx, hint, ev, pii] of SPEC[o]) {
          let best = null, bs = 0; const re = new RegExp(rx);
          for (const p of pr) { if (p.hidden) continue; const l = norm(p.label), n = norm(p.name); if (/desuso|nao utilizad|obsolet|descontinuad|\bold\b|\(antigo|legado/.test(l + ' ' + n)) continue; let sc = 0; if (hint && p.name == hint) sc = 4; else if (l == norm(rot)) sc = 3; else if (re.test(l)) sc = 2; else if (!/ /.test(rx) && re.test(n)) sc = 1; if (sc > bs || (sc == bs && sc > 0 && best && sc < 4 && l.length < norm(best.label).length)) { best = p; bs = sc } }
          if (best) v[o].push({ g, rot, name: best.name, tipo: best.type, ft: best.fieldType, ev: ev || '', pii: pii ? 1 : 0, op: (best.options || []).filter(x => !x.hidden).map(x => [x.value, x.label]) }); else v.faltam[o].push(rot)
        }
        { const ja = new Set(v[o].map(x => x.name)); let ne = 0; for (const p of pr) { if (p.hidden || ja.has(p.name) || ne >= 120) continue; const gB = /botmaker/i.test((gl[p.groupName] || '') + ' ' + p.groupName), gT = /template|whats/i.test(p.name + ' ' + p.label); if (!gB && !gT) continue; ne++; v[o].push({ g: gB ? 'Botmaker · ' + (gl[p.groupName] || p.groupName) : 'Template e WhatsApp', rot: p.label, name: p.name, tipo: p.type, ft: p.fieldType, ev: '', pii: 0, op: (p.options || []).filter(x => !x.hidden).map(x => [x.value, x.label]) }) } }
      }
      try { const gj = await api('/crm/v3/properties/communications/groups').catch(() => ({ results: [] })), gl = {}; (gj.results || []).forEach(x => gl[x.name] = x.label); const pc = (await api('/crm/v3/properties/communications')).results; v.comm = pc.filter(p => !p.hidden && !['hs_timestamp', 'hs_communication_channel_type', 'hs_communication_body'].includes(p.name) && (/botmaker/i.test((gl[p.groupName] || '') + ' ' + p.groupName) || /template|whats|botmaker/i.test(p.name + ' ' + p.label))).slice(0, 40).map(p => ({ n: p.name, r: p.label, op: (p.options || []).filter(x => !x.hidden).map(x => [x.value, x.label]) })) } catch (e) { }
      PCACHE = { t: Date.now(), v }; return v
    };
    const uniDe = t => { t = String(t || '').toLowerCase(); return /unijorge|jorge amado|(^|[^a-z0-9])uj([^a-z0-9]|$)/.test(t) ? 'UNIJORGE' : /veiga de almeida|(^|[^a-z0-9])uva([^a-z0-9]|$)/.test(t) ? 'UVA' : '' };
    const busca = (p, corpo) => api(p, { method: 'POST', body: JSON.stringify(corpo) });
    if (u.pathname != '/buscar') {
      try {
        if (u.pathname == '/campos') {
          const r = {}; for (const o of ['contacts', 'deals']) { const p = await api('/crm/v3/properties/' + o); r[o] = p.results.filter(x => /univers|unidade|marca|institu|curso|polo|campus|cpf/i.test(x.name + ' ' + x.label)).map(x => ({ nome: x.name, rotulo: x.label })) }
          return out(r);
        }
        if (u.pathname == '/estrutura') {
          const [own, pip] = await Promise.all([api('/crm/v3/owners?limit=500').catch(() => ({ results: [] })), api('/crm/v3/pipelines/deals')]);
          const donos = {}; own.results.forEach(o => donos[o.id] = [o.firstName, o.lastName].filter(Boolean).join(' ') || 'Sem nome');
          const funis = pip.results.sort((a, b) => a.displayOrder - b.displayOrder).map(p => ({ id: p.id, nome: p.label, etapas: p.stages.sort((a, b) => a.displayOrder - b.displayOrder).map(s => ({ id: s.id, nome: s.label, fim: s.metadata && s.metadata.isClosed == 'true' ? (+s.metadata.probability >= 1 ? 'g' : 'p') : '' })) }));
          const def = async (o, n) => api('/crm/v3/properties/' + o + '/' + n).catch(() => null);
          const opc = {}, uni = {};
          for (const o of ['contacts', 'deals']) {
            opc[o] = {}; for (const n of (o == 'contacts' ? ['lifecyclestage', 'hs_lead_status', 'hs_analytics_source'] : ['hs_analytics_source'])) { const d = await def(o, n); opc[o][n] = d && d.options ? d.options.filter(x => !x.hidden).map(x => ({ v: x.value, l: x.label })) : [] }
            let nome = env.UNI_PROP || '', d = nome ? await def(o, nome) : await def(o, 'universidade');
            if (!d && !env.UNI_PROP) { const pr = (await api('/crm/v3/properties/' + o).catch(() => ({ results: [] }))).results, ach = pr.find(x => /^\s*universidade\s*$/i.test(x.label || '')) || pr.find(x => /^\s*(ies|institui)/i.test(x.label || '')); if (ach) d = await def(o, ach.name) }
            if (o == 'contacts') {
              const pr = (await api('/crm/v3/properties/contacts').catch(() => ({ results: [] }))).results;
              const cand = pr.filter(x => /univers|^ies|institu|marca|unidade|polo|campus|curso|brand/i.test(x.name + ' ' + (x.label || '')) && !/email|phone|telefone/i.test(x.name)).slice(0, 6).map(x => ({ name: x.name, label: x.label, ops: (x.options || []).filter(z => !z.hidden) }));
              for (const n of ['first_conversion_event_name', 'recent_conversion_event_name', 'hs_analytics_first_url', 'hs_analytics_source_data_2', 'hs_analytics_source_data_1', 'utm_campaign', 'hs_analytics_last_url']) if (!cand.some(c => c.name == n)) cand.push({ name: n, label: n, ops: [] });
              const defs = [], TKU = ['uva*', 'veiga*'], TKJ = ['unijorge*', 'uj'];
              for (const c of cand.slice(0, 12)) {
                const v = { UVA: [], UNIJORGE: [] }; c.ops.forEach(z => { const k = uniDe(z.label + ' ' + z.value); if (k) v[k].push(z.value) });
                const en = v.UVA.length || v.UNIJORGE.length;
                if (en) { const w = []; if (v.UVA.length) w.push({ filters: [{ propertyName: c.name, operator: 'IN', values: v.UVA }] }); if (v.UNIJORGE.length) w.push({ filters: [{ propertyName: c.name, operator: 'IN', values: v.UNIJORGE }] }); let n = 0; try { n = (await busca('/crm/v3/objects/contacts/search', { filterGroups: w, limit: 1, properties: ['hs_object_id'] })).total } catch (e) { } if (n > 0) defs.push({ prop: c.name, rotulo: c.label, tipo: 'enum', val: v, n }); continue }
                const cnt = async toks => { try { return (await busca('/crm/v3/objects/contacts/search', { filterGroups: toks.map(t => ({ filters: [{ propertyName: c.name, operator: 'CONTAINS_TOKEN', value: t }] })), limit: 1, properties: ['hs_object_id'] })).total || 0 } catch (e) { return 0 } };
                const nU = await cnt(TKU), nJ = await cnt(TKJ);
                if (nU > 0 || nJ > 0) defs.push({ prop: c.name, rotulo: c.label, tipo: 'texto', val: { UVA: nU > 0 ? TKU : [], UNIJORGE: nJ > 0 ? TKJ : [] }, nU, nJ, n: nU + nJ });
              }
              defs.sort((a, b) => b.n - a.n);
              { const pick = (k, nk) => { let cu = 0; const set = new Set(); defs.filter(x => x.val[k].length).sort((p, q) => (q[nk] ?? q.n) - (p[nk] ?? p.n)).forEach(x => { if (cu + x.val[k].length <= 5) { cu += x.val[k].length; set.add(x) } }); return set }, su = pick('UVA', 'nU'), sj = pick('UNIJORGE', 'nJ'), fin = defs.filter(x => su.has(x) || sj.has(x)).map(x => ({ ...x, val: { UVA: su.has(x) ? x.val.UVA : [], UNIJORGE: sj.has(x) ? x.val.UNIJORGE : [] } })); uni[o] = fin.length ? { tipo: 'multi', defs: fin } : { tipo: 'nenhuma' } }
              continue
            }
            { const defs = [];
              if (d) { const ops = (d.options || []).filter(x => !x.hidden), v = { UVA: [], UNIJORGE: [] }; ops.forEach(x => { const k = uniDe(x.label + ' ' + x.value); if (k) v[k].push(x.value) });
                defs.push(ops.length && (v.UVA.length || v.UNIJORGE.length) ? { prop: d.name, rotulo: d.label, tipo: 'enum', val: v, opcoes: ops.map(x => x.label) } : { prop: d.name, rotulo: d.label, tipo: 'texto', val: { UVA: ['uva*'], UNIJORGE: ['unijorge*'] } }) }
              if (o == 'deals') {
                const pv = { UVA: [], UNIJORGE: [] }; funis.forEach(f => { const k = uniDe(f.nome); if (k) pv[k].push(f.id) }); if (pv.UVA.length || pv.UNIJORGE.length) defs.push({ prop: 'pipeline', rotulo: 'Nome do funil', tipo: 'pipeline', val: pv });
                defs.push({ prop: 'dealname', rotulo: 'Nome do negócio', tipo: 'texto', val: { UVA: ['uva*', 'veiga*'], UNIJORGE: ['unijorge*', 'uj'] } });
              }
              uni[o] = defs.length ? { tipo: 'multi', defs: defs.slice(0, 5) } : { tipo: 'nenhuma' }; continue }
          }
          let mat = null; try { const pr = (await api('/crm/v3/properties/contacts')).results, c = pr.filter(p => !p.hidden && !/desuso|nao utilizad|obsolet/.test(norm(p.label + ' ' + p.name)) && /(ja|aluno).*(aluno|matricul)|matriculad/.test(norm(p.label))).sort((a, b) => a.label.length - b.label.length)[0]; if (c) { if (c.type == 'bool' || c.fieldType == 'booleancheckbox') mat = { p: c.name, op: 'EQ', v: 'true' }; else { const vs = (c.options || []).filter(o => !o.hidden && /^(sim|s|true)$|matricul|ativo/.test(norm(o.label))).map(o => o.value); mat = vs.length ? { p: c.name, op: 'IN', vs } : { p: c.name, op: 'EQ', v: 'Sim' } } } } catch (e) { }
          let per = null; try { const R0 = await resolver(), f = (R0.deals || []).find(x => x.rot == 'Período letivo'); if (f) { let vs = f.op.map(x => [String(x[0]), String(x[1] || x[0])]); if (!vs.length) { const sj = await busca('/crm/v3/objects/deals/search', { filterGroups: [{ filters: [{ propertyName: f.name, operator: 'HAS_PROPERTY' }] }], sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }], properties: [f.name], limit: 100 }); vs = [...new Set((sj.results || []).map(r => String(r.properties[f.name] || '')).filter(Boolean))].map(x => [x, x]) } per = { p: f.name, v: vs.sort((a, b) => b[1].localeCompare(a[1])).slice(0, 30) } } } catch (e) { }
          return out({ funis, donos, uni, opc, mat, per });
        }
        if (u.pathname == '/propriedades') {
          const ob = u.searchParams.get('obj') == 'deals' ? 'deals' : 'contacts', j = await api('/crm/v3/properties/' + ob);
          return out({ p: j.results.filter(x => !x.hidden).map(x => ({ n: x.name, l: x.label || x.name, t: x.type, f: x.fieldType, o: (x.options || []).filter(z => !z.hidden).slice(0, 80).map(z => ({ v: z.value, l: z.label })) })) });
        }
        if (u.pathname == '/amostra') {
          const ob = u.searchParams.get('obj') == 'deals' ? 'deals' : 'contacts', props = (u.searchParams.get('props') || '').split(',').filter(p => /^[a-z0-9_]{1,80}$/.test(p)).slice(0, 40), s0 = +u.searchParams.get('s') || 0, e0 = +u.searchParams.get('e') || Date.now(), n = Math.min(+u.searchParams.get('n') || 400, 600);
          const rows = []; let after;
          while (rows.length < n) { const j = await busca('/crm/v3/objects/' + ob + '/search', { filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GTE', value: String(s0) }, { propertyName: 'createdate', operator: 'LTE', value: String(e0) }] }], sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }], properties: props, limit: 200, ...(after ? { after } : {}) }); for (const x of j.results) rows.push(props.map(p => x.properties[p] == null ? '' : String(x.properties[p]).slice(0, 200))); after = j.paging && j.paging.next && j.paging.next.after; if (!after) break }
          return out({ r: rows.slice(0, n) });
        }
        if (u.pathname == '/vinculo') {
          if (req.method != 'POST') return out({ erro: 'use POST' }, 405);
          const b = await req.json().catch(() => null); if (!b) return out({ erro: 'pedido inválido' }, 400);
          const nm = x => (Array.isArray(x) ? x : []).map(String).filter(z => /^[a-z0-9_]{1,80}$/.test(z)).slice(0, 10), cp = nm(b.cp), dp = nm(b.dp), n = Math.min(+b.n || 80, 100);
          const R0 = await resolver().catch(() => null), cpfC = R0 && R0.cpf ? (R0.cpfp.contacts.length ? R0.cpfp.contacts : R0.cpf.contacts).slice(0, 2) : [], cpfD = R0 && R0.cpf ? (R0.cpfp.deals.length ? R0.cpfp.deals : R0.cpf.deals).slice(0, 2) : [];
          const fl = [{ propertyName: 'createdate', operator: 'GTE', value: String(+b.d0 || 0) }, { propertyName: 'createdate', operator: 'LTE', value: String(+b.d1 || Date.now()) }, { propertyName: 'num_associated_deals', operator: 'GTE', value: '1' }];
          const cj = await busca('/crm/v3/objects/contacts/search', { filterGroups: [{ filters: fl }], sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }], properties: ['createdate', ...cp, ...cpfC], limit: n, ...(b.after ? { after: String(b.after) } : {}) });
          const cs = cj.results || [], nx = cj.paging && cj.paging.next ? cj.paging.next.after : '';
          const cls = vals => { const f = new Set(); for (const v of vals) { const k = uniDe(v); if (k) f.add(k) } return f.size == 1 ? [...f][0] : f.size > 1 ? 'AMBOS' : '' };
          const res = { total: cs.length, cad: { UVA: 0, UNIJORGE: 0, AMBOS: 0 }, neg: { UVA: 0, UNIJORGE: 0, AMBOS: 0 }, cpf: { UVA: 0, UNIJORGE: 0, AMBOS: 0 }, sem: 0, semNeg: 0 }, pend = [];
          for (const c of cs) { const k = cls(cp.map(p => c.properties[p] || '')); if (k) res.cad[k]++; else pend.push(c.id) }
          if (pend.length) {
            const pl = await api('/crm/v3/pipelines/deals').catch(() => ({ results: [] })), pn = {}; (pl.results || []).forEach(p => pn[p.id] = p.label);
            const aj = await api('/crm/v4/associations/contacts/deals/batch/read', { method: 'POST', body: JSON.stringify({ inputs: pend.map(id => ({ id })) }) }).catch(() => ({ results: [] })), dono = {}, ids = [];
            for (const r of (aj.results || [])) for (const t of (r.to || []).slice(0, 4)) { const id = String(t.toObjectId); (dono[String(r.from.id)] || (dono[String(r.from.id)] = [])).push(id); ids.push(id) }
            const dv = {};
            for (let i = 0; i < ids.length && i < 400; i += 100) { const rj = await api('/crm/v3/objects/deals/batch/read', { method: 'POST', body: JSON.stringify({ properties: ['pipeline', 'dealname', ...dp], inputs: ids.slice(i, i + 100).map(id => ({ id })) }) }).catch(() => ({ results: [] })); for (const d of (rj.results || [])) dv[d.id] = [pn[d.properties.pipeline] || '', d.properties.dealname || '', ...dp.map(p => d.properties[p] || '')] }
            const rest = [];
            for (const id of pend) { const ds = dono[id] || []; const k = ds.length ? cls(ds.flatMap(d => dv[d] || [])) : ''; if (k) res.neg[k]++; else rest.push([id, ds.length ? 1 : 0]) }
            // cruza por CPF: negócios de qualquer contato com o mesmo CPF
            const cc = {}; for (const c of cs) { for (const p of cpfC) { const d = dig(c.properties[p]); if (cpfOk(d)) { cc[c.id] = d; break } } }
            const cvals = [...new Set(rest.map(([id]) => cc[id]).filter(Boolean))].slice(0, 100), cm = {};
            if (cvals.length && cpfD.length) for (let i = 0; i < cvals.length; i += 50) {
              const ch = cvals.slice(i, i + 50), vs = ch.flatMap(d => [d, d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9)]);
              for (const p of cpfD) {
                try {
                  const rj = await busca('/crm/v3/objects/deals/search', { filterGroups: [{ filters: [{ propertyName: p, operator: 'IN', values: vs }] }], properties: ['pipeline', 'dealname', ...dp, ...cpfD], limit: 100 });
                  for (const d of (rj.results || [])) { const pr = d.properties || {}, k = cls([pn[pr.pipeline] || '', pr.dealname || '', ...dp.map(x => pr[x] || '')]); if (!k) continue; for (const q of cpfD) { const dd = dig(pr[q]); if (dd) (cm[dd] || (cm[dd] = new Set())).add(k) } }
                } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e }
              }
            }
            for (const [id, tem] of rest) { const st = cc[id] && cm[cc[id]] ? cm[cc[id]] : null; if (st && st.size) res.cpf[st.size > 1 ? 'AMBOS' : [...st][0]]++; else if (tem) res.sem++; else res.semNeg++ }
          }
          return out({ ...res, after: nx || '' });
        }
        if (u.pathname == '/jornada') {
          if (req.method != 'POST') return out({ erro: 'use POST' }, 405);
          const b = await req.json().catch(() => null); if (!b) return out({ erro: 'pedido inválido' }, 400);
          const OPS2 = ['EQ', 'IN', 'GTE', 'LTE', 'CONTAINS_TOKEN'], mk = f => { if (!/^[a-z0-9_]{1,80}$/.test(f.p || '') || !OPS2.includes(f.op)) throw new Error('filtro inválido'); const o = { propertyName: f.p, operator: f.op }; if (Array.isArray(f.vs)) o.values = f.vs.slice(0, 100).map(String); else if (f.v != null) o.value = String(f.v); return o };
          const pls = (Array.isArray(b.pls) ? b.pls : []).map(String).filter(x => /^[\w-]{1,40}$/.test(x)).slice(0, 12), ets = (Array.isArray(b.et) ? b.et : []).map(String).filter(x => /^[\w-]{1,40}$/.test(x)).slice(0, 60), n = Math.min(+b.n || 50, 60);
          const CT = b.obj == 'contacts', mp = (Array.isArray(b.mp) ? b.mp : []).map(String).filter(x => /^[a-z0-9_]{1,80}$/.test(x)).slice(0, 12), op = ['hs_analytics_source', 'hs_analytics_source_data_1', 'utm_source', 'utm_medium', 'utm_campaign', 'first_conversion_event_name', 'lifecyclestage'];
          if (!CT && !pls.length) return out({ erro: 'informe os funis' }, 400);
          const base = [{ propertyName: 'createdate', operator: 'GTE', value: String(+b.d0 || 0) }, { propertyName: 'createdate', operator: 'LTE', value: String(+b.d1 || Date.now()) }, ...(CT ? [] : [{ propertyName: 'pipeline', operator: 'IN', values: pls }])];
          const ex = (Array.isArray(b.f) ? b.f : []).slice(0, 4).map(mk), og = Array.isArray(b.o) && b.o.length ? b.o.slice(0, 5).map(g => ({ filters: [...base, ...ex, ...(Array.isArray(g) ? g : []).slice(0, 3).map(mk)] })) : [{ filters: [...base, ...ex] }];
          const SN = CT ? null : await nomesDe(api, 'deals'), eprops = ets.map(x => entrou(SN, x));
          const dj = await busca('/crm/v3/objects/' + (CT ? 'contacts' : 'deals') + '/search', { filterGroups: og, sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }], properties: CT ? ['createdate', ...mp, ...op] : ['createdate', 'pipeline', 'dealstage', ...eprops], limit: n, ...(b.after ? { after: String(b.after) } : {}) });
          const deals = dj.results || [], nx = dj.paging && dj.paging.next ? dj.paging.next.after : '';
          const ct = {}; // deal -> contato
          if (CT) deals.forEach(d => ct[d.id] = String(d.id)); else if (deals.length) { const aj = await api('/crm/v4/associations/deals/contacts/batch/read', { method: 'POST', body: JSON.stringify({ inputs: deals.map(d => ({ id: d.id })) }) }).catch(() => ({ results: [] })); (aj.results || []).forEach(r => { if (r.to && r.to[0]) ct[r.from.id] = String(r.to[0].toObjectId) }) }
          const cids = [...new Set(Object.values(ct))], ev = {}; // contato -> [[ts,codigo]]
          const R1 = await resolver().catch(() => null), cdef = ((R1 && R1.comm) || []).filter(x => /respond|repl|status|lid|visual|entreg|direc|receb|sentido/i.test(x.r + ' ' + x.n)).slice(0, 8), lbl = (x, v) => ((x.op.find(z => z[0] == v) || [])[1]) || v;
          const waResp = p => cdef.some(x => p[x.n] && /respond|repl|receb|inbound|incoming|do cliente|do contato/i.test(String(p[x.n]) + ' ' + lbl(x, p[x.n])));
          const tipos = [['communications', ['hs_timestamp', 'hs_communication_channel_type', ...cdef.map(x => x.n)], p => /whats/i.test(p.hs_communication_channel_type || '') ? (waResp(p) ? 'x' : 'w') : /sms/i.test(p.hs_communication_channel_type || '') ? 's' : 'o'], ['emails', ['hs_timestamp', 'hs_email_direction'], p => /incoming/i.test(p.hs_email_direction || '') ? 'r' : 'm'], ['calls', ['hs_timestamp'], () => 'l'], ['meetings', ['hs_timestamp'], () => 'u']];
          let trunc = 0;
          if (cids.length) { try { for (let i = 0; i < cids.length; i += 100) { const rj = await api('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: ['hs_email_last_email_name'], propertiesWithHistory: ['hs_email_last_email_name', 'hs_email_last_reply_date'], inputs: cids.slice(i, i + 100).map(id => ({ id })) }) }); for (const x of (rj.results || [])) { const H = x.propertiesWithHistory || {}, L = ev[x.id] || (ev[x.id] = []); for (const v of (H.hs_email_last_email_name || [])) { const t = v.value ? +new Date(v.timestamp) || 0 : 0; if (t) L.push([t, 'm']) } for (const v of (H.hs_email_last_reply_date || [])) { const t = +new Date(v.value) || +v.value || 0; if (t) L.push([t, 'r']) } } } } catch (e) { if (e.st == 401 || e.st == 403) throw e } }
          if (cids.length) for (const [ob, props, cod] of tipos) {
            try {
              const aj = await api('/crm/v4/associations/contacts/' + ob + '/batch/read', { method: 'POST', body: JSON.stringify({ inputs: cids.map(id => ({ id })) }) }), dono = {}, ids = [];
              for (const r of (aj.results || [])) for (const t of (r.to || []).slice(0, 40)) { if (ids.length >= 500) { trunc = 1; break } const id = String(t.toObjectId); dono[id] = String(r.from.id); ids.push(id) }
              for (let i = 0; i < ids.length; i += 100) { const rj = await api('/crm/v3/objects/' + ob + '/batch/read', { method: 'POST', body: JSON.stringify({ properties: props, inputs: ids.slice(i, i + 100).map(id => ({ id })) }) }); for (const x of (rj.results || [])) { const t = +new Date(x.properties.hs_timestamp) || 0; if (t) (ev[dono[x.id]] || (ev[dono[x.id]] = [])).push([t, cod(x.properties)]) } }
            } catch (e) { if (e.st == 401 || e.st == 403) throw e }
          }
          if (CT) return out({ d: deals.map(d => { const p = d.properties, e = {}; mp.forEach(x => { const v = p[x]; const t = v ? (+v || +new Date(v)) : 0; if (t) e[x] = t }); return { id: d.id, c: +new Date(p.createdate) || 0, e, o: op.map(k => p[k] || ''), ev: (ev[d.id] || []).sort((a, b) => a[0] - b[0]) } }), after: nx || '', trunc });
          return out({ d: deals.map(d => { const p = d.properties, e = {}; ets.forEach((x, ix) => { const v = p[eprops[ix]]; const t = v ? (+v || +new Date(v)) : 0; if (t) e[x] = t }); return { id: d.id, pl: p.pipeline, c: +new Date(p.createdate) || 0, e, ev: (ev[ct[d.id]] || []).sort((a, b) => a[0] - b[0]), sc: ct[d.id] ? 0 : 1 } }), after: nx || '', trunc });
        }
        if (u.pathname == '/emails') {
          let after, all = [];
          for (let i = 0; i < 10; i++) { const j = await api('/marketing/v3/emails?limit=100&includeStats=true&archived=false' + (after ? '&after=' + after : '')); all.push(...j.results); after = j.paging && j.paging.next && j.paging.next.after; if (!after) break }
          return out({ e: all.map(x => { const c = (x.stats && x.stats.counters) || {}; return { n: x.name || '', t: x.type || '', s: x.state || '', p: x.publishDate || x.publishedAt || x.createdAt || '', c: { sent: c.sent || 0, delivered: c.delivered || 0, open: c.open || 0, click: c.click || 0, reply: c.reply || 0, bounce: c.bounce || 0, unsub: c.unsubscribed || 0, spam: c.spamreport || 0 } } }) });
        }
        if (u.pathname == '/contar') {
          if (req.method != 'POST') return out({ erro: 'use POST' }, 405);
          const b = await req.json().catch(() => null); if (!b || !Array.isArray(b.q)) return out({ erro: 'pedido inválido' }, 400);
          const ob = ['contacts', 'deals', 'calls', 'emails', 'meetings', 'communications', 'notes', 'tasks'].includes(b.obj) ? b.obj : 'deals', OPS = ['EQ', 'NEQ', 'IN', 'NOT_IN', 'GTE', 'LTE', 'GT', 'LT', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN'];
          const qs = b.q.slice(0, 40), res = {}, erros = [];
          if (!PNOM[ob] || Date.now() - PNOM[ob].t > 36e5) { const pj = await api('/crm/v3/properties/' + ob).catch(() => null); PNOM[ob] = { t: Date.now(), s: pj && pj.results ? new Set(pj.results.map(x => x.name)) : null } }
          const conhece = n => !PNOM[ob].s || PNOM[ob].s.has(n);
          const tr = f => (ob == 'deals' && f && /^hs_date_entered_/.test(f.p || '')) ? { ...f, p: entrou(PNOM[ob].s, f.p.slice(16)) } : f;
          for (const x of qs) { if (Array.isArray(x.f)) x.f = x.f.map(tr); if (Array.isArray(x.o)) x.o = x.o.map(g => Array.isArray(g) ? g.map(tr) : g) }
          const um = async x => {
            const fl = (Array.isArray(x.f) ? x.f : []).slice(0, 12).map(f => { if (!/^[a-z0-9_]{1,80}$/.test(f.p || '') || !OPS.includes(f.op)) throw new Error('filtro inválido'); const o = { propertyName: f.p, operator: f.op }; if (Array.isArray(f.vs)) o.values = f.vs.slice(0, 100).map(String); else if (f.v != null) o.value = String(f.v); return o });
            const gr = Array.isArray(x.o) && x.o.length ? x.o.slice(0, 5).map(g => ({ filters: [...fl, ...(Array.isArray(g) ? g : []).slice(0, 3).map(f => { if (!/^[a-z0-9_]{1,80}$/.test(f.p || '') || !OPS.includes(f.op)) throw new Error('filtro inválido'); const o = { propertyName: f.p, operator: f.op }; if (Array.isArray(f.vs)) o.values = f.vs.slice(0, 100).map(String); else if (f.v != null) o.value = String(f.v); return o })] })) : [{ filters: fl }];
            const falta = [...new Set(gr.flatMap(g => g.filters.map(f => f.propertyName)))].find(n => !conhece(n)); if (falta) throw new Error('propriedade inexistente: ' + falta);
            const j = await busca('/crm/v3/objects/' + ob + '/search', { filterGroups: gr, limit: 1, properties: ['hs_object_id'] }); res[x.i] = j.total
          };
          let k = 0; while (k < qs.length) { const x = qs[k++]; try { await um(x) } catch (e) { res[x.i] = -1; erros.push(String(e.message || e).slice(0, 140)); if (e.st == 401 || e.st == 403) throw e } await espera(120) }
          return out({ r: res, e: [...new Set(erros)].slice(0, 4) });
        }
        const obj = u.searchParams.get('obj') == 'contacts' ? 'contacts' : 'deals', desde = +u.searchParams.get('desde') || 0, LIM = 200, PAG = 8;
        let uniP = env.UNI_PROP || '';
        if (!uniP) { const pr = (await api('/crm/v3/properties/' + obj).catch(() => ({ results: [] }))).results, ach = pr.find(x => x.name == 'universidade') || pr.find(x => /^\s*universidade\s*$/i.test(x.label || '')) || pr.find(x => /^\s*(ies|institui)/i.test(x.label || '') || /^(ies|instituicao)/i.test(x.name)); if (ach) uniP = ach.name }
        const props = obj == 'deals' ? ['createdate', 'closedate', 'pipeline', 'dealstage', 'amount', 'hubspot_owner_id', 'hs_analytics_source', 'dealname'] : ['createdate', 'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id', 'hs_analytics_source', 'first_conversion_event_name', 'first_conversion_date'];
        if (uniP) props.push(uniP);
        const funil = {}; if (obj == 'deals') (await api('/crm/v3/pipelines/deals')).results.forEach(p => funil[p.id] = p.label);
        const r = [], base = { filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GT', value: String(desde) }] }], sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }], properties: props, limit: LIM };
        let after, mais = false, ult = desde;
        for (let i = 0; i < PAG; i++) {
          const j = await busca('/crm/v3/objects/' + obj + '/search', after ? { ...base, after } : base);
          for (const x of j.results) {
            const p = x.properties, c = local(p.createdate); if (!c) continue; ult = Date.parse(p.createdate) || ult;
            const un = uniDe(uniP && p[uniP]) || uniDe(obj == 'deals' ? (funil[p.pipeline] || '') + ' ' + (p.dealname || '') : p.first_conversion_event_name);
            if (obj == 'deals') { const f = local(p.closedate); r.push({ c: c.d, f: f ? f.d : '', pl: p.pipeline, st: p.dealstage, v: +p.amount || 0, ow: p.hubspot_owner_id || '', or: p.hs_analytics_source || '', un }) }
            else { const f = local(p.first_conversion_date); r.push({ c: c.d, ls: p.lifecyclestage || '', ld: p.hs_lead_status || '', ow: p.hubspot_owner_id || '', or: p.hs_analytics_source || '', fm: p.first_conversion_event_name || '', fd: f ? f.d : '', un }) }
          }
          after = j.paging && j.paging.next && j.paging.next.after;
          if (!after) break; if (i == PAG - 1) mais = true;
        }
        return out({ r, prox: ult, mais, prop: uniP });
      } catch (e) { return out({ erro: String(e.message || e).slice(0, 200) }, e.st == 401 || e.st == 403 ? 502 : 500) }
    }
    const qc = dig(u.searchParams.get('cpf')), qt = dig(u.searchParams.get('tel')), q = dig(u.searchParams.get('q')); if (!qc && !qt && q.length < 10) return out({ erro: 'informe telefone com DDD ou CPF' }, 400); if ((qc && qc.length != 11) || (qt && (qt.length < 10 || qt.length > 13))) return out({ erro: 'CPF com 11 dígitos e telefone com DDD' }, 400);
    try {
      let cpfProp = env.CPF_PROP || 'cpf', ids = new Set(), via = {}, cpfNames = [], cpfDeal = []; const R0 = await resolver().catch(() => null);
      cpfNames = R0 && R0.cpf ? [...(R0.cpfp.contacts.length ? R0.cpfp.contacts : R0.cpf.contacts)] : []; if (env.CPF_PROP && !cpfNames.includes(env.CPF_PROP) && !(R0 && R0.cpf && R0.cpf.contacts.includes(env.CPF_PROP))) cpfNames.unshift(env.CPF_PROP); if (!cpfNames.length) cpfNames = ['cpf'];
      cpfDeal = R0 && R0.cpf ? [...(R0.cpfp.deals.length ? R0.cpfp.deals : R0.cpf.deals)] : []; const cpfPrim = [...cpfNames], cpfAlvo = qc || (cpfOk(q) ? q : ''); let viaCpf = false;
      const buscaCt = async (prop, vals) => { if (!vals.length) return; try { const r = await api('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify({ filterGroups: vals.slice(0, 5).map(v => ({ filters: [{ propertyName: prop, operator: 'EQ', value: v }] })), properties: ['hs_object_id'], limit: 50 }) }); r.results.forEach(x => { ids.add(x.id); (via[x.id] = via[x.id] || new Set()).add('contato: ' + prop + ' = ' + vals[0]) }) } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e } };
      const buscaNg = async (prop, vals) => { try { const r = await api('/crm/v3/objects/deals/search', { method: 'POST', body: JSON.stringify({ filterGroups: vals.map(v => ({ filters: [{ propertyName: prop, operator: 'EQ', value: v }] })), properties: ['hs_object_id'], limit: 30 }) }); for (const d of r.results.slice(0, 5)) { const a = await api('/crm/v4/objects/deals/' + d.id + '/associations/contacts').catch(() => ({ results: [] })); a.results.forEach(x => { ids.add(String(x.toObjectId)); (via[String(x.toObjectId)] = via[String(x.toObjectId)] || new Set()).add('negócio ' + d.id + ': ' + prop) }) } } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e } };
      if (qc || qt) {
        if (qc) { const fm = qc.slice(0, 3) + '.' + qc.slice(3, 6) + '.' + qc.slice(6, 9) + '-' + qc.slice(9); for (const pn of cpfNames) await buscaCt(pn, [qc, fm]); for (const pn of cpfDeal) await buscaNg(pn, [qc, fm]); viaCpf = !qt && ids.size > 0; if (!ids.size) for (const pn of cpfNames) { try { const r = await api('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: pn, operator: 'CONTAINS_TOKEN', value: qc }] }], properties: ['hs_object_id'], limit: 50 }) }); r.results.forEach(x => { ids.add(x.id); (via[x.id] = via[x.id] || new Set()).add('contato: ' + pn + ' contém ' + qc) }) } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e } } }
        if (qt) { const n = qt.length > 11 && qt.startsWith('55') ? qt.slice(2) : qt; if (n.length >= 10 && n.length <= 11) { const a = n.slice(0, 2), r = n.slice(2), m = r.length == 9 ? r.slice(0, 5) + '-' + r.slice(5) : r.slice(0, 4) + '-' + r.slice(4); const v = [n, '55' + n, '+55' + n, '(' + a + ') ' + m, '+55 ' + a + ' ' + m]; await buscaCt('mobilephone', v); await buscaCt('phone', v) } }
      } else {
      if (cpfOk(q)) { const fq = q.slice(0, 3) + '.' + q.slice(3, 6) + '.' + q.slice(6, 9) + '-' + q.slice(9); for (const pn of cpfNames) await buscaCt(pn, [q, fq]); for (const pn of cpfDeal) await buscaNg(pn, [q, fq]); viaCpf = ids.size > 0 }
      const n = q.length > 11 && q.startsWith('55') ? q.slice(2) : q;
      if (n.length >= 10 && n.length <= 11 && !(cpfOk(q) && ids.size)) { const a = n.slice(0, 2), r = n.slice(2), m = r.length == 9 ? r.slice(0, 5) + '-' + r.slice(5) : r.slice(0, 4) + '-' + r.slice(4); const v = [n, '55' + n, '+55' + n, '(' + a + ') ' + m, '+55 ' + a + ' ' + m]; await buscaCt('mobilephone', v); await buscaCt('phone', v) }
      }
      if (!ids.size) return out({ contatos: [], eventos: [] });
      const [own, pip] = await Promise.all([api('/crm/v3/owners?limit=500').catch(() => ({ results: [] })), api('/crm/v3/pipelines/deals').catch(() => ({ results: [] }))]);
      const dono = {}; own.results.forEach(o => dono[o.id] = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.id);
      const etapa = {}, funil = {}; pip.results.forEach(p => { funil[p.id] = p.label; p.stages.forEach(s => etapa[s.id] = s.label) });
      const ev = [], cts = [], push = (t, ty, tx, x) => { const l = local(t); if (l) ev.push({ ...l, ty, tx, ...x }) };
      const RV = await resolver().catch(() => ({ contacts: [], deals: [], comm: [] })), cN = RV.contacts.map(x => x.name), dN = RV.deals.map(x => x.name);
      const fv = (d, v) => { if (v == null || v === '') return ''; if (d.name == 'dealstage') return etapa[v] || v; if (d.name == 'pipeline') return funil[v] || v; if (d.tipo == 'bool' || (d.ft == 'booleancheckbox' && /^(true|false)$/i.test(v))) return /^true$/i.test(v) ? 'Sim' : 'Não'; if (d.tipo == 'enumeration') return String(v).split(';').map(z => (d.op.find(o => o[0] == z) || [])[1] || z).join(', '); if (d.tipo == 'date' || d.tipo == 'datetime') { const l = local(v); return l ? l.d.split('-').reverse().join('/') : '' } if (d.g == 'Financeiro' && d.tipo == 'number' && /^-?\d+(\.\d+)?$/.test(String(v))) return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return String(v).slice(0, 200) };
      const ficha = { contatos: [], negocios: [], comunicacoes: [] }, ident = { contatos: [], ra: [] }, fcpf = v => { const d = dig(v); return d.length == 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : String(v || '') };
      const assoc = async (id, tipo, props, hist) => { const a = await api('/crm/v4/objects/contacts/' + id + '/associations/' + tipo).catch(() => ({ results: [] })); const ii = a.results.map(x => ({ id: String(x.toObjectId) })).slice(0, 100); if (!ii.length) return []; const r = await api('/crm/v3/objects/' + tipo + '/batch/read', { method: 'POST', body: JSON.stringify(hist ? { inputs: ii, properties: props, propertiesWithHistory: hist } : { inputs: ii, properties: props }) }).catch(() => ({ results: [] })); return r.results };
      for (const id of [...ids].slice(0, 5)) {
        const c = await api('/crm/v3/objects/contacts/' + id + '?properties=' + [...new Set([...CONTATO, ...cN, 'firstname', 'lastname', 'email', 'phone', 'mobilephone', ...cpfNames])].join(',') + '&propertiesWithHistory=lifecyclestage,hs_lead_status,hubspot_owner_id,recent_conversion_event_name,hs_email_last_email_name,hs_email_last_open_date,hs_email_last_click_date,hs_email_last_reply_date'), p = c.properties, ow = dono[p.hubspot_owner_id] || '';
        if (viaCpf && cpfAlvo) { const dg2 = n => dig(p[n]), pr = cpfPrim.map(dg2).filter(Boolean), ou = cpfNames.filter(n => !cpfPrim.includes(n)).map(dg2).filter(Boolean); if (!(pr.length ? pr.includes(cpfAlvo) : ou.includes(cpfAlvo))) continue }
        ident.contatos.push({ via: [...(via[id] || [])].join(' · '), nome: [p.firstname, p.lastname].filter(Boolean).join(' '), cpf: fcpf(p[cpfNames.find(n => p[n])] || ''), email: p.email || '', tel: p.phone || '', cel: p.mobilephone || '' });
        ficha.contatos.push({ id, cr: +new Date(p.createdate) || 0, campos: RV.contacts.map(d => ({ g: d.g, r: d.rot, v: fv(d, p[d.name]) })).filter(x => x.v) });
        cts.push({ id, etapa: p.lifecyclestage, status: p.hs_lead_status, origem: p.hs_analytics_source, proprietario: ow });
        push(p.createdate, 'criado', 'Contato criado', { st: p.lifecyclestage, or: p.hs_analytics_source, ow });
        for (const v of (c.propertiesWithHistory?.lifecyclestage || [])) push(v.timestamp, 'ciclo', 'Mudou para a etapa: ' + v.value, { ow });
        for (const v of (c.propertiesWithHistory?.hs_lead_status || [])) push(v.timestamp, 'ciclo', 'Status do lead: ' + v.value, { ow });
        const hf = c.propertiesWithHistory?.recent_conversion_event_name || [];
        if (hf.length) { for (const v of hf) push(v.timestamp, 'form', 'Formulário preenchido: ' + v.value, {}); if (p.first_conversion_date && !hf.some(v => local(v.timestamp)?.d == local(p.first_conversion_date)?.d)) push(p.first_conversion_date, 'form', 'Formulário (primeira conversão): ' + (p.first_conversion_event_name || ''), {}) }
        else { push(p.first_conversion_date, 'form', 'Formulário (primeira conversão): ' + (p.first_conversion_event_name || ''), {}); if (p.recent_conversion_date != p.first_conversion_date) push(p.recent_conversion_date, 'form', 'Formulário (conversão mais recente): ' + (p.recent_conversion_event_name || ''), {}) }
        for (const v of (c.propertiesWithHistory?.hubspot_owner_id || [])) if (v.value) push(v.timestamp, 'owner', 'Contato atribuído a ' + (dono[v.value] || 'proprietário'), { ow: dono[v.value] || '' });
        push(p.hs_analytics_first_visit_timestamp, 'visita', 'Primeira visita ao site', {});
        if (p.hs_analytics_last_visit_timestamp && p.hs_analytics_last_visit_timestamp != p.hs_analytics_first_visit_timestamp) push(p.hs_analytics_last_visit_timestamp, 'visita', 'Última visita ao site · ' + (p.hs_analytics_num_visits || 0) + ' visita(s), ' + (p.hs_analytics_num_page_views || 0) + ' páginas vistas', {});
        push(p.hs_sales_email_last_replied, 'resp', 'Respondeu a um e-mail de vendas', {}); push(p.hs_sales_email_last_opened, 'email', 'E-mail de vendas aberto', {});
        push(p.hs_email_first_send_date, 'email', 'Primeiro e-mail de marketing enviado', {}); push(p.hs_email_first_open_date, 'email', 'Primeiro e-mail de marketing aberto', {});
        for (const [k, n] of [['subscriber', 'Assinante'], ['lead', 'Lead'], ['marketingqualifiedlead', 'MQL'], ['salesqualifiedlead', 'SQL'], ['opportunity', 'Oportunidade'], ['customer', 'Cliente']]) { const t = p['hs_lifecyclestage_' + k + '_date']; if (t && !(c.propertiesWithHistory?.lifecyclestage || []).some(v => v.value == k)) push(t, 'ciclo', 'Mudou para a etapa: ' + k, { ow }) }
        { const H = c.propertiesWithHistory || {}, nomes = (H.hs_email_last_email_name || []).filter(v => v.value).map(v => ({ t: +new Date(v.timestamp) || 0, n: String(v.value) })).sort((a, b) => a.t - b.t), mk = t => { let r = ''; for (const x of nomes) if (x.t <= t + 6e4) r = x.n; return r }, seen = new Set();
          for (const v of nomes) { seen.add(v.t); push(v.t, 'email', 'E-mail de marketing enviado: ' + v.n, { dir: 'Enviado', sit: 'Enviado (marketing)', det: [{ r: 'E-mail de marketing', v: v.n.slice(0, 200) }] }) }
          if (!nomes.length) push(p.hs_email_last_send_date, 'email', 'E-mail de marketing enviado: ' + (p.hs_email_last_email_name || ''), {});
          const hv = (k, rot, sit) => { const arr = (H[k] || []).map(v => +new Date(v.value) || +v.value || 0).filter(Boolean); if (!arr.length && p[k]) arr.push(+new Date(p[k]) || +p[k] || 0); for (const t of [...new Set(arr)]) { const nm = mk(t); push(t, 'email', rot + (nm ? ': ' + nm : ''), { dir: 'Enviado', sit, det: nm ? [{ r: 'E-mail de marketing', v: nm.slice(0, 200) }] : [] }) } };
          hv('hs_email_last_open_date', 'E-mail de marketing aberto', 'Lido'); hv('hs_email_last_click_date', 'E-mail de marketing clicado', 'Clicou'); }
        const [neg, lig, mail, reu, com, nota, tar] = await Promise.all([assoc(id, 'deals', [...new Set(['dealstage', 'pipeline', 'amount', 'createdate', 'closedate', 'hubspot_owner_id', ...dN])], ['dealstage']), assoc(id, 'calls', ['hs_timestamp', 'hs_call_direction', 'hs_call_duration', 'hs_call_status', 'hs_call_title', 'hs_call_body']), assoc(id, 'emails', ['hs_timestamp', 'hs_email_direction', 'hs_email_status', 'hs_email_subject', 'hs_email_text', 'hs_email_open_count', 'hs_email_click_count', 'hs_email_sent_count', 'hs_email_reply_count']), assoc(id, 'meetings', ['hs_timestamp', 'hs_meeting_outcome', 'hs_meeting_title', 'hs_meeting_body', 'hs_meeting_start_time', 'hs_meeting_end_time']), assoc(id, 'communications', ['hs_timestamp', 'hs_communication_channel_type', 'hs_communication_body', 'hs_communication_logged_from', ...RV.comm.map(x => x.n)]), assoc(id, 'notes', ['hs_timestamp', 'hubspot_owner_id']), assoc(id, 'tasks', ['hs_timestamp', 'hs_task_status', 'hs_task_type', 'hubspot_owner_id'])]);
        { const ex = (tipo, props, dest, ja) => Promise.all(neg.slice(0, 3).map(async d => { const a = await api('/crm/v4/objects/deals/' + d.id + '/associations/' + tipo).catch(() => ({ results: [] })), ii = a.results.map(x => ({ id: String(x.toObjectId) })).filter(x => !ja.has(x.id)).slice(0, 100); if (!ii.length) return; const r = await api('/crm/v3/objects/' + tipo + '/batch/read', { method: 'POST', body: JSON.stringify({ inputs: ii, properties: props }) }).catch(() => ({ results: [] })); for (const x of r.results) if (!ja.has(String(x.id))) { ja.add(String(x.id)); dest.push(x) } }));
          const jm = new Set(mail.map(x => String(x.id))), jc = new Set(com.map(x => String(x.id)));
          await ex('emails', ['hs_timestamp', 'hs_email_direction', 'hs_email_status', 'hs_email_subject', 'hs_email_text', 'hs_email_open_count', 'hs_email_click_count', 'hs_email_sent_count', 'hs_email_reply_count'], mail, jm);
          await ex('communications', ['hs_timestamp', 'hs_communication_channel_type', 'hs_communication_body', 'hs_communication_logged_from', ...RV.comm.map(x => x.n)], com, jc); }
        neg.forEach(d => { const q = d.properties, x = { st: etapa[q.dealstage] || q.dealstage, pl: funil[q.pipeline] || q.pipeline, v: +q.amount || 0, ow: dono[q.hubspot_owner_id] || '' }; x.did = d.id; { const rf = RV.deals.find(f => f.rot == 'RA'); if (rf && q[rf.name] && !ident.ra.includes(String(q[rf.name]))) ident.ra.push(String(q[rf.name])) } ficha.negocios.push({ id: d.id, cr: +new Date(q.createdate) || 0, per: (() => { const pf = RV.deals.find(f => f.rot == 'Período letivo'); const m = pf && String(q[pf.name] || '').replace(/\D/g, '').slice(0, 5); return +m || 0 })(), campos: RV.deals.map(f => ({ g: f.g, r: f.rot, v: fv(f, q[f.name]) })).filter(z => z.v) }); for (const f of RV.deals) if (f.ev && q[f.name] && f.name != 'closedate') push(q[f.name], 'marco', f.ev, { ...x }); push(q.createdate, 'neg', 'Negócio criado', x); for (const v of (d.propertiesWithHistory?.dealstage || [])) push(v.timestamp, 'etapa', 'Negócio mudou para a etapa: ' + (etapa[v.value] || v.value), { ...x, st: etapa[v.value] || v.value }); if (q.closedate) push(q.closedate, 'fech', 'Negócio: data de fechamento', x) });
        nota.forEach(d => push(d.properties.hs_timestamp, 'nota', 'Nota registrada no contato', { ow: dono[d.properties.hubspot_owner_id] || '' }));
        tar.forEach(d => push(d.properties.hs_timestamp, 'tarefa', 'Tarefa' + (d.properties.hs_task_type ? ' (' + d.properties.hs_task_type.toLowerCase() + ')' : '') + (d.properties.hs_task_status ? ' · ' + d.properties.hs_task_status.toLowerCase() : ''), { ow: dono[d.properties.hubspot_owner_id] || '' }));
        const lm = x => String(x == null ? '' : x).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), dt = (arr) => arr.filter(z => z[1] !== '' && z[1] != null && lm(z[1]) !== '').map(z => ({ r: z[0], v: lm(z[1]).slice(0, 200) }));
        lig.forEach(d => { const p = d.properties, inb = /in/i.test(p.hs_call_direction || ''), st = String(p.hs_call_status || ''), sit = /completed/i.test(st) ? 'Atendida' : /no_answer|busy|failed|canceled|missed/i.test(st) ? 'Não atendida' : st ? st.toLowerCase() : '', dur = p.hs_call_duration ? Math.round(p.hs_call_duration / 1000) : 0; push(p.hs_timestamp, 'ligacao', 'Ligação ' + (inb ? 'recebida' : 'realizada') + (dur ? ' · ' + dur + ' s' : ''), { dir: inb ? 'Recebida' : 'Enviada', sit, det: dt([['Título', p.hs_call_title], ['Duração', dur ? dur + ' s' : ''], ['Status', st], ['Anotações', p.hs_call_body]]) }) });
        mail.forEach(d => { const p = d.properties, r = /incoming/i.test(p.hs_email_direction || ''), oc = +p.hs_email_open_count || 0, cc = +p.hs_email_click_count || 0, stt = String(p.hs_email_status || ''), sit = r ? 'Respondeu' : /bounce|fail/i.test(stt) ? 'Falhou' : cc ? 'Clicou' : oc ? 'Lido' : /deliver/i.test(stt) ? 'Entregue, sem leitura registrada' : 'Enviado, sem leitura registrada'; push(p.hs_timestamp, r ? 'resp' : 'email', (r ? 'E-mail recebido do contato' : 'E-mail enviado ao contato') + (p.hs_email_subject ? ': ' + lm(p.hs_email_subject).slice(0, 90) : '') + (!r && stt ? ' · ' + stt.toLowerCase() : ''), { dir: r ? 'Recebido' : 'Enviado', sit, det: dt([['Assunto', p.hs_email_subject], ['Status', stt], ['Aberturas', oc || ''], ['Cliques', cc || ''], ['Respostas', +p.hs_email_reply_count || ''], ['Texto', p.hs_email_text]]) }) });
        reu.forEach(d => { const p = d.properties; push(p.hs_timestamp, 'reuniao', 'Reunião' + (p.hs_meeting_outcome ? ' · ' + p.hs_meeting_outcome : ''), { dir: 'Agenda', sit: p.hs_meeting_outcome ? String(p.hs_meeting_outcome).toLowerCase() : '', det: dt([['Título', p.hs_meeting_title], ['Resultado', p.hs_meeting_outcome], ['Início', p.hs_meeting_start_time ? (local(p.hs_meeting_start_time) || {}).d : ''], ['Notas', p.hs_meeting_body]]) }) });
        com.forEach(d => { const p = d.properties, cp = RV.comm.map(x => { const val = p[x.n]; const o = (x.op.find(z => z[0] == val) || [])[1]; return val ? { r: x.r, v: lm(o || val).slice(0, 160) } : null }).filter(Boolean), canal = p.hs_communication_channel_type || '', corpo = lm(p.hs_communication_body).slice(0, 160), tudo = cp.map(x => x.r + ' ' + x.v).join(' | '), sit = /falh|fail|erro|n[aã]o entreg/i.test(tudo) ? 'Falhou' : /respond|repl/i.test(tudo) ? 'Respondeu' : /\blid[oa]s?\b|\bread\b|visualiz/i.test(tudo) ? 'Lido' : /entreg|deliver/i.test(tudo) ? 'Entregue, sem leitura registrada' : 'Registrada, sem leitura informada';
          if (cp.length || corpo) { const l = local(p.hs_timestamp); ficha.comunicacoes.push({ t: +new Date(p.hs_timestamp) || 0, d: l ? l.d : '', canal, corpo, campos: cp }) }
          push(p.hs_timestamp, /whats/i.test(canal) ? 'wa' : 'ativ', 'Mensagem ' + canal + (corpo ? ' · ' + corpo.slice(0, 90) : ''), { dir: p.hs_communication_logged_from || '', sit, det: dt([['Canal', canal], ['Mensagem', corpo], ...cp.map(x => [x.r, x.v])]) }) });
      }
      { const o = ficha.contatos.map((_, i) => i).sort((a, b) => ficha.contatos[b].cr - ficha.contatos[a].cr); const R = (arr) => o.map(i => arr[i]); ficha.contatos = R(ficha.contatos); ident.contatos = R(ident.contatos); cts.splice(0, cts.length, ...R(cts)) }
      ficha.negocios.sort((a, b) => b.per - a.per || b.cr - a.cr); ficha.comunicacoes.sort((a, b) => b.t - a.t); ficha.comunicacoes = ficha.comunicacoes.slice(0, 20);
      ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.h - b.h);
      return out({ contatos: cts, eventos: ev, ficha, ident, versao: 'cpf-estrito-2026-10-23q' });
    } catch (e) { return out({ erro: String(e.message || e).slice(0, 200) }, e.st == 401 || e.st == 403 ? 502 : 500) }
  }
};
