// V12.7: redeploy after configuring NETLIFY_SITE_ID on Netlify.
'use strict';
const {getStore}=require('@netlify/blobs');
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(statusCode,data)=>({statusCode,headers,body:JSON.stringify(data)});
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'Method not allowed'});
 const {GOOGLE_CLIENT_ID,ADMIN_GOOGLE_EMAIL}=process.env;
 if(!GOOGLE_CLIENT_ID||!ADMIN_GOOGLE_EMAIL)return reply(503,{error:'Login niet geconfigureerd'});
 let body;try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Bad JSON'})}
 if(typeof body.idToken!=='string'||body.idToken.length>5000)return reply(401,{error:'Login vereist'});
 try{
  const verify=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(body.idToken),{signal:AbortSignal.timeout(8000)});
  if(!verify.ok)return reply(401,{error:'Ongeldige login'});
  const identity=await verify.json();
  if(identity.aud!==GOOGLE_CLIENT_ID||identity.email_verified!=='true'||identity.email?.toLowerCase()!==ADMIN_GOOGLE_EMAIL.trim().toLowerCase()||!['accounts.google.com','https://accounts.google.com'].includes(identity.iss))return reply(403,{error:'Geen toegang'});
  const store=getStore(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN ? {name:'level44-analytics',siteID:process.env.NETLIFY_SITE_ID,token:process.env.NETLIFY_API_TOKEN} : 'level44-analytics');
  const cutoff=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const totals={};
  const daily={};
  let cursor;
  let scanned=0;
  do{
   const result=await store.list({prefix:'events/',cursor});
   for(const item of result.blobs){
    const day=item.key.split('/')[1];
    if(day<cutoff)continue;
    const data=await store.get(item.key,{type:'json'});
    if(data&&typeof data.event==='string'){
      totals[data.event]=(totals[data.event]||0)+1;
      if(data.event==='page_view'||data.event==='rsvp_success'){
       if(!daily[day])daily[day]={page_view:0,rsvp_success:0};
       daily[day][data.event]++;
      }
    }
    if(++scanned>10000)return reply(503,{error:'Te veel events voor dit overzicht'});
   }
   cursor=result.cursor;
  }while(cursor);
  return reply(200,{totals,daily,period:'Laatste 30 dagen',note:'Cookieloze eventtellingen, geen unieke bezoekers. Sectieweergaven zijn benaderingen.'});
 }catch(e){console.error('V12.7 analytics dashboard:',e?.name,e?.message,e?.status);return reply(503,{error:'Analytics konden niet worden opgehaald',diagnostic:e?.name==='MissingBlobsEnvironmentError'?'blobs-config':e?.status===401?'blobs-auth':'blobs-read'})}
};
