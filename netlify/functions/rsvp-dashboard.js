'use strict';
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const respond=(statusCode,data)=>({statusCode,headers:JSON_HEADERS,body:JSON.stringify(data)});
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return respond(405,{error:'Method not allowed'});
  const {GOOGLE_CLIENT_ID,ADMIN_GOOGLE_EMAIL,NETLIFY_API_TOKEN,NETLIFY_FORM_ID}=process.env;
  if(!GOOGLE_CLIENT_ID||!ADMIN_GOOGLE_EMAIL||!NETLIFY_API_TOKEN||!NETLIFY_FORM_ID)return respond(503,{error:'Dashboard nog niet geconfigureerd'});
  let payload;try{payload=JSON.parse(event.body||'{}')}catch{return respond(400,{error:'Ongeldige aanvraag'})}
  if(typeof payload.idToken!=='string'||payload.idToken.length>5000)return respond(401,{error:'Aanmelden vereist'});
  try{
    const verify=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(payload.idToken),{signal:AbortSignal.timeout(8000)});
    if(!verify.ok)return respond(401,{error:'Ongeldige of verlopen aanmelding'});
    const identity=await verify.json();
    if(identity.aud!==GOOGLE_CLIENT_ID||identity.email_verified!=='true'||identity.email?.toLowerCase()!==ADMIN_GOOGLE_EMAIL.trim().toLowerCase()||!['accounts.google.com','https://accounts.google.com'].includes(identity.iss))return respond(403,{error:'Geen toegang'});
    const api=await fetch('https://api.netlify.com/api/v1/forms/'+encodeURIComponent(NETLIFY_FORM_ID)+'/submissions?per_page=100',{headers:{Authorization:'Bearer '+NETLIFY_API_TOKEN},signal:AbortSignal.timeout(12000)});
    if(!api.ok)return respond(502,{error:'Netlify Forms kon niet worden gelezen (HTTP '+api.status+')'});
    const submissions=await api.json();
    if(!Array.isArray(submissions))return respond(502,{error:'Onverwacht antwoord van Netlify'});
    // No raw submission metadata or IP addresses are returned to the browser.
    const records=submissions.map(s=>({submissionId:s.id,createdAt:s.created_at,fields:s.data||{}}));
    return respond(200,{records,warning:submissions.length===100?'Er zijn mogelijk meer dan 100 inzendingen; paginering moet nog worden toegevoegd.':null});
  }catch(e){return respond(502,{error:'De gegevens konden niet veilig worden opgehaald'})}
};
