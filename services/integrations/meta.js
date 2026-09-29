function apiVersion(){return process.env.META_API_VERSION||'v23.0'}
function token(){if(!process.env.META_ACCESS_TOKEN)throw new Error('META_ACCESS_TOKEN_NOT_CONFIGURED');return process.env.META_ACCESS_TOKEN}
async function graph(path,params){const r=await fetch(`https://graph.facebook.com/${apiVersion()}/${path}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,access_token:token()})});if(!r.ok)throw new Error(`META_${r.status}: ${await r.text()}`);return r.json()}
async function publishMeta(account,piece){
  const id=account.externalAccountId;if(!id)throw new Error('META_EXTERNAL_ACCOUNT_ID_MISSING');
  const message=[piece.headline,piece.copy,piece.body].filter(Boolean).join('\n\n');
  if(account.platform==='FACEBOOK'){
    if(piece.imageUrl){const d=await graph(`${id}/photos`,{url:piece.imageUrl,caption:message});return{externalPostId:d.post_id||d.id,raw:d}}
    const d=await graph(`${id}/feed`,{message});return{externalPostId:d.id,raw:d};
  }
  if(account.platform==='INSTAGRAM'){
    if(!piece.imageUrl)throw new Error('INSTAGRAM_IMAGE_REQUIRED');
    const media=await graph(`${id}/media`,{image_url:piece.imageUrl,caption:message});
    const pub=await graph(`${id}/media_publish`,{creation_id:media.id});return{externalPostId:pub.id,raw:{media,publish:pub}};
  }
  throw new Error(`META_PLATFORM_NOT_IMPLEMENTED_${account.platform}`);
}
module.exports={publishMeta};
