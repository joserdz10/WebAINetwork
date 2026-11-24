const {assertEditorialQuality}=require('./editorial-quality');
const {VISUAL_TYPES,validateVisual,context,safeCaption}=require('./visual-policy');
const {publishMeta}=require('./integrations/meta');
const {sendTelegram}=require('./integrations/telegram');
const {uploadTextToDrive}=require('./integrations/drive');
const {signMediaId,configured:secretVaultConfigured}=require('./secret-vault');

function publicBaseUrl(){
  if(process.env.PUBLIC_BASE_URL)return String(process.env.PUBLIC_BASE_URL).replace(/\/$/,'');
  if(process.env.RAILWAY_PUBLIC_DOMAIN)return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return null;
}
function publicImageUrl(piece){
  if(!piece?.imageUrl)return null;
  if(/^https?:\/\//i.test(piece.imageUrl))return piece.imageUrl;
  if(!secretVaultConfigured())return null;
  const base=publicBaseUrl();if(!base)return null;
  return `${base}/media/${encodeURIComponent(piece.id)}/${signMediaId(piece.id)}.png`;
}
function publicationErrorCode(error){return String(error?.message||'PUBLICATION_FAILED').split(':')[0].slice(0,120)}
function publicationErrorMessage(error){return String(error?.message||'Error de publicación').slice(0,1800)}
async function publishPiece(prisma,{pieceId,accountId}){
  if(!pieceId||!accountId)throw new Error('PIECE_AND_ACCOUNT_REQUIRED');
  const [piece,account]=await Promise.all([
    prisma.contentPiece.findUnique({where:{id:pieceId},include:{story:{include:{stateBrain:true}},mediaIdentity:true}}),
    prisma.socialAccount.findUnique({where:{id:accountId}})
  ]);
  if(!piece||!account)throw new Error('PIECE_OR_ACCOUNT_NOT_FOUND');
  // Never send an identity's editorial content to a different identity's page.
  if(piece.mediaIdentityId!==account.mediaIdentityId)throw new Error('CHANNEL_IDENTITY_MISMATCH: Este canal no pertenece a la identidad de la pieza');
  // Disallow duplicate attempts after Meta has already accepted a post.
  const already=await prisma.publication.findFirst({where:{contentPieceId:piece.id,socialAccountId:account.id,status:'PUBLISHED'},orderBy:{createdAt:'desc'}});
  if(already){const e=new Error('ALREADY_PUBLISHED_TO_CHANNEL: Esta pieza ya fue publicada en este canal');e.status=409;throw e}
  const pending=await prisma.publication.findFirst({where:{contentPieceId:piece.id,socialAccountId:account.id,status:'PUBLISHING',createdAt:{gte:new Date(Date.now()-10*60000)}}});
  if(pending){const e=new Error('PUBLICATION_IN_PROGRESS: Ya existe un envío en curso. Revisa el historial antes de intentarlo otra vez');e.status=409;throw e}

  // Record BEFORE editorial checks so the Publications page captures rejected attempts.
  const publication=await prisma.publication.create({data:{
    contentPieceId:piece.id,socialAccountId:account.id,status:'PUBLISHING',attemptCount:1,
    metadata:{phase:'PREFLIGHT',pieceStatus:piece.status,platform:account.platform}
  }});
  try{
    if(!account.isActive||account.connectionStatus!=='CONNECTED')throw new Error('SOCIAL_ACCOUNT_NOT_CONNECTED');
    if(!['APPROVED','SCHEDULED'].includes(piece.status))throw new Error('CONTENT_MUST_BE_APPROVED_BEFORE_PUBLISHING: Primero aprueba esta pieza');
    if(VISUAL_TYPES.has(piece.type)){
      assertEditorialQuality({title:piece.story.title,summary:piece.story.summary,stateCode:piece.story.stateBrain?.stateCode});
      const m=piece.metadata||{};
      validateVisual({caption:m.visualCaption||safeCaption(piece.headline),summary:m.visualSummary||context(piece.story,piece.copy),source:m.visualSource,imageUrl:piece.imageUrl,metadata:m});
    }
    await prisma.publication.update({where:{id:publication.id},data:{metadata:{phase:'SENDING',pieceStatus:piece.status,platform:account.platform}}});
    let result;
    if(account.platform==='FACEBOOK'||account.platform==='INSTAGRAM')result=await publishMeta(account,piece,{publicImageUrl:publicImageUrl(piece)});
    else if(account.platform==='X'||account.platform==='TIKTOK')throw new Error(`${account.platform}_PUBLISHER_NOT_CONFIGURED`);
    else if(account.platform==='TELEGRAM')result=await sendTelegram(piece,account);
    else throw new Error(`${account.platform}_PUBLISHER_NOT_CONFIGURED`);
    if(!result?.externalPostId)throw new Error('PUBLISHER_DID_NOT_RETURN_POST_ID: No se pudo confirmar el ID de la publicación');
    const externalId=String(result.externalPostId);
    const externalUrl=account.platform==='FACEBOOK'
      ?(/^\d+_\d+$/.test(externalId)?`https://www.facebook.com/${externalId}`:/^\d+$/.test(externalId)?`https://www.facebook.com/photo/?fbid=${externalId}`:null)
      :account.platform==='INSTAGRAM'?null:result.externalUrl||null;
    const updated=await prisma.publication.update({where:{id:publication.id},data:{
      status:'PUBLISHED',publishedAt:new Date(),externalPostId:externalId,externalUrl,
      metadata:{phase:'ACKNOWLEDGED',providerResult:result.raw||result,channelId:account.externalAccountId}
    }});
    await prisma.contentPiece.update({where:{id:piece.id},data:{status:'PUBLISHED'}});
    await prisma.socialAccount.update({where:{id:account.id},data:{lastCheckedAt:new Date(),lastError:null}}).catch(()=>{});
    await prisma.activityEvent.create({data:{type:'CONTENT_PUBLISHED',entityType:'PUBLICATION',entityId:updated.id,title:`Publicado en ${account.platform}`,detail:piece.story.title}}).catch(e=>console.warn('Publication activity event:',e.message));
    return updated;
  }catch(e){
    const errorCode=publicationErrorCode(e),errorMessage=publicationErrorMessage(e);
    await prisma.publication.update({where:{id:publication.id},data:{status:'FAILED',errorCode,errorMessage,metadata:{phase:'FAILED',platform:account.platform}}}).catch(err=>console.error('Publication failure logging:',err.message));
    await prisma.socialAccount.update({where:{id:account.id},data:{lastCheckedAt:new Date(),lastError:errorMessage,connectionStatus:/TOKEN|OAUTH|190|expired/i.test(errorMessage)?'ERROR':account.connectionStatus}}).catch(()=>{});
    await prisma.systemError.create({data:{code:errorCode,module:'PUBLICATION',message:errorMessage,entityType:'CONTENT_PIECE',entityId:piece.id}}).catch(()=>{});
    throw e;
  }
}

async function savePieceToDrive(prisma,pieceId){
  const piece=await prisma.contentPiece.findUnique({where:{id:pieceId},include:{story:true,mediaIdentity:true}});
  if(!piece) throw new Error('CONTENT_PIECE_NOT_FOUND');
  const text=[`AI Media Network`, `Identidad: ${piece.mediaIdentity.name}`, `Historia #${piece.story.publicId}: ${piece.story.title}`, `Formato: ${piece.type}`, '', piece.headline, piece.copy, piece.body].filter(Boolean).join('\n\n');
  const file=await uploadTextToDrive(`story-${piece.story.publicId}-${piece.mediaIdentity.slug}-${piece.type}.txt`,text);
  await prisma.activityEvent.create({data:{type:'DRIVE_EXPORT',entityType:'CONTENT_PIECE',entityId:piece.id,title:'Pieza enviada a Google Drive',detail:file.name||piece.headline,metadata:file}});
  return file;
}

async function schedulePiece(prisma,{pieceId,accountId,scheduledAt}){
  const piece=await prisma.contentPiece.findUnique({where:{id:pieceId}});
  const account=await prisma.socialAccount.findUnique({where:{id:accountId}});
  if(!piece||!account) throw new Error('PIECE_OR_ACCOUNT_NOT_FOUND');
  if(piece.status!=='APPROVED')throw new Error('CONTENT_MUST_BE_APPROVED_BEFORE_SCHEDULING');
  if(!account.isActive||account.connectionStatus!=='CONNECTED')throw new Error('SOCIAL_ACCOUNT_NOT_CONNECTED');
  const when=new Date(scheduledAt); if(Number.isNaN(when.getTime())) throw new Error('INVALID_SCHEDULE_DATE');
  await prisma.contentPiece.update({where:{id:pieceId},data:{status:'SCHEDULED'}});
  return prisma.publication.create({data:{contentPieceId:pieceId,socialAccountId:accountId,status:'SCHEDULED',scheduledAt:when}});
}
async function processScheduled(prisma){
  const rows=await prisma.publication.findMany({where:{status:'SCHEDULED',scheduledAt:{lte:new Date()}},take:20});
  const out=[];
  for(const row of rows){
    try{
      await prisma.publication.delete({where:{id:row.id}});
      out.push(await publishPiece(prisma,{pieceId:row.contentPieceId,accountId:row.socialAccountId}));
    }catch(e){console.error('Scheduled publication:',e.message)}
  }
  return out;
}
module.exports={publishPiece,savePieceToDrive,schedulePiece,processScheduled,publicImageUrl};
