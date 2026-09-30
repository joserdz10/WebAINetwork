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
async function publishPiece(prisma,{pieceId,accountId}){
  const piece=await prisma.contentPiece.findUnique({where:{id:pieceId},include:{story:true,mediaIdentity:true}});
  const account=await prisma.socialAccount.findUnique({where:{id:accountId}});
  if(!piece||!account) throw new Error('PIECE_OR_ACCOUNT_NOT_FOUND');
  if(!account.isActive||account.connectionStatus!=='CONNECTED')throw new Error('SOCIAL_ACCOUNT_NOT_CONNECTED');
  if(!['APPROVED','SCHEDULED'].includes(piece.status))throw new Error('CONTENT_MUST_BE_APPROVED_BEFORE_PUBLISHING');
  const publication=await prisma.publication.create({data:{contentPieceId:piece.id,socialAccountId:account.id,status:'PUBLISHING',attemptCount:1}});
  try{
    let result;
    if(account.platform==='FACEBOOK'||account.platform==='INSTAGRAM') result=await publishMeta(account,piece,{publicImageUrl:publicImageUrl(piece)});
    else if(account.platform==='X'||account.platform==='TIKTOK') throw new Error(`${account.platform}_PUBLISHER_NOT_CONFIGURED`);
    else if(account.platform==='TELEGRAM') result=await sendTelegram(piece,account);
    else if(account.platform==='WEBSITE') throw new Error('WEBSITE_PUBLISHER_NOT_CONFIGURED');
    const updated=await prisma.publication.update({where:{id:publication.id},data:{status:'PUBLISHED',publishedAt:new Date(),externalPostId:result.externalPostId||null,externalUrl:result.externalUrl||null,metadata:result.raw||result}});
    await prisma.contentPiece.update({where:{id:piece.id},data:{status:'PUBLISHED'}});
    await prisma.socialAccount.update({where:{id:account.id},data:{lastCheckedAt:new Date(),lastError:null}}).catch(()=>{});
    await prisma.activityEvent.create({data:{type:'CONTENT_PUBLISHED',entityType:'PUBLICATION',entityId:updated.id,title:`Publicado en ${account.platform}`,detail:piece.story.title}});
    return updated;
  }catch(e){
    await prisma.publication.update({where:{id:publication.id},data:{status:'FAILED',errorCode:e.message.split(':')[0],errorMessage:e.message}});
    await prisma.socialAccount.update({where:{id:account.id},data:{lastCheckedAt:new Date(),lastError:e.message,connectionStatus:/TOKEN|OAUTH|190|expired/i.test(e.message)?'ERROR':account.connectionStatus}}).catch(()=>{});
    await prisma.systemError.create({data:{code:e.message.split(':')[0],module:'PUBLICATION',message:e.message,entityType:'CONTENT_PIECE',entityId:piece.id}});
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
