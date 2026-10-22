// Serviço intermediário (Cloudflare Worker): consulta o HubSpot pelo telefone ou CPF e devolve a jornada do contato.
// Segredos (Configurações > Variáveis e segredos): HUBSPOT_TOKEN, CHAVE_ACESSO. Opcionais: ORIGEM_PERMITIDA, CPF_PROP.
const H = 'https://api.hubapi.com';
const CONTATO = ['lifecyclestage','hs_lead_status','hs_analytics_source','createdate','hubspot_owner_id','first_conversion_event_name','first_conversion_date','recent_conversion_event_name','recent_conversion_date','hs_email_last_send_date','hs_email_last_email_name','hs_email_last_open_date','hs_email_last_click_date','notes_last_contacted'];
const dig = s => String(s || '').replace(/\D/g, '');
const cpfOk = d => { if (d.length != 11 || /^(\d)\1+$/.test(d)) return false; for (const n of [9, 10]) { let t = 0; for (let i = 0; i < n; i++) t += +d[i] * (n + 1 - i); if ((t * 10 % 11) % 10 != +d[n]) return false } return true };
const local = v => { if (!v) return null; const t = /^\d+$/.test(String(v)) ? +v : Date.parse(v); if (!t) return null; const s = new Date(t).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); return { d: s.slice(0, 10), h: +s.slice(11, 13) } };
const igual = (a, b) => { if (a.length != b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r == 0 };
export default {
  async fetch(req, env) {
    const orig = env.ORIGEM_PERMITIDA || 'https://emersonaraujodefreitas.github.io';
    const cors = { 'Access-Control-Allow-Origin': orig, 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Allow-Methods': 'GET', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method == 'OPTIONS') return new Response(null, { headers: cors });
    if (req.headers.get('Origin') && req.headers.get('Origin') != orig) return out({ erro: 'origem não permitida' }, 403);
    const chave = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!env.CHAVE_ACESSO || !igual(chave, env.CHAVE_ACESSO)) return out({ erro: 'acesso negado' }, 401);
    const u = new URL(req.url); if (u.pathname != '/buscar') return out({ erro: 'rota inexistente' }, 404);
    const q = dig(u.searchParams.get('q')); if (q.length < 10) return out({ erro: 'informe telefone com DDD ou CPF' }, 400);
    const api = async (p, o) => { const r = await fetch(H + p, { ...o, headers: { Authorization: 'Bearer ' + env.HUBSPOT_TOKEN, 'Content-Type': 'application/json' } }); if (!r.ok) { const e = new Error('HubSpot ' + r.status + ' em ' + p.split('?')[0]); e.st = r.status; throw e } return r.json() };
    try {
      const cpfProp = env.CPF_PROP || 'cpf', ids = new Set();
      const busca = async (prop, vals) => { if (!vals.length) return; const r = await api('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify({ filterGroups: vals.slice(0, 5).map(v => ({ filters: [{ propertyName: prop, operator: 'EQ', value: v }] })), properties: ['hs_object_id'], limit: 10 }) }); r.results.forEach(x => ids.add(x.id)) };
      if (cpfOk(q)) await busca(cpfProp, [q, q.slice(0, 3) + '.' + q.slice(3, 6) + '.' + q.slice(6, 9) + '-' + q.slice(9)]);
      const n = q.length > 11 && q.startsWith('55') ? q.slice(2) : q;
      if (n.length >= 10 && n.length <= 11) { const a = n.slice(0, 2), r = n.slice(2), m = r.length == 9 ? r.slice(0, 5) + '-' + r.slice(5) : r.slice(0, 4) + '-' + r.slice(4); const v = [n, '55' + n, '+55' + n, '(' + a + ') ' + m, '+55 ' + a + ' ' + m]; await busca('mobilephone', v); await busca('phone', v) }
      if (!ids.size) return out({ contatos: [], eventos: [] });
      const [own, pip] = await Promise.all([api('/crm/v3/owners?limit=500').catch(() => ({ results: [] })), api('/crm/v3/pipelines/deals').catch(() => ({ results: [] }))]);
      const dono = {}; own.results.forEach(o => dono[o.id] = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.id);
      const etapa = {}, funil = {}; pip.results.forEach(p => { funil[p.id] = p.label; p.stages.forEach(s => etapa[s.id] = s.label) });
      const ev = [], cts = [], push = (t, ty, tx, x) => { const l = local(t); if (l) ev.push({ ...l, ty, tx, ...x }) };
      const assoc = async (id, tipo, props) => { const a = await api('/crm/v4/objects/contacts/' + id + '/associations/' + tipo).catch(() => ({ results: [] })); const ii = a.results.map(x => ({ id: String(x.toObjectId) })).slice(0, 100); if (!ii.length) return []; const r = await api('/crm/v3/objects/' + tipo + '/batch/read', { method: 'POST', body: JSON.stringify({ inputs: ii, properties: props }) }).catch(() => ({ results: [] })); return r.results };
      for (const id of [...ids].slice(0, 5)) {
        const c = await api('/crm/v3/objects/contacts/' + id + '?properties=' + CONTATO.join(',') + '&propertiesWithHistory=lifecyclestage,hs_lead_status'), p = c.properties, ow = dono[p.hubspot_owner_id] || '';
        cts.push({ id, etapa: p.lifecyclestage, status: p.hs_lead_status, origem: p.hs_analytics_source, proprietario: ow });
        push(p.createdate, 'criado', 'Contato criado', { st: p.lifecyclestage, or: p.hs_analytics_source, ow });
        for (const v of (c.propertiesWithHistory?.lifecyclestage || [])) push(v.timestamp, 'ciclo', 'Mudou para a etapa: ' + v.value, { ow });
        for (const v of (c.propertiesWithHistory?.hs_lead_status || [])) push(v.timestamp, 'ciclo', 'Status do lead: ' + v.value, { ow });
        push(p.first_conversion_date, 'form', 'Formulário (primeira conversão): ' + (p.first_conversion_event_name || ''), {});
        if (p.recent_conversion_date != p.first_conversion_date) push(p.recent_conversion_date, 'form', 'Formulário (conversão mais recente): ' + (p.recent_conversion_event_name || ''), {});
        push(p.hs_email_last_send_date, 'email', 'E-mail de marketing enviado: ' + (p.hs_email_last_email_name || ''), {});
        push(p.hs_email_last_open_date, 'email', 'E-mail de marketing aberto', {}); push(p.hs_email_last_click_date, 'email', 'E-mail de marketing clicado', {});
        const [neg, lig, mail, reu, com] = await Promise.all([assoc(id, 'deals', ['dealstage', 'pipeline', 'amount', 'createdate', 'closedate', 'hubspot_owner_id']), assoc(id, 'calls', ['hs_timestamp', 'hs_call_direction', 'hs_call_duration']), assoc(id, 'emails', ['hs_timestamp', 'hs_email_direction', 'hs_email_status']), assoc(id, 'meetings', ['hs_timestamp', 'hs_meeting_outcome']), assoc(id, 'communications', ['hs_timestamp', 'hs_communication_channel_type'])]);
        neg.forEach(d => { const q = d.properties, x = { st: etapa[q.dealstage] || q.dealstage, pl: funil[q.pipeline] || q.pipeline, v: +q.amount || 0, ow: dono[q.hubspot_owner_id] || '' }; push(q.createdate, 'neg', 'Negócio criado', x); if (q.closedate) push(q.closedate, 'fech', 'Negócio: data de fechamento', x) });
        lig.forEach(d => push(d.properties.hs_timestamp, 'ligacao', 'Ligação ' + (d.properties.hs_call_direction || '').toLowerCase() + (d.properties.hs_call_duration ? ' · ' + Math.round(d.properties.hs_call_duration / 1000) + ' s' : ''), {}));
        mail.forEach(d => push(d.properties.hs_timestamp, 'email', 'E-mail ' + (d.properties.hs_email_direction || '') + ' · ' + (d.properties.hs_email_status || ''), {}));
        reu.forEach(d => push(d.properties.hs_timestamp, 'reuniao', 'Reunião' + (d.properties.hs_meeting_outcome ? ' · ' + d.properties.hs_meeting_outcome : ''), {}));
        com.forEach(d => push(d.properties.hs_timestamp, /whats/i.test(d.properties.hs_communication_channel_type || '') ? 'wa' : 'ativ', 'Mensagem ' + (d.properties.hs_communication_channel_type || ''), {}));
      }
      ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.h - b.h);
      return out({ contatos: cts, eventos: ev });
    } catch (e) { return out({ erro: String(e.message || e).slice(0, 200) }, e.st == 401 || e.st == 403 ? 502 : 500) }
  }
};
