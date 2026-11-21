'use strict';
const {read:hasAdminSession}=require('./admin-session');
const crypto=require('node:crypto');
const {getStore}=require('@netlify/blobs');
const json=(code,data)=>({statusCode:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
const clean=(x,n)=>String(x||'').trim().slice(0,n);
const trackId=x=>{const s=clean(x,250);const m=s.match(/(?:open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]{22})/);return m?m[1]:/^[a-zA-Z0-9]{22}$/.test(s)?s:null};
const store=()=>getStore(process.env.NETLIFY_SITE_ID&&process.env.NETLIFY_API_TOKEN?{name:'level44-wishes-v1',siteID:process.env.NETLIFY_SITE_ID,token:process.env.NETLIFY_API_TOKEN}:'level44-wishes-v1');
async function admin(token){
 if(typeof token!=='string'||token.length>5000)return false;
 const {GOOGLE_CLIENT_ID,ADMIN_GOOGLE_EMAIL}=process.env;
 if(!GOOGLE_CLIENT_ID||!ADMIN_GOOGLE_EMAIL)return false;
 const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token),{signal:AbortSignal.timeout(8000)});
 if(!r.ok)return false;const p=await r.json();
 return p.aud===GOOGLE_CLIENT_ID&&p.email_verified==='true'&&p.email?.toLowerCase()===ADMIN_GOOGLE_EMAIL.trim().toLowerCase()&&['accounts.google.com','https://accounts.google.com'].includes(p.iss);
}
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return json(405,{error:'POST vereist'});
 if((event.body||'').length>6000)return json(413,{error:'Aanvraag te groot'});
 let data;try{data=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Ongeldige JSON'})}
 try{
  const op=data.op;
  if(!['list','save','remove'].includes(op))return json(400,{error:'Onbekende actie'});
  if(!hasAdminSession(event)&&!await admin(data.idToken))return json(403,{error:'Geen admin-toegang'});
  const s=store();
  if(op==='list'){
   const wishes=await s.get('wishes',{type:'json'})||[];
   return json(200,{wishes:wishes.map(w=>({...w,availableAt:w.lastShownAt? w.lastShownAt+7200000:0}))});
  }
  if(op==='save'){
   const id=clean(data.id,80)||crypto.randomUUID();
   const name=clean(data.name,80),title=clean(data.title,180),artist=clean(data.artist,120),message=clean(data.message,220),spotifyId=trackId(data.spotify);
   if(!name||!title||!spotifyId)return json(400,{error:'Gastnaam, nummer en geldige Spotify-tracklink zijn vereist'});
   const wishes=await s.get('wishes',{type:'json'})||[];
   if(wishes.length>=250&&!wishes.some(w=>w.id===id))return json(409,{error:'Maximum 250 wensen'});
   const old=wishes.find(w=>w.id===id);
   const next={id,name,title,artist,message,spotifyId,approved:data.approved===true,lastShownAt:old?.spotifyId===spotifyId?old.lastShownAt||0:0};
   await s.setJSON('wishes',[...wishes.filter(w=>w.id!==id),next]);
   return json(200,{ok:true,id});
  }
  if(op==='remove'){
   const id=clean(data.id,80);const wishes=await s.get('wishes',{type:'json'})||[];
   await s.setJSON('wishes',wishes.filter(w=>w.id!==id));
   return json(200,{ok:true});
  }
 }catch(e){console.error('wish error',e?.message);return json(503,{error:'Muziekwensen tijdelijk niet beschikbaar'})}
};
