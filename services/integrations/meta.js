const {decryptSecret,encryptTicket,decryptTicket,configured:secretVaultConfigured}=require('../secret-vault');

function apiVersion(){return process.env.META_API_VERSION||'v23.0'}
function base(){return `https://graph.facebook.com/${apiVersion()}`}
function parseMetaError(body,status){
  let detail=body;try{const j=JSON.parse(body);detail=j?.error?.message||body}catch{}
  const e=new Error(`META_${status}: ${detail}`);e.status=status;return e;
}
async function graphGet(path,accessToken,params={}){
  const u=new URL(`${base()}/${path}`);for(const[k,v]of Object.entries(params))if(v!=null)u.searchParams.set(k,String(v));u.searchParams.set('access_token',accessToken);
  const r=await fetch(u);const body=await r.text();if(!r.ok)throw parseMetaError(body,r.status);return body?JSON.parse(body):{};
}
async function graphPost(path,accessToken,params={}){
  const r=await fetch(`${base()}/${path}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,access_token:accessToken})});
  const body=await r.text();if(!r.ok)throw parseMetaError(body,r.status);return body?JSON.parse(body):{};
}
async function graphMultipart(path,accessToken,{buffer,mimeType='image/png',filename='image.png',caption=''}){
  const form=new FormData();form.append('access_token',accessToken);form.append('caption',caption);form.append('source',new Blob([buffer],{type:mimeType}),filename);
  const r=await fetch(`${base()}/${path}`,{method:'POST',body:form});const body=await r.text();if(!r.ok)throw parseMetaError(body,r.status);return body?JSON.parse(body):{};
}
function permissionsSummary(rows=[]){const granted=[],declined=[];for(const p of rows){if(p.status==='granted')granted.push(p.permission);else declined.push(p.permission)}return{granted,declined}}
async function discoverMetaPages(accessToken){
  if(!secretVaultConfigured())throw new Error('SOCIAL_CREDENTIALS_KEY_NOT_CONFIGURED');
  if(!accessToken)throw new Error('META_ACCESS_TOKEN_REQUIRED');
  const [me,perm,pages]=await Promise.all([
    graphGet('me',accessToken,{fields:'id,name'}),
    graphGet('me/permissions',accessToken),
    graphGet('me/accounts',accessToken,{fields:'id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}',limit:200})
  ]);
  const permissions=permissionsSummary(perm.data||[]);
  const requiredPermissions=['pages_show_list','pages_read_engagement','pages_manage_posts'];
  const missingPermissions=requiredPermissions.filter(x=>!permissions.granted.includes(x));
  return{user:me,permissions,requiredPermissions,missingPermissions,pages:(pages.data||[]).map(p=>({id:p.id,name:p.name,tasks:p.tasks||[],instagram:p.instagram_business_account||null,connectable:Boolean(p.access_token),ticket:p.access_token?encryptTicket({pageId:p.id,pageName:p.name,pageAccessToken:p.access_token,tasks:p.tasks||[],instagram:p.instagram_business_account||null,permissions}):null}))};
}

async function inspectPageAccessToken(accessToken){
  if(!secretVaultConfigured())throw new Error('SOCIAL_CREDENTIALS_KEY_NOT_CONFIGURED');
  if(!accessToken)throw new Error('META_ACCESS_TOKEN_REQUIRED');
  // Validate with the smallest possible Page request first. Some Page tokens/apps
  // reject richer /me field expansions even though the token itself is usable.
  let page;
  try{
    page=await graphGet('me',accessToken,{fields:'id,name'});
  }catch(e){
    if(String(e.message||'').includes('Invalid JSON for postcard')){
      const err=new Error('META_PAGE_TOKEN_REJECTED: Meta rechazó este Page Access Token durante la validación. Verifica que el token siga vigente y que pertenezca a una app/página con acceso permitido.');
      err.status=e.status||400;throw err;
    }
    throw e;
  }
  if(!page?.id)throw new Error('META_PAGE_TOKEN_INVALID');
  let username=null,instagram=null,permissions={granted:[],declined:[]};
  try{const extra=await graphGet(page.id,accessToken,{fields:'username'});username=extra?.username||null}catch{}
  try{const extra=await graphGet(page.id,accessToken,{fields:'instagram_business_account'});if(extra?.instagram_business_account?.id){
    const ig=await graphGet(extra.instagram_business_account.id,accessToken,{fields:'id,username,name,profile_picture_url'}).catch(()=>extra.instagram_business_account);
    instagram=ig||extra.instagram_business_account;
  }}catch{}
  try{const perm=await graphGet('me/permissions',accessToken);permissions=permissionsSummary(perm.data||[])}catch{}
  return{page:{id:page.id,name:page.name||'Facebook',username,instagram},permissions};
}
function accessTokenFromAccount(account){
  if(account?.credentialCiphertext&&account?.credentialIv&&account?.credentialTag){return decryptSecret({ciphertext:account.credentialCiphertext,iv:account.credentialIv,tag:account.credentialTag})}
  if(process.env.META_ACCESS_TOKEN)return process.env.META_ACCESS_TOKEN;
  throw new Error('META_ACCOUNT_TOKEN_NOT_CONFIGURED');
}
async function validateMetaAccount(account){
  const accessToken=accessTokenFromAccount(account),id=account.externalAccountId;if(!id)throw new Error('META_EXTERNAL_ACCOUNT_ID_MISSING');
  const fields=account.platform==='INSTAGRAM'?'id,username,name,profile_picture_url':'id,name,username,instagram_business_account{id,username,name}';
  const data=await graphGet(id,accessToken,{fields});return{ok:true,account:data};
}
function dataUri(value){const m=String(value||'').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);return m?{mimeType:m[1],buffer:Buffer.from(m[2],'base64')}:null}
async function publishMeta(account,piece,{publicImageUrl}={}){
  const accessToken=accessTokenFromAccount(account),id=account.externalAccountId;if(!id)throw new Error('META_EXTERNAL_ACCOUNT_ID_MISSING');
  const message=[piece.headline,piece.copy,piece.body].filter(Boolean).join('\n\n');
  if(account.platform==='FACEBOOK'){
    if(piece.imageUrl){
      const local=dataUri(piece.imageUrl);let d;
      if(local)d=await graphMultipart(`${id}/photos`,accessToken,{buffer:local.buffer,mimeType:local.mimeType,caption:message});
      else d=await graphPost(`${id}/photos`,accessToken,{url:piece.imageUrl,caption:message});
      return{externalPostId:d.post_id||d.id,raw:d};
    }
    const d=await graphPost(`${id}/feed`,accessToken,{message});return{externalPostId:d.id,raw:d};
  }
  if(account.platform==='INSTAGRAM'){
    const imageUrl=/^https?:\/\//i.test(piece.imageUrl||'')?piece.imageUrl:publicImageUrl;
    if(!imageUrl)throw new Error('INSTAGRAM_PUBLIC_IMAGE_URL_REQUIRED');
    const media=await graphPost(`${id}/media`,accessToken,{image_url:imageUrl,caption:message});
    const pub=await graphPost(`${id}/media_publish`,accessToken,{creation_id:media.id});return{externalPostId:pub.id,raw:{media,publish:pub}};
  }
  throw new Error(`META_PLATFORM_NOT_IMPLEMENTED_${account.platform}`);
}
module.exports={apiVersion,discoverMetaPages,inspectPageAccessToken,decryptTicket,validateMetaAccount,publishMeta,accessTokenFromAccount};
