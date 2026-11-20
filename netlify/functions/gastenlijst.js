'use strict';
// Openbaar scorebord: uitsluitend namen met expliciete toestemming.
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'https://level44.colormarket.be'};
const reply=(statusCode,data)=>({statusCode,headers,body:JSON.stringify(data)});
const consent=v=>v===true||v==='Ja';
const clean=v=>typeof v==='string'?v.trim().slice(0,120):'';
exports.handler=async(event)=>{
  if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed'});
  const {NETLIFY_API_TOKEN,NETLIFY_FORM_ID}=process.env;
  if(!NETLIFY_API_TOKEN||!NETLIFY_FORM_ID)return reply(503,{error:'Niet geconfigureerd'});
  try{
    const latest=new Map();
    const maxPages=20,pageSize=100;
    let complete=false;
    for(let page=1;page<=maxPages;page++){
      const url='https://api.netlify.com/api/v1/forms/'+encodeURIComponent(NETLIFY_FORM_ID)+'/submissions?per_page='+pageSize+'&page='+page;
      const response=await fetch(url,{headers:{Authorization:'Bearer '+NETLIFY_API_TOKEN},signal:AbortSignal.timeout(12000)});
      if(!response.ok)return reply(502,{error:'Gegevensbron niet beschikbaar'});
      const items=await response.json();
      if(!Array.isArray(items))return reply(502,{error:'Ongeldige gegevensbron'});
      for(const item of items){
        const f=item.data||{};
        const id=clean(f.rsvp_id)||String(item.id||'');
        if(!id)continue;
        const when=Date.parse(f.laatst_bijgewerkt||item.created_at||'')||0;
        const previous=latest.get(id);
        if(!previous||when>previous.when)latest.set(id,{when,fields:f});
      }
      if(items.length<pageSize){complete=true;break;}
    }
    if(!complete)return reply(503,{error:'Te veel inschrijvingen voor een volledig scorebord'});
    const yes=[],no=[];
    for(const {fields:f} of latest.values()){
      const attendance=clean(f.aanwezigheid).toLowerCase();
      if(attendance==='komt'){
        let people;
        try{people=JSON.parse(f.personen_json||'[]')}catch{people=[]}
        if(!Array.isArray(people))people=[];
        for(const p of people){
          if(p&&consent(p.scoreVisible)&&clean(p.name))yes.push(clean(p.name));
        }
      }else if(attendance==='komt niet'&&consent(f.scorebord_contact)&&clean(f.naam)){
        no.push(clean(f.naam));
      }
    }
    yes.sort((a,b)=>a.localeCompare(b,'nl'));no.sort((a,b)=>a.localeCompare(b,'nl'));
    return reply(200,{yes,no});
  }catch{return reply(502,{error:'Scorebord tijdelijk niet beschikbaar'});}
};
