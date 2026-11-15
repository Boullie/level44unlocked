// LEVEL 44: alleen publiek toegestane namen, nooit ruwe Netlify-formuliergegevens.
const FORM_ID = process.env.LEVEL44_FORM_ID || '6aea0b3b4868ebc65b5015ef';
const TOKEN = process.env.LEVEL44_NETLIFY_TOKEN;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const reply = (statusCode, body) => ({statusCode, headers, body: JSON.stringify(body)});
const clean = value => typeof value === 'string' ? value.trim().slice(0, 100) : '';
export async function handler() {
  if (!TOKEN) return reply(503, {error:'Gastenlijst nog niet geconfigureerd'});
  try {
    const latest = new Map();
    // Maximaal 20 pagina's van 100; weigeren bij overschrijding i.p.v. verouderde gegevens tonen.
    let complete = false;
    for (let page=1; page<=20; page++) {
      const url = `https://api.netlify.com/api/v1/forms/${encodeURIComponent(FORM_ID)}/submissions?per_page=100&page=${page}`;
      const res = await fetch(url, {headers:{Authorization:`Bearer ${TOKEN}`,Accept:'application/json'}});
      if (!res.ok) return reply(502,{error:'Netlify API niet bereikbaar'});
      const items = await res.json();
      if (!Array.isArray(items)) return reply(502,{error:'Onverwacht Netlify-antwoord'});
      for (const item of items) {
        const data = item.data || {};
        const id = clean(data.rsvp_id) || clean(item.id);
        if (!id) continue;
        const date = Date.parse(data.laatst_bijgewerkt || item.created_at || '') || 0;
        if (!latest.has(id) || date > latest.get(id).date) latest.set(id,{date,data});
      }
      if (items.length < 100) {complete=true;break;}
    }
    if (!complete) return reply(503,{error:'Te veel inschrijvingen voor volledige synchronisatie'});
    const yes=[],no=[];
    for (const {data} of latest.values()) {
      const attendance = data.aanwezigheid;
      if (attendance === 'Komt') {
        let people=[];
        try {people=JSON.parse(data.personen_json || '[]');}catch{}
        if (!Array.isArray(people)) continue;
        for (const person of people) if (person && person.scoreVisible === true && clean(person.name)) yes.push(clean(person.name));
      } else if (attendance === 'Komt niet' && data.scorebord_contact === 'Ja' && clean(data.naam)) {
        no.push(clean(data.naam));
      }
    }
    yes.sort((a,b)=>a.localeCompare(b,'nl-BE'));
    no.sort((a,b)=>a.localeCompare(b,'nl-BE'));
    return reply(200,{yes,no});
  }catch {return reply(502,{error:'Gastenlijst tijdelijk niet beschikbaar'});}
}
