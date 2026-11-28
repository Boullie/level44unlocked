'use strict';
const crypto=require('node:crypto');
const TTL=8*60*60*1000;
const secret=()=>process.env.LEVEL44_SESSION_SECRET||process.env.SPOTIFY_CLIENT_SECRET;
function sign(payload){return crypto.createHmac('sha256',secret()).update(payload).digest('base64url')}
function read(event){
 if(!secret())return false;
 const cookie=event.headers?.cookie||event.headers?.Cookie||'';
 const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('level44_admin='))?.slice(14);
 if(!token)return false;
 const [payload,mac]=token.split('.');
 if(!payload||!mac)return false;
 const expected=sign(payload);
 if(Buffer.byteLength(mac)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))return false;
 try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());return data.exp>Date.now()&&data.exp<=Date.now()+TTL&&data.email===process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase()}catch{return false}
}
function cookie(email){const payload=Buffer.from(JSON.stringify({email:email.toLowerCase(),exp:Date.now()+TTL})).toString('base64url');return 'level44_admin='+payload+'.'+sign(payload)+'; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax'}
module.exports={read,cookie};
