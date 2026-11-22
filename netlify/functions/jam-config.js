'use strict';
const {read:hasAdminSession}=require('./admin-session');
const {getStore}=require('@netlify/blobs');
const reply=(statusCode,data)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(data)});
const store=()=>getStore(process.env.NETLIFY_SITE_ID&&process.env.NETLIFY_API_TOKEN?{name:'level44-jam-v1',siteID:process.env.NETLIFY_SITE_ID,token:process.env.NETLIFY_API_TOKEN}:'level44-jam-v1');
function valid(input){
 if(typeof input!=='string'||input.length>1200)return null;
 try{const u=new URL(input.trim());if(u.protocol!=='https:'||!['spotify.link','open.spotify.com','spotify.com'].includes(u.hostname)||u.username||u.password)return null;return u.href}catch{return null}
}
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return reply(405,{error:'Methode niet toegestaan'});
 try{
  const s=store();
  if(event.httpMethod==='GET'){
   const saved=await s.get('active',{type:'json'});
   return reply(200,{url:saved?.url||'',updatedAt:saved?.updatedAt||null});
  }
  if(!hasAdminSession(event))return reply(403,{error:'Log eerst in bij Mission Control'});
  if((event.body||'').length>2000)return reply(413,{error:'Te grote aanvraag'});
  let data;try{data=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Ongeldige JSON'})}
  if(data.op==='clear'){await s.delete('active');return reply(200,{url:'',updatedAt:null})}
  if(data.op!=='save')return reply(400,{error:'Onbekende actie'});
  const url=valid(data.url);
  if(!url)return reply(400,{error:'Gebruik een geldige Spotify Jam-uitnodigingslink (spotify.link of open.spotify.com)'});
  const updatedAt=new Date().toISOString();
  await s.setJSON('active',{url,updatedAt});
  return reply(200,{url,updatedAt});
 }catch(e){console.error('jam-config',e);return reply(500,{error:'Jam-instelling tijdelijk niet beschikbaar'})}
};
