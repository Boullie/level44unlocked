'use strict';
const {getStore}=require('@netlify/blobs');
const wishStore=()=>getStore(process.env.NETLIFY_SITE_ID&&process.env.NETLIFY_API_TOKEN?{name:'level44-wishes-v1',siteID:process.env.NETLIFY_SITE_ID,token:process.env.NETLIFY_API_TOKEN}:'level44-wishes-v1');
async function store(){try{return getStore('level44-spotify-v1')}catch(e){if(e?.name!=='MissingBlobsEnvironmentError')throw e;const token=process.env.NETLIFY_API_TOKEN;let siteID=process.env.NETLIFY_SITE_ID||process.env.SITE_ID;if(!token)throw Error('Blobs token ontbreekt');if(!siteID){const r=await fetch('https://api.netlify.com/api/v1/sites/level44unlocked.netlify.app',{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Site ID ontbreekt');siteID=(await r.json()).id}return getStore({name:'level44-spotify-v1',siteID,token})}}
exports.handler=async(event)=>{
 const reply=(code,data)=>({statusCode:code,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://level44unlocked.netlify.app'},body:JSON.stringify(data)});
 if(event.httpMethod==='POST'){
  try{
   const body=JSON.parse(event.body||'{}');const ack=String(body.ack||'');
   if(!/^[a-f0-9-]{36}$/.test(ack))return reply(400,{ok:false});
   const ws=wishStore(),active=await ws.get('active',{type:'json'});
   if(!active||active.ack!==ack||active.done)return reply(409,{ok:false});
   const wishes=await ws.get('wishes',{type:'json'})||[];
   const w=wishes.find(w=>w.id===active.wishId);
   if(!w)return reply(404,{ok:false});
   w.lastShownAt=Date.now();active.done=true;await ws.setJSON('wishes',wishes);await ws.setJSON('active',active);
   return reply(200,{ok:true});
  }catch(e){return reply(503,{ok:false})}
 }
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
  let wish=null;
  try{
   const ws=wishStore(),now=Date.now(),trackId=String(item.id||'');
   if(trackId){
    const active=await ws.get('active',{type:'json'});
    const playKey=trackId+':'+String(data.timestamp||'');
    if(active?.playKey===playKey){wish=active.done?null:active.wish}
    else if(active?.playKey!==playKey){
     const wishes=await ws.get('wishes',{type:'json'})||[];
     const candidate=wishes.find(w=>w.approved&&w.spotifyId===trackId&&(!w.lastShownAt||now-w.lastShownAt>=7200000));
     if(candidate){
      const ack=crypto.randomUUID();
      wish={name:candidate.name,title:candidate.title,artist:candidate.artist,message:candidate.message,ack};
      await ws.setJSON('active',{playKey,at:now,wish,wishId:candidate.id,ack,done:false});
     }
    }
   }
  }catch(e){console.error('wish match unavailable',e?.message)}
  return reply(200,{playing:true,kind:'track',trackId:String(item.id||''),uri:String(item.uri||''),startedAt:Number.isFinite(data.timestamp)?data.timestamp:null,progressMs:Number.isFinite(data.progress_ms)?data.progress_ms:null,durationMs:Number.isFinite(item.duration_ms)?item.duration_ms:null,title:String(item.name||'').slice(0,150),artist:(item.artists||[]).map(x=>x.name).join(', ').slice(0,150),artists:(item.artists||[]).map(x=>String(x.name||'').slice(0,100)).slice(0,8),cover:item.album?.images?.[0]?.url||null,wish});
 }catch{return reply(200,{playing:false})}
};
