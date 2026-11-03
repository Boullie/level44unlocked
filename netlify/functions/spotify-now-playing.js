'use strict';
const {getStore}=require('@netlify/blobs');
async function store(){try{return getStore('level44-spotify-v1')}catch(e){if(e?.name!=='MissingBlobsEnvironmentError')throw e;const token=process.env.NETLIFY_API_TOKEN;let siteID=process.env.NETLIFY_SITE_ID||process.env.SITE_ID;if(!token)throw Error('Blobs token ontbreekt');if(!siteID){const r=await fetch('https://api.netlify.com/api/v1/sites/level44unlocked.netlify.app',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Site ID ontbreekt');siteID=(await r.json()).id}return getStore({name:'level44-spotify-v1',siteID,token})}}
exports.handler=async(event)=>{
 const reply=(code,data)=>({statusCode:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://level44unlocked.netlify.app'},body:JSON.stringify(data)});
 if(event.httpMethod!=='GET')return reply(405,{playing:false});
 try{
  const s=await store();let auth=await s.get('auth',{type:'json'});if(!auth?.refresh_token)return reply(200,{playing:false});
  const {SPOTIFY_CLIENT_ID:id,SPOTIFY_CLIENT_SECRET:secret}=process.env;
  if(!id||!secret)return reply(503,{playing:false});
  if(!auth.access_token||Date.now()>auth.expires_at-60000){
   const res=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:auth.refresh_token})});
   if(!res.ok)return reply(200,{playing:false});
   const t=await res.json();auth={refresh_token:t.refresh_token||auth.refresh_token,access_token:t.access_token,expires_at:Date.now()+t.expires_in*1000};await s.setJSON('auth',auth);
  }
  const res=await fetch('https://api.spotify.com/v1/me/player/currently-playing',{headers:{Authorization:'Bearer '+auth.access_token},signal:AbortSignal.timeout(8000)});
  if(res.status===204||!res.ok)return reply(200,{playing:false});
  const data=await res.json();const item=data.item;
  if(!data.is_playing||!item)return reply(200,{playing:false});
  if(data.currently_playing_type==='episode'||item.type==='episode'){
   const show=item.show||{};
   return reply(200,{playing:true,kind:'podcast',title:String(item.name||'Podcastaflevering').slice(0,150),artist:String(show.name||'Podcast').slice(0,150),cover:item.images?.[0]?.url||show.images?.[0]?.url||null});
  }
  if(data.currently_playing_type!=='track'&&item.type!=='track')return reply(200,{playing:false});
  return reply(200,{playing:true,kind:'track',title:String(item.name||'').slice(0,150),artist:(item.artists||[]).map(x=>x.name).join(', ').slice(0,150),cover:item.album?.images?.[0]?.url||null});
 }catch{return reply(200,{playing:false})}
};
