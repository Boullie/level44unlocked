'use strict';
// Privacyvriendelijke, cookieloze gebeurtenissen. Geen namen, IP, URL of bezoekers-ID opslaan.
const {getStore}=require('@netlify/blobs');
const allowed=new Set(['page_view','rsvp_view','rsvp_start','rsvp_success','scoreboard_view','gifts_view','practical_view','music_view','edit_click']);
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'https://level44.colormarket.be','Vary':'Origin'};
const reply=(statusCode,body)=>({statusCode,headers,body:JSON.stringify(body)});
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 const origin=event.headers.origin||event.headers.Origin||'';
 // Same-origin requests from the Netlify test branch are permitted via browser Origin validation.
 if(origin){try{const u=new URL(origin);if(u.hostname!=='level44.colormarket.be'&&!/^level44-v12-7-analytics--level44unlocked\.netlify\.app$/.test(u.hostname))return reply(403,{error:'Origin not allowed'})}catch{return reply(403,{error:'Origin not allowed'})}}
 if((event.body||'').length>200)return reply(413,{error:'Too large'});
 let data;try{data=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Bad JSON'})}
 if(!allowed.has(data.event))return reply(400,{error:'Unknown event'});
 try{
  const store=getStore('level44-analytics');
  const day=new Date().toISOString().slice(0,10);
  const id=require('node:crypto').randomUUID();
  // Elke gebeurtenis krijgt alleen een willekeurige opslagkey, geen sessie- of bezoekers-ID.
  await store.setJSON('events/'+day+'/'+id,{event:data.event,day});
  return reply(202,{ok:true});
 }catch(e){console.error('V12.7 analytics event:',e?.name,e?.message,e?.status);return reply(503,{error:'Analytics unavailable',diagnostic:e?.name==='MissingBlobsEnvironmentError'?'blobs-config':e?.status===401?'blobs-auth':'blobs-write'})}
};
