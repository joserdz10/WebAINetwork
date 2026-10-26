const crypto=require('crypto');
const {discoverMetaPages,apiVersion}=require('./meta');
const pending=new Map();
const MAX_AGE=10*60*1000;
function configured(){return Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET&&process.env.SOCIAL_CREDENTIALS_KEY)}
function origin(){
  const raw=process.env.PUBLIC_BASE_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
  if(!raw)throw new Error('PUBLIC_BASE_URL_REQUIRED');
  const url=new URL(raw);
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('META_OAUTH_HTTPS_REQUIRED');
  return url.origin;
}
function redirectUri(){return origin()+'/api/meta/oauth/callback'}
function cookie(req){return String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('am_meta_oauth='))?.slice('am_meta_oauth='.length)||''}
function cookieOptions(){return {httpOnly:true,secure:origin().startsWith('https:'),sameSite:'lax',path:'/api/meta/oauth',maxAge:MAX_AGE}}
function prune(){for(const [key,val] of pending)if(Date.now()-val.created>MAX_AGE)pending.delete(key)}
function start(req,res){
  if(!configured())return res.status(503).json({ok:false,message:'Configura META_APP_ID, META_APP_SECRET y SOCIAL_CREDENTIALS_KEY'});
  try{
    prune();const state=crypto.randomBytes(24).toString('hex');
    pending.set(state,{created:Date.now(),status:'pending'});
    res.cookie('am_meta_oauth',state,cookieOptions());
    const url=new URL('https://www.facebook.com/'+apiVersion()+'/dialog/oauth');
    url.searchParams.set('client_id',process.env.META_APP_ID);
    url.searchParams.set('redirect_uri',redirectUri());
    url.searchParams.set('response_type','code');
    url.searchParams.set('state',state);
    url.searchParams.set('scope','pages_show_list,pages_read_engagement,pages_manage_posts');
    res.json({ok:true,data:{url:url.toString()}});
  }catch(e){res.status(400).json({ok:false,message:e.message})}
}
async function tokenRequest(params){
  const url=new URL('https://graph.facebook.com/'+apiVersion()+'/oauth/access_token');
  for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);
  const response=await fetch(url,{headers:{Accept:'application/json'}});
  const json=await response.json();
  if(!response.ok||json.error)throw new Error(json.error?.message||'META_OAUTH_TOKEN_EXCHANGE_FAILED');
  return json.access_token;
}
async function callback(req,res){
  const state=String(req.query.state||'');
  const flow=pending.get(state);
  if(!state||state!==cookie(req)||!flow||flow.status!=='pending'||Date.now()-flow.created>MAX_AGE)return res.status(403).send('Autorización vencida o inválida. Regresa a la plataforma e inténtalo nuevamente.');
  const destination=new URL('/',origin());destination.searchParams.set('meta_oauth','done');destination.hash='integrations';
  try{
    if(req.query.error)throw new Error(String(req.query.error_description||req.query.error));
    if(!req.query.code)throw new Error('META_OAUTH_CODE_MISSING');
    const shortToken=await tokenRequest({client_id:process.env.META_APP_ID,client_secret:process.env.META_APP_SECRET,redirect_uri:redirectUri(),code:String(req.query.code)});
    let accessToken=shortToken;
    try{accessToken=await tokenRequest({grant_type:'fb_exchange_token',client_id:process.env.META_APP_ID,client_secret:process.env.META_APP_SECRET,fb_exchange_token:shortToken})}catch(e){console.warn('Meta long-lived token exchange unavailable:',e.message)}
    flow.result=await discoverMetaPages(accessToken);
    flow.status='ready';
  }catch(e){flow.status='error';flow.error=e.message}
  res.setHeader('Cache-Control','no-store');
  res.redirect(303,destination.toString());
}
function result(req,res){
  prune();const state=cookie(req),flow=pending.get(state);
  if(!flow||flow.status==='pending')return res.status(404).json({ok:false,message:'No existe una autorización terminada'});
  pending.delete(state);res.clearCookie('am_meta_oauth',{...cookieOptions(),maxAge:undefined});
  res.setHeader('Cache-Control','no-store');
  if(flow.status==='error')return res.status(400).json({ok:false,message:flow.error});
  res.json({ok:true,data:flow.result});
}
module.exports={configured,start,callback,result,redirectUri};
