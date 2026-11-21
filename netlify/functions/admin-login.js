'use strict';
const {read,cookie}=require('./admin-session');
const respond=(code,data,extra={})=>({statusCode:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra},body:JSON.stringify(data)});
exports.handler=async event=>{
 if(event.httpMethod==='GET')return respond(200,{signedIn:read(event)});
 if(event.httpMethod!=='POST')return respond(405,{error:'POST vereist'});
 let body;try{body=JSON.parse(event.body||'{}')}catch{return respond(400,{error:'Ongeldige JSON'})}
 if(body.op==='logout')return respond(200,{ok:true},{'Set-Cookie':'level44_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'});
 if(body.op!=='login'||typeof body.idToken!=='string'||body.idToken.length>5000)return respond(400,{error:'Ongeldige aanmelding'});
 try{
  const {GOOGLE_CLIENT_ID,ADMIN_GOOGLE_EMAIL}=process.env;
  if(!GOOGLE_CLIENT_ID||!ADMIN_GOOGLE_EMAIL||!(process.env.LEVEL44_SESSION_SECRET||process.env.SPOTIFY_CLIENT_SECRET))return respond(503,{error:'Sessies niet geconfigureerd'});
  const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(body.idToken),{signal:AbortSignal.timeout(8000)});
  if(!r.ok)return respond(401,{error:'Google-aanmelding verlopen'});
  const p=await r.json();
  if(p.aud!==GOOGLE_CLIENT_ID||p.email_verified!=='true'||p.email?.toLowerCase()!==ADMIN_GOOGLE_EMAIL.trim().toLowerCase()||!['accounts.google.com','https://accounts.google.com'].includes(p.iss))return respond(403,{error:'Geen toegang'});
  return respond(200,{signedIn:true,expiresInHours:8},{'Set-Cookie':cookie(p.email)});
 }catch{return respond(503,{error:'Aanmelden tijdelijk niet mogelijk'})}
};
