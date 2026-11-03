'use strict';
const {getStore}=require('@netlify/blobs');
const crypto=require('node:crypto');
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'https://level44unlocked.netlify.app'};
const reply=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
const actions=['confetti','cheer','dance','levelup','heart','boss'];
const parse=e=>{try{return JSON.parse(e.body||'{}')}catch{return null}};
const clean=s=>String(s||'').trim().slice(0,180);
async function authorized(token){
 const {GOOGLE_CLIENT_ID,ADMIN_GOOGLE_EMAIL}=process.env;
 if(!GOOGLE_CLIENT_ID||!ADMIN_GOOGLE_EMAIL||typeof token!=='string'||token.length>5000)return false;
 const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token),{signal:AbortSignal.timeout(8000)});
 if(!r.ok)return false;
 const p=await r.json();
 return p.aud===GOOGLE_CLIENT_ID&&p.email_verified==='true'&&p.email?.toLowerCase()===ADMIN_GOOGLE_EMAIL.trim().toLowerCase()&&['accounts.google.com','https://accounts.google.com'].includes(p.iss);
}
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Gebruik POST'});
 if((event.body||'').length>6000)return reply(413,{error:'Aanvraag te groot'});
 const data=parse(event);if(!data||typeof data.op!=='string')return reply(400,{error:'Ongeldige aanvraag'});
 try{
  const store=getStore('level44-party-v1');
  const now=Date.now();
  if(data.op==='feed'){
   const [recent,approved]=await Promise.all([store.get('recent',{type:'json'}),store.get('approved',{type:'json'})]);
   return reply(200,{events:(recent||[]).filter(x=>now-x.at<120000).slice(-30),messages:(approved||[]).slice(-12)});
  }
  if(data.op==='send'){
   const kind=data.kind==='action'?'action':data.kind==='message'?'message':null;
   if(!kind)return reply(400,{error:'Ongeldige actie'});
   const name=clean(data.name).slice(0,32)||'Player';
   const value=kind==='action'?String(data.value||''):clean(data.value);
   if(kind==='action'&&!actions.includes(value))return reply(400,{error:'Onbekende actie'});
   if(kind==='message'&&(value.length<2||value.length>180))return reply(400,{error:'Schrijf een bericht van 2 tot 180 tekens'});
   // Best-effort cooldown, not a transactional anti-abuse guarantee.
   const ip=(event.headers?.['x-nf-client-connection-ip']||event.headers?.['x-forwarded-for']||'unknown').split(',')[0].trim();
   const key='cool-'+crypto.createHash('sha256').update(ip+'|'+new Date().toISOString().slice(0,10)).digest('hex');
   const last=Number(await store.get(key))||0;
   if(now-last<4000)return reply(429,{error:'Wacht een paar seconden voor je opnieuw iets verstuurt'});
   await store.set(key,String(now));
   const item={id:crypto.randomUUID(),at:now,name,value};
   if(kind==='message'){
    await store.set('pending-'+item.id,JSON.stringify(item));
    const pending=await store.get('pending-index',{type:'json'})||[];
    await store.setJSON('pending-index',[item.id,...pending].slice(0,150));
    return reply(200,{ok:true,status:'pending'});
   }
   const recent=await store.get('recent',{type:'json'})||[];
   await store.setJSON('recent',[...recent.filter(x=>now-x.at<120000),item].slice(-60));
   return reply(200,{ok:true,status:'live'});
  }
  if(data.op==='admin'){
   if(!await authorized(data.idToken))return reply(403,{error:'Geen toegang'});
   const pendingIds=await store.get('pending-index',{type:'json'})||[];
   if(data.command==='list'){
    const pending=(await Promise.all(pendingIds.slice(0,150).map(id=>store.get('pending-'+id,{type:'json'})))).filter(Boolean);
    return reply(200,{pending});
   }
   if(!['approve','reject'].includes(data.command)||typeof data.id!=='string'||!pendingIds.includes(data.id))return reply(400,{error:'Ongeldige opdracht'});
   const item=await store.get('pending-'+data.id,{type:'json'});
   if(!item)return reply(404,{error:'Bericht niet gevonden'});
   if(data.command==='approve'){
    const approved=await store.get('approved',{type:'json'})||[];
    await store.setJSON('approved',[{...item,at:now},...approved].slice(0,30));
   }
   await store.setJSON('pending-index',pendingIds.filter(id=>id!==data.id));
   await store.delete('pending-'+data.id);
   return reply(200,{ok:true});
  }
  return reply(400,{error:'Onbekende opdracht'});
 }catch(e){console.error('Party function error',e);return reply(503,{error:'Party TV tijdelijk niet beschikbaar. Controleer Netlify Blobs.'})}
};
