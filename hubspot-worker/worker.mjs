// Serviço intermediário (Cloudflare Worker): consulta o HubSpot pelo telefone ou CPF e devolve a jornada do contato.
// Segredos (Configurações > Variáveis e segredos): HUBSPOT_TOKEN, CHAVE_ACESSO. Opcionais: ORIGEM_PERMITIDA, CPF_PROP.
const H = 'https://api.hubapi.com';
const CONTATO = ['lifecyclestage','hs_lead_status','hs_analytics_source','createdate','hubspot_owner_id','first_conversion_event_name','first_conversion_date','recent_conversion_event_name','recent_conversion_date','hs_email_last_send_date','hs_email_last_email_name','hs_email_last_open_date','hs_email_last_click_date','notes_last_contacted','hs_lifecyclestage_lead_date','hs_lifecyclestage_marketingqualifiedlead_date','hs_lifecyclestage_salesqualifiedlead_date','hs_lifecyclestage_opportunity_date','hs_lifecyclestage_customer_date','hs_analytics_first_visit_timestamp','hs_analytics_last_visit_timestamp','hs_analytics_num_visits','hs_analytics_num_page_views','hs_analytics_source_data_1','hs_analytics_source_data_2','hs_email_first_send_date','hs_email_first_open_date','hs_sales_email_last_replied','hs_sales_email_last_opened','num_conversion_events'];
const dig = s => String(s || '').replace(/\D/g, '');
const cpfOk = d => { if (d.length != 11 || /^(\d)\1+$/.test(d)) return false; for (const n of [9, 10]) { let t = 0; for (let i = 0; i < n; i++) t += +d[i] * (n + 1 - i); if ((t * 10 % 11) % 10 != +d[n]) return false } return true };
const local = v => { if (!v) return null; const t = /^\d+$/.test(String(v)) ? +v : Date.parse(v); if (!t) return null; const s = new Date(t).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); return { d: s.slice(0, 10), h: +s.slice(11, 13) } };
const igual = (a, b) => { if (a.length != b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r == 0 };

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// [grupo, rótulo pedido, expressão sobre o rótulo normalizado, nome interno provável, evento da jornada, sensível]
const SPEC = {
  contacts: [
    ['Cadastro e ciclo', 'Status do contato de marketing', 'status do contato de marketing|marketing contact status', 'hs_marketable_status'], ['Acadêmico', 'Já é aluno matriculado', '(ja|aluno).*(aluno|matricul)|matriculad'], ['Cadastro e ciclo', 'Fase do ciclo de vida', '^(fase do ciclo|etapa do ciclo|lifecycle)', 'lifecyclestage'],
    ['Origem e marketing', 'Origem da integração', 'origem da integra'], ['Cadastro e ciclo', 'Data que entrou em lead', 'data.*(entrou|tornou).*lead|lead date', 'hs_lifecyclestage_lead_date'], ['Cadastro e ciclo', 'Data de criação do contato', '^data de cria', 'createdate'],
    ['Acadêmico', 'Modalidade de interesse', 'modalidade'], ['Acadêmico', 'Universidade', '^universidade$', 'universidade'], ['Origem e marketing', 'Origem', '^origem$', 'origem'], ['Acadêmico', 'Turno de interesse', 'turno'], ['Acadêmico', 'Campus', '^campus|^unidade$|^polo$|campus de|unidade de interesse'], ['Acadêmico', 'Curso de interesse', 'curso de interesse'], ['Acadêmico', 'Forma de ingresso', 'forma.*ingresso|tipo.*ingresso'],
    ['Origem e marketing', 'Última página vista', 'ultima pagina|last page seen', 'hs_analytics_last_url'], ['Origem e marketing', 'Detalhamento da fonte', 'detalhamento da fonte|original source drill-down 1', 'hs_analytics_source_data_1'], ['Origem e marketing', 'Fonte do tráfego mais recente', 'fonte.*(mais recente|recente)|latest source', 'hs_latest_source'],
    ['Origem e marketing', 'Fonte original do tráfego', 'fonte original|original source', 'hs_analytics_source'], ['Origem e marketing', 'Fonte recente de mídia paga', 'midia paga|paid.*source|fonte recente de midia'], ['Origem e marketing', 'Categoria da fonte original', 'categoria da fonte'],
    ['Origem e marketing', 'Período original', 'periodo original'], ['Origem e marketing', 'Detalhe da fonte de registro', 'detalhe da fonte de registro|registration source detail'], ['Origem e marketing', 'Fonte de registro', '^fonte de registro|registration source', 'hs_registration_method'],
    ['Negócios', 'Primeiro negócio', 'primeiro neg|first deal', 'first_deal_created_date'], ['Negócios', 'Negócios associados', 'neg.cios associados|associated deals', 'num_associated_deals'], ['Origem e marketing', 'Primeira origem', 'primeira origem'],
    ['Acadêmico', 'Curso', '^curso'], ['Origem e marketing', 'Tipo de origem', 'tipo (de|da) origem'], ['Cadastro e ciclo', 'Recusa receber ligações', 'recus.*liga|nao ligar|do not call'],
    ['Campanha', 'Campanha', '^campanha|utm_campaign|^utm campaign'], ['Campanha', 'Conteúdo do anúncio', 'conteudo do anuncio|utm.?content'], ['Campanha', 'Fonte', '^fonte$|utm.?source'], ['Campanha', 'Meio', '^meio$|utm.?medium'], ['Campanha', 'Termo do anúncio', 'termo do anuncio|utm.?term'],
    ['Campanha', 'URL campanha WhatsApp', 'url.*whats'], ['Campanha', 'Referral source', 'referral'], ['Negócios', 'Pipeline', '^pipeline'], ['Negócios', 'Nome da etapa do negócio', 'etapa do neg'],
    ['Financeiro', 'Aluno adimplente', 'adimpl'], ['Financeiro', 'Dívidas de acordo', 'divida.* de acordo|dividas? acordo'], ['Financeiro', 'Biblioteca', 'biblioteca'], ['Financeiro', 'Mensalidade', '^mensalidade'], ['Financeiro', 'Outros acordos', 'outros acordos'], ['Financeiro', 'Faixa de dívida', 'faixa de divida']
  ],
  deals: [
    ['Negócio', 'Data de criação', '^data de cria', 'createdate'], ['Negócio', 'Etapa do negócio', '^etapa do neg|deal stage', 'dealstage'], ['Acadêmico', 'Apto', '^apto'], ['Acadêmico', 'Contrato aceito', 'contrato aceit'], ['Acadêmico', 'Disciplinas inseridas', '^disciplinas inseridas'], ['Acadêmico', 'Enturmado', '^enturmado'],
    ['Acadêmico', 'Modalidade', '^modalidade'], ['Acadêmico', 'Nome do curso', 'nome do curso|^curso'], ['Acadêmico', 'Universidade', '^universidade$', 'universidade'], ['Marcos', 'Data das disciplinas inseridas', 'data.*disciplinas', null, 'Disciplinas inseridas'], ['Marcos', 'Aceite de contrato e enturmado', 'aceite.*enturmad|data.*aceite', null, 'Aceite de contrato e enturmado'],
    ['Negócio', 'Data da última modificação', 'ultima modifica|last modified', 'hs_lastmodifieddate'], ['Origem e marketing', 'Tipo da origem', 'tipo da origem|tipo de origem'], ['Origem e marketing', 'Origem do negócio', 'origem do neg'], ['Origem e marketing', 'Fonte original do tráfego', 'fonte original|original source', 'hs_analytics_source'], ['Origem e marketing', 'Fonte de tráfego mais recente', 'fonte.*(mais recente|recente)|latest source', 'hs_latest_source'],
    ['Negócio', 'Pipeline', '^pipeline', 'pipeline'], ['Acadêmico', 'Período letivo', 'periodo letivo'], ['Origem e marketing', 'Origem da integração', 'origem da integra'], ['Identificação', 'Nome do negócio', 'nome do neg', 'dealname', null, 1], ['Marcos', 'Data de fechamento', '^data de fechamento|close date', 'closedate', 'Fechamento do negócio'],
    ['Acadêmico', 'Turno', '^turno'], ['Acadêmico', 'Campus', '^campus|^unidade$|^polo$|campus de'], ['Acadêmico', 'Forma de ingresso', 'forma.*ingresso|tipo.*ingresso'], ['Acadêmico', 'Semestre / período do curso', '^semestre'], ['Financeiro', 'Aluno 5 cotas', '5 cotas|cinco cotas'], ['Marcos', 'Vencimento da mensalidade', 'vencimento.*mensalidade', null, 'Vencimento da mensalidade'], ['Marcos', 'Data da mensalidade paga', 'data.*mensalidade paga|mensalidade paga', null, 'Mensalidade paga'],
    ['Identificação', 'RA', '^ra$|registro academico', null, null, 1], ['Financeiro', 'Aluno adimplente', 'adimpl'], ['Financeiro', 'Valores devidos', 'valores? devidos'], ['Financeiro', 'Dívidas de acordo', 'divida.* de acordo|dividas? acordo'], ['Financeiro', 'Biblioteca', 'biblioteca'], ['Financeiro', 'Mensalidade', '^mensalidade'],
    ['Financeiro', 'Outros valores', 'outros valores'], ['Financeiro', 'Descrição da dívida', 'descricao da divida'], ['Financeiro', 'Descrição do benefício', 'descricao do beneficio'], ['Financeiro', 'Tipo de benefício', 'tipo de beneficio'], ['Financeiro', 'Valor da bolsa', 'valor da bolsa'],
    ['Financeiro', 'Mais de 6 meses de atraso', '6 meses'], ['Financeiro', 'Faixa de dívida', 'faixa de divida'], ['Acadêmico', 'Situação acadêmica', 'situacao academica'], ['Acadêmico', 'Situação do aluno', 'situacao do aluno'], ['Acadêmico', 'Período do curso', 'periodo do curso']
  ]
};
let PCACHE = null; const PNOM = {};
export default {
  async fetch(req, env) {
    const orig = env.ORIGEM_PERMITIDA || 'https://emersonaraujodefreitas.github.io';
    const cors = { 'Access-Control-Allow-Origin': orig, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method == 'OPTIONS') return new Response(null, { headers: cors });
    if (req.headers.get('Origin') && req.headers.get('Origin') != orig) return out({ erro: 'origem não permitida' }, 403);
    const chave = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!env.CHAVE_ACESSO || !igual(chave, env.CHAVE_ACESSO)) return out({ erro: 'acesso negado' }, 401);
    const u = new URL(req.url); if (!['/buscar', '/estrutura', '/painel', '/campos', '/contar', '/emails', '/propriedades', '/amostra'].includes(u.pathname)) return out({ erro: 'rota inexistente' }, 404);
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const api = async (p, o) => { for (let i = 0; ; i++) { const r = await fetch(H + p, { ...o, headers: { Authorization: 'Bearer ' + env.HUBSPOT_TOKEN, 'Content-Type': 'application/json' } }); if (r.status == 429 && i < 6) { await espera(1000 + 700 * i); continue } if (!r.ok) { const e = new Error('HubSpot ' + r.status + ' em ' + p.split('?')[0]); e.st = r.status; throw e } return r.json() } };
    const resolver = async () => {
      if (PCACHE && Date.now() - PCACHE.t < 36e5) return PCACHE.v;
      const v = { contacts: [], deals: [], faltam: { contacts: [], deals: [] }, cpf: {}, cpfp: {} };
      for (const o of ['contacts', 'deals']) {
        const pr = (await api('/crm/v3/properties/' + o)).results;
        { const lc = pr.filter(x => /cpf/i.test(x.name + ' ' + x.label) && !/respons|dependent/i.test(x.label)), od = x => /^cpf$/i.test(x.label.trim()) ? 0 : /desuso|utilizado|antigo/i.test(x.label) ? 2 : 1; lc.sort((a, b) => od(a) - od(b)); v.cpf[o] = lc.map(x => x.name).slice(0, 6); v.cpfp[o] = lc.filter(x => od(x) < 2).map(x => x.name) }
        for (const [g, rot, rx, hint, ev, pii] of SPEC[o]) {
          let best = null, bs = 0; const re = new RegExp(rx);
          for (const p of pr) { if (p.hidden) continue; const l = norm(p.label), n = norm(p.name); let sc = 0; if (hint && p.name == hint) sc = 4; else if (l == norm(rot)) sc = 3; else if (re.test(l)) sc = 2; else if (!/ /.test(rx) && re.test(n)) sc = 1; if (sc > bs) { best = p; bs = sc } }
          if (best) v[o].push({ g, rot, name: best.name, tipo: best.type, ft: best.fieldType, ev: ev || '', pii: pii ? 1 : 0, op: (best.options || []).filter(x => !x.hidden).map(x => [x.value, x.label]) }); else v.faltam[o].push(rot)
        }
      }
      PCACHE = { t: Date.now(), v }; return v
    };
    const uniDe = t => { t = String(t || '').toLowerCase(); return /unijorge|\buj\b|jorge amado/.test(t) ? 'UNIJORGE' : /\buva\b|veiga de almeida/.test(t) ? 'UVA' : '' };
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
              for (const n of ['first_conversion_event_name', 'recent_conversion_event_name', 'hs_analytics_first_url', 'hs_analytics_source_data_2', 'hs_analytics_source_data_1']) if (!cand.some(c => c.name == n)) cand.push({ name: n, label: n, ops: [] });
              const defs = [];
              for (const c of cand) {
                const v = { UVA: [], UNIJORGE: [] }; c.ops.forEach(z => { const k = uniDe(z.label + ' ' + z.value); if (k) v[k].push(z.value) });
                const en = v.UVA.length || v.UNIJORGE.length, df = en ? { prop: c.name, rotulo: c.label, tipo: 'enum', val: v } : { prop: c.name, rotulo: c.label, tipo: 'texto', val: { UVA: ['uva'], UNIJORGE: ['unijorge'] } };
                const q = async u => { const w = df.tipo == 'enum' ? (v[u].length ? { propertyName: c.name, operator: 'IN', values: v[u] } : null) : { propertyName: c.name, operator: 'CONTAINS_TOKEN', value: df.val[u][0] }; if (!w) return 0; try { return (await busca('/crm/v3/objects/contacts/search', { filterGroups: [{ filters: [w] }], limit: 1, properties: ['hs_object_id'] })).total } catch (e) { return 0 } };
                df.n = (await q('UVA')) + (await q('UNIJORGE')); if (df.n > 0) defs.push(df)
              }
              defs.sort((a, b) => b.n - a.n);
              uni[o] = defs.length ? { tipo: 'multi', defs: defs.slice(0, 3).map(x => ({ ...x, tipo: x.tipo })) } : { tipo: 'nenhuma' };
              continue
            }
            if (d) { const ops = (d.options || []).filter(x => !x.hidden), v = { UVA: [], UNIJORGE: [] }; ops.forEach(x => { const k = uniDe(x.label + ' ' + x.value); if (k) v[k].push(x.value) });
              uni[o] = ops.length && (v.UVA.length || v.UNIJORGE.length) ? { prop: d.name, rotulo: d.label, tipo: 'enum', val: v, opcoes: ops.map(x => x.label) } : { prop: d.name, rotulo: d.label, tipo: 'texto', val: { UVA: ['uva'], UNIJORGE: ['unijorge'] } } }
            else if (o == 'deals') { const v = { UVA: [], UNIJORGE: [] }; funis.forEach(f => { const k = uniDe(f.nome); if (k) v[k].push(f.id) }); uni[o] = v.UVA.length || v.UNIJORGE.length ? { prop: 'pipeline', tipo: 'pipeline', val: v } : { tipo: 'nenhuma' } }
            else uni[o] = { tipo: 'nenhuma' }
          }
          return out({ funis, donos, uni, opc });
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
      let cpfProp = env.CPF_PROP || 'cpf', ids = new Set(), cpfNames = [], cpfDeal = []; const R0 = await resolver().catch(() => null);
      cpfNames = R0 && R0.cpf ? [...R0.cpf.contacts] : []; if (env.CPF_PROP && !cpfNames.includes(env.CPF_PROP)) cpfNames.unshift(env.CPF_PROP); if (!cpfNames.length) cpfNames = ['cpf'];
      cpfDeal = R0 && R0.cpf ? [...R0.cpf.deals] : []; const cpfPrim = R0 && R0.cpfp ? R0.cpfp.contacts : [], cpfAlvo = qc || (cpfOk(q) ? q : ''); let viaCpf = false;
      const buscaCt = async (prop, vals) => { if (!vals.length) return; try { const r = await api('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify({ filterGroups: vals.slice(0, 5).map(v => ({ filters: [{ propertyName: prop, operator: 'EQ', value: v }] })), properties: ['hs_object_id'], limit: 50 }) }); r.results.forEach(x => ids.add(x.id)) } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e } };
      const buscaNg = async (prop, vals) => { try { const r = await api('/crm/v3/objects/deals/search', { method: 'POST', body: JSON.stringify({ filterGroups: vals.map(v => ({ filters: [{ propertyName: prop, operator: 'EQ', value: v }] })), properties: ['hs_object_id'], limit: 30 }) }); for (const d of r.results.slice(0, 5)) { const a = await api('/crm/v4/objects/deals/' + d.id + '/associations/contacts').catch(() => ({ results: [] })); a.results.forEach(x => ids.add(String(x.toObjectId))) } } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e } };
      if (qc || qt) {
        if (qc) { const fm = qc.slice(0, 3) + '.' + qc.slice(3, 6) + '.' + qc.slice(6, 9) + '-' + qc.slice(9); for (const pn of cpfNames) await buscaCt(pn, [qc, fm]); for (const pn of cpfDeal) await buscaNg(pn, [qc, fm]); viaCpf = !qt && ids.size > 0; if (!ids.size) for (const pn of cpfNames) { try { const r = await api('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: pn, operator: 'CONTAINS_TOKEN', value: qc }] }], properties: ['hs_object_id'], limit: 50 }) }); r.results.forEach(x => ids.add(x.id)) } catch (e) { if (e.st == 401 || e.st == 403 || e.st == 429) throw e } } }
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
      const RV = await resolver().catch(() => ({ contacts: [], deals: [] })), cN = RV.contacts.map(x => x.name), dN = RV.deals.map(x => x.name);
      const fv = (d, v) => { if (v == null || v === '') return ''; if (d.name == 'dealstage') return etapa[v] || v; if (d.name == 'pipeline') return funil[v] || v; if (d.tipo == 'bool' || (d.ft == 'booleancheckbox' && /^(true|false)$/i.test(v))) return /^true$/i.test(v) ? 'Sim' : 'Não'; if (d.tipo == 'enumeration') return String(v).split(';').map(z => (d.op.find(o => o[0] == z) || [])[1] || z).join(', '); if (d.tipo == 'date' || d.tipo == 'datetime') { const l = local(v); return l ? l.d.split('-').reverse().join('/') : '' } return String(v).slice(0, 200) };
      const ficha = { contatos: [], negocios: [] }, ident = { contatos: [], ra: [] }, fcpf = v => { const d = dig(v); return d.length == 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : String(v || '') };
      const assoc = async (id, tipo, props, hist) => { const a = await api('/crm/v4/objects/contacts/' + id + '/associations/' + tipo).catch(() => ({ results: [] })); const ii = a.results.map(x => ({ id: String(x.toObjectId) })).slice(0, 100); if (!ii.length) return []; const r = await api('/crm/v3/objects/' + tipo + '/batch/read', { method: 'POST', body: JSON.stringify(hist ? { inputs: ii, properties: props, propertiesWithHistory: hist } : { inputs: ii, properties: props }) }).catch(() => ({ results: [] })); return r.results };
      for (const id of [...ids].slice(0, 5)) {
        const c = await api('/crm/v3/objects/contacts/' + id + '?properties=' + [...new Set([...CONTATO, ...cN, 'firstname', 'lastname', 'email', 'phone', 'mobilephone', ...cpfNames])].join(',') + '&propertiesWithHistory=lifecyclestage,hs_lead_status,hubspot_owner_id,recent_conversion_event_name'), p = c.properties, ow = dono[p.hubspot_owner_id] || '';
        if (viaCpf && cpfAlvo) { const dg2 = n => dig(p[n]), pr = cpfPrim.map(dg2).filter(Boolean), ou = cpfNames.filter(n => !cpfPrim.includes(n)).map(dg2).filter(Boolean); if (!(pr.length ? pr.includes(cpfAlvo) : ou.includes(cpfAlvo))) continue }
        ident.contatos.push({ nome: [p.firstname, p.lastname].filter(Boolean).join(' '), cpf: fcpf(p[cpfNames.find(n => p[n])] || ''), email: p.email || '', tel: p.phone || '', cel: p.mobilephone || '' });
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
        push(p.hs_email_last_send_date, 'email', 'E-mail de marketing enviado: ' + (p.hs_email_last_email_name || ''), {});
        push(p.hs_email_last_open_date, 'email', 'E-mail de marketing aberto', {}); push(p.hs_email_last_click_date, 'email', 'E-mail de marketing clicado', {});
        const [neg, lig, mail, reu, com, nota, tar] = await Promise.all([assoc(id, 'deals', [...new Set(['dealstage', 'pipeline', 'amount', 'createdate', 'closedate', 'hubspot_owner_id', ...dN])], ['dealstage']), assoc(id, 'calls', ['hs_timestamp', 'hs_call_direction', 'hs_call_duration']), assoc(id, 'emails', ['hs_timestamp', 'hs_email_direction', 'hs_email_status', 'hs_email_subject']), assoc(id, 'meetings', ['hs_timestamp', 'hs_meeting_outcome']), assoc(id, 'communications', ['hs_timestamp', 'hs_communication_channel_type', 'hs_communication_body']), assoc(id, 'notes', ['hs_timestamp', 'hubspot_owner_id']), assoc(id, 'tasks', ['hs_timestamp', 'hs_task_status', 'hs_task_type', 'hubspot_owner_id'])]);
        neg.forEach(d => { const q = d.properties, x = { st: etapa[q.dealstage] || q.dealstage, pl: funil[q.pipeline] || q.pipeline, v: +q.amount || 0, ow: dono[q.hubspot_owner_id] || '' }; x.did = d.id; { const rf = RV.deals.find(f => f.rot == 'RA'); if (rf && q[rf.name] && !ident.ra.includes(String(q[rf.name]))) ident.ra.push(String(q[rf.name])) } ficha.negocios.push({ id: d.id, cr: +new Date(q.createdate) || 0, per: (() => { const pf = RV.deals.find(f => f.rot == 'Período letivo'); const m = pf && String(q[pf.name] || '').replace(/\D/g, '').slice(0, 5); return +m || 0 })(), campos: RV.deals.map(f => ({ g: f.g, r: f.rot, v: fv(f, q[f.name]) })).filter(z => z.v) }); for (const f of RV.deals) if (f.ev && q[f.name] && f.name != 'closedate') push(q[f.name], 'marco', f.ev, { ...x }); push(q.createdate, 'neg', 'Negócio criado', x); for (const v of (d.propertiesWithHistory?.dealstage || [])) push(v.timestamp, 'etapa', 'Negócio mudou para a etapa: ' + (etapa[v.value] || v.value), { ...x, st: etapa[v.value] || v.value }); if (q.closedate) push(q.closedate, 'fech', 'Negócio: data de fechamento', x) });
        nota.forEach(d => push(d.properties.hs_timestamp, 'nota', 'Nota registrada no contato', { ow: dono[d.properties.hubspot_owner_id] || '' }));
        tar.forEach(d => push(d.properties.hs_timestamp, 'tarefa', 'Tarefa' + (d.properties.hs_task_type ? ' (' + d.properties.hs_task_type.toLowerCase() + ')' : '') + (d.properties.hs_task_status ? ' · ' + d.properties.hs_task_status.toLowerCase() : ''), { ow: dono[d.properties.hubspot_owner_id] || '' }));
        lig.forEach(d => push(d.properties.hs_timestamp, 'ligacao', 'Ligação ' + (/in/i.test(d.properties.hs_call_direction || '') ? 'recebida' : 'realizada') + (d.properties.hs_call_duration ? ' · ' + Math.round(d.properties.hs_call_duration / 1000) + ' s' : ''), {}));
        mail.forEach(d => { const r = /incoming/i.test(d.properties.hs_email_direction || ''); push(d.properties.hs_timestamp, r ? 'resp' : 'email', (r ? 'E-mail recebido do contato' : 'E-mail enviado ao contato') + (d.properties.hs_email_subject ? ': ' + String(d.properties.hs_email_subject).slice(0, 90) : '') + (!r && d.properties.hs_email_status ? ' · ' + d.properties.hs_email_status.toLowerCase() : ''), {}) });
        reu.forEach(d => push(d.properties.hs_timestamp, 'reuniao', 'Reunião' + (d.properties.hs_meeting_outcome ? ' · ' + d.properties.hs_meeting_outcome : ''), {}));
        com.forEach(d => push(d.properties.hs_timestamp, /whats/i.test(d.properties.hs_communication_channel_type || '') ? 'wa' : 'ativ', 'Mensagem ' + (d.properties.hs_communication_channel_type || '') + (d.properties.hs_communication_body ? ' · ' + String(d.properties.hs_communication_body).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) : ''), {}));
      }
      { const o = ficha.contatos.map((_, i) => i).sort((a, b) => ficha.contatos[b].cr - ficha.contatos[a].cr); const R = (arr) => o.map(i => arr[i]); ficha.contatos = R(ficha.contatos); ident.contatos = R(ident.contatos); cts.splice(0, cts.length, ...R(cts)) }
      ficha.negocios.sort((a, b) => b.per - a.per || b.cr - a.cr);
      ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.h - b.h);
      return out({ contatos: cts, eventos: ev, ficha, ident });
    } catch (e) { return out({ erro: String(e.message || e).slice(0, 200) }, e.st == 401 || e.st == 403 ? 502 : 500) }
  }
};
