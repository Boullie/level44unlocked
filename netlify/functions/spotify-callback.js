'use strict';
const crypto=require('node:crypto');
const {getStore}=require('@netlify/blobs');
async function store(){try{return getStore('level44-spotify-v1')}catch(e){if(e?.name!=='MissingBlobsEnvironmentError')throw e;const token=process.env.NETLIFY_API_TOKEN;let siteID=process.env.NETLIFY_SITE_ID||process.env.SITE_ID;if(!token)throw Error('Blobs token ontbreekt');if(!siteID){const r=await fetch('https://api.netlify.com/api/v1/sites/level44unlocked.netlify.app',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Site ID ontbreekt');siteID=(await r.json()).id}return getStore({name:'level44-spotify-v1',siteID,token})}}
exports.handler=async(event)=>{
 const redirect=(msg)=>({statusCode:302,headers:{Location:'/party/spotify-status/?result='+encodeURIComponent(msg),'Cache-Control':'no-store'},body:''});
 const {SPOTIFY_CLIENT_ID:id,SPOTIFY_CLIENT_SECRET:secret}=process.env;
 try{
  if(!id||!secret||event.queryStringParameters?.error)return redirect('error');
  const {code,state}=event.queryStringParameters||{};
  if(!code||!state||state.length>1000)return redirect('invalid');
  const [payload,sig]=state.split('.');
  const expected=crypto.createHmac('sha256',secret).update(payload).digest();
  const provided=Buffer.from(sig||'','base64url');
  if(provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected))return redirect('invalid');
  const parsed=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(!Number.isFinite(parsed.at)||Math.abs(Date.now()-parsed.at)>10*60*1000)return redirect('expired');
  const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:'https://level44unlocked.netlify.app/.netlify/functions/spotify-callback'});
  const res=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!res.ok)return redirect('token-error');
  const tokens=await res.json();if(!tokens.refresh_token)return redirect('missing-token');
  const s=await store();await s.setJSON('auth',{refresh_token:tokens.refresh_token,access_token:tokens.access_token,expires_at:Date.now()+tokens.expires_in*1000});
  return redirect('connected');
 }catch{return redirect('error')}
};
