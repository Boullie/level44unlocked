'use strict';
const crypto=require('node:crypto');
exports.handler=async(event)=>{
 const json=(code,obj)=>({statusCode:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(obj)});
 if(event.httpMethod!=='POST')return json(405,{error:'POST vereist'});
 const {SPOTIFY_CLIENT_ID,SPOTIFY_CLIENT_SECRET,GOOGLE_CLIENT_ID,ADMIN_GOOGLE_EMAIL}=process.env;
 if(!SPOTIFY_CLIENT_ID||!SPOTIFY_CLIENT_SECRET)return json(503,{error:'Spotify-variabelen ontbreken'});
 try{
  const {idToken}=JSON.parse(event.body||'{}');
  if(typeof idToken!=='string'||idToken.length>5000)return json(403,{error:'Admin-login vereist'});
  const check=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken),{signal:AbortSignal.timeout(8000)});
  if(!check.ok)return json(403,{error:'Ongeldige admin-login'});
  const user=await check.json();
  if(!GOOGLE_CLIENT_ID||!ADMIN_GOOGLE_EMAIL||user.aud!==GOOGLE_CLIENT_ID||user.email_verified!=='true'||user.email?.toLowerCase()!==ADMIN_GOOGLE_EMAIL.trim().toLowerCase())return json(403,{error:'Geen admin-toegang'});
  const payload=Buffer.from(JSON.stringify({at:Date.now(),nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');
  const signature=crypto.createHmac('sha256',SPOTIFY_CLIENT_SECRET).update(payload).digest('base64url');
  const url=new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id',SPOTIFY_CLIENT_ID);url.searchParams.set('response_type','code');
  url.searchParams.set('redirect_uri','https://level44unlocked.netlify.app/.netlify/functions/spotify-callback');
  url.searchParams.set('scope','user-read-currently-playing user-read-playback-state');
  url.searchParams.set('state',payload+'.'+signature);
  return json(200,{url:url.toString()});
 }catch{return json(500,{error:'Spotify-aanmelding kon niet gestart worden'})}
};
