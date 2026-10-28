'use strict';
const {runDiscovery,candidateToStory}=require('./discovery');
const {analyzeStory}=require('./story-intelligence');
const {generatePiece,generatePieceImage}=require('./content');

const DEFAULTS=Object.freeze({enabled:true,intervalMinutes:30,maxPiecesPerIdentity:6,globalCycleLimit:60,concurrency:2,prioritizeLocal:true,notifyTelegram:true,requireApproval:true,lookbackHours:6});
const LIMITS={intervalMinutes:[5,1440],maxPiecesPerIdentity:[1,20],globalCycleLimit:[1,200],concurrency:[1,4],lookbackHours:[1,48]};
const VISUAL_TYPE='FACEBOOK_POST';
let active=0,workerBusy=false,tickerBusy=false,workerIdentityLocks=new Set();
function number(v,f,min,max){const x=Number(v);return Number.isFinite(x)?Math.max(min,Math.min(max,Math.round(x))):f}
function config(value){const x=value&&typeof value==='object'&&!Array.isArray(value)?value:{};return {
 enabled:x.enabled!==false,intervalMinutes:number(x.intervalMinutes,30,...LIMITS.intervalMinutes),
 maxPiecesPerIdentity:number(x.maxPiecesPerIdentity,6,...LIMITS.maxPiecesPerIdentity),
 globalCycleLimit:number(x.globalCycleLimit,60,...LIMITS.globalCycleLimit),
 concurrency:number(x.concurrency,2,...LIMITS.concurrency),
 prioritizeLocal:x.prioritizeLocal!==false,notifyTelegram:x.notifyTelegram!==false,
 requireApproval:true,lookbackHours:number(x.lookbackHours,6,...LIMITS.lookbackHours)
}}
async function getConfig(prisma){const row=await prisma.appSetting.findUnique({where:{key:'editorial.automation'}});return config(row?.value)}
async function setConfig(prisma,input){const next=config(input);await prisma.appSetting.upsert({where:{key:'editorial.automation'},create:{key:'editorial.automation',value:next,description:'Motor editorial automático v1.11.0'},update:{value:next}});return next}
async function enqueue(prisma,{key,kind,stateCode,identityId,storyId,payload}){return prisma.editorialJob.upsert({where:{dedupeKey:key},create:{dedupeKey:key,kind,stateCode:stateCode||null,identityId:identityId||null,storyId:storyId||null,payload:payload||{},status:'QUEUED'},update:{}})}
function cycleKey(date,minutes){return String(Math.floor(date.getTime()/(minutes*60000)))}
async function scheduleCycle(prisma,settings,now=new Date()){
 const states=await prisma.stateBrain.findMany({where:{status:'ACTIVE',stateCode:{not:null}},select:{stateCode:true,id:true},orderBy:{stateCode:'asc'}});
 const bucket=cycleKey(now,settings.intervalMinutes);let count=0;
 for(const state of states){await enqueue(prisma,{key:`discovery:${state.stateCode}:${bucket}`,kind:'DISCOVERY',stateCode:state.stateCode,payload:{hours:settings.lookbackHours,bucket}});count++}
 return count;
}
async function notify(prisma,settings,text){
 if(!settings.notifyTelegram||!process.env.TELEGRAM_BOT_TOKEN)return;
 const setting=await prisma.appSetting.findUnique({where:{key:'editorial.telegramChatIds'}});
 const ids=Array.isArray(setting?.value)?setting.value.filter(x=>typeof x==='string'||typeof x==='number').slice(0,5):[];
 if(!ids.length)return;
 for(const chatId of ids)try{
 const ctrl=AbortSignal.timeout(8000);
 const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:text.slice(0,3500)}),signal:ctrl});
 if(!r.ok)console.warn('Editorial Telegram notification:',r.status);
 }catch(e){console.warn('Editorial Telegram:',e.message)}
}
async function queueProduction(prisma,job,settings){
 const state=await prisma.stateBrain.findFirst({where:{stateCode:job.stateCode},select:{id:true,name:true}});
 if(!state)return 0;
 const identities=await prisma.mediaIdentity.findMany({where:{stateBrainId:state.id,status:'ACTIVE'},select:{id:true,name:true},orderBy:{name:'asc'}});
 const candidates=await prisma.discoveryCandidate.findMany({where:{discoveryRun:{stateBrainId:state.id},status:'CANDIDATE',relevanceScore:{gte:0.55},createdAt:{gte:new Date(Date.now()-settings.lookbackHours*3600000)}},include:{discoveryRun:{select:{stateBrainId:true}}},orderBy:[{relevanceScore:'desc'},{createdAt:'desc'}],take:250});
 const existing=await prisma.story.findMany({where:{stateBrainId:state.id,detectedAt:{gte:new Date(Date.now()-7*86400000)}},select:{title:true},take:500});
 const titleKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,140);
 const knownTitles=new Set(existing.map(x=>titleKey(x.title)));
 const eligible=[];const seen=new Set();
 for(const c of candidates){const fingerprint=c.canonicalUrl||c.duplicateKey||titleKey(c.title);const title=titleKey(c.title);
 if(!c.sourceId||!c.url||!/^https?:\/\//.test(c.url)||!c.excerpt||c.excerpt.trim().length<60||knownTitles.has(title)||seen.has(fingerprint))continue;
 if(c.metadata?.origin==='SPECIALIZED_WEB'&&c.metadata?.verification!=='OPERATOR_REVIEWED')continue;
 seen.add(fingerprint);eligible.push(c);
 }
 let queued=0;
 for(const identity of identities){
 if(queued>=settings.globalCycleLimit)break;
 const already=await prisma.editorialJob.count({where:{identityId:identity.id,kind:'PRODUCE',status:{in:['QUEUED','RUNNING']}}});
 const quota=Math.max(0,settings.maxPiecesPerIdentity-already);
 for(const candidate of eligible.slice(0,quota)){
 if(queued>=settings.globalCycleLimit)break;
 const key=`produce:${candidate.id}:${identity.id}`;
 const exists=await prisma.editorialJob.findUnique({where:{dedupeKey:key},select:{id:true}});
 if(exists)continue;
 await enqueue(prisma,{key,kind:'PRODUCE',stateCode:job.stateCode,identityId:identity.id,payload:{candidateId:candidate.id}});
 queued++;
 }
 }
 return queued;
}
async function perform(prisma,job,settings){
 if(job.kind==='DISCOVERY'){
 const run=await runDiscovery(prisma,job.stateCode,{hours:job.payload?.hours||settings.lookbackHours});
 if(run.status==='FAILED')throw new Error('DISCOVERY_FAILED_ALL_SOURCES');
 const queued=await queueProduction(prisma,job,settings);
 return {runId:run.id,queued};
 }
 if(job.kind==='PRODUCE'){
 const candidate=await prisma.discoveryCandidate.findUnique({where:{id:job.payload?.candidateId},include:{discoveryRun:{select:{stateBrainId:true}}}});
 const identity=await prisma.mediaIdentity.findUnique({where:{id:job.identityId},select:{stateBrainId:true,status:true,name:true}});
 if(!candidate||!identity||identity.status!=='ACTIVE'||candidate.discoveryRun.stateBrainId!==identity.stateBrainId)throw new Error('CANDIDATE_OR_IDENTITY_UNAVAILABLE');
 if(!['CANDIDATE','PROMOTED'].includes(candidate.status))throw new Error('CANDIDATE_NOT_APPROVED_FOR_PRODUCTION');
 // Reuse the promoted story when several identities produce the same report.
 const story=await candidateToStory(prisma,candidate.id);
 await prisma.editorialJob.update({where:{id:job.id},data:{storyId:story.id}});
 const existing=await prisma.contentPiece.findFirst({where:{storyId:story.id,mediaIdentityId:identity.id,type:VISUAL_TYPE},select:{id:true,status:true,metadata:true}});
 if(existing?.metadata?.imageStatus==='SOURCE_IMAGE_RENDERED')return {pieceId:existing.id,reused:true};
 if(existing){
  if(existing.status!=='GENERATED')throw new Error('EXISTING_PIECE_REQUIRES_MANUAL_REVIEW');
  await generatePieceImage(prisma,existing.id);
  await notify(prisma,settings,`📰 Pieza recuperada para revisión: ${identity.name} / #${story.publicId}`);
  return {pieceId:existing.id,recovered:true};
 }
 if(story.status==='DISCOVERED')await analyzeStory(prisma,story.publicId);
 const piece=await generatePiece(prisma,{publicId:story.publicId,identityId:identity.id,type:VISUAL_TYPE});
 // renderTemplate enforces authentic source image, complete caption and summary.
 await generatePieceImage(prisma,piece.id);
 await notify(prisma,settings,`📰 Pieza lista para revisión: ${identity.name}\n#${story.publicId} ${story.title}\nRevisa AI Media Network → Listas para aprobar. No se publicó automáticamente.`);
 return {pieceId:piece.id,storyId:story.id};
 }
 throw new Error('UNKNOWN_JOB_KIND');
}
async function claim(prisma){
 const candidates=await prisma.editorialJob.findMany({where:{status:'QUEUED',runAt:{lte:new Date()}},orderBy:[{runAt:'asc'},{createdAt:'asc'}],take:20});
 for(const job of candidates){
 if(job.identityId&&workerIdentityLocks.has(job.identityId))continue;
 const ok=await prisma.editorialJob.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'RUNNING',lockedAt:new Date(),attempts:{increment:1}}});
 if(ok.count===1){if(job.identityId)workerIdentityLocks.add(job.identityId);return job}
 }
 return null;
}
async function execute(prisma,job,settings){
 try{
 const result=await perform(prisma,job,settings);
 await prisma.editorialJob.update({where:{id:job.id},data:{status:'COMPLETED',finishedAt:new Date(),lockedAt:null,lastError:null,payload:{...(job.payload||{}),result}}});
 }catch(e){
 const attempt=job.attempts+1;const terminal=attempt>=job.maxAttempts||/^(VISUAL_|REAL_SOURCE_|EXISTING_PIECE_|CANDIDATE_|DISCOVERY_FAILED)/.test(e.message);
 await prisma.editorialJob.update({where:{id:job.id},data:{status:terminal?'FAILED':'QUEUED',lockedAt:null,finishedAt:terminal?new Date():null,runAt:new Date(Date.now()+Math.min(60,5*attempt)*60000),lastError:String(e.message).slice(0,1200)}});
 console.warn('Editorial job failed:',job.kind,job.id,e.message);
 }finally{if(job.identityId)workerIdentityLocks.delete(job.identityId)}
}
async function processQueue(prisma,settings){
 if(workerBusy)return;workerBusy=true;
 try{
 // Recovery after Railway restart, including multiple replicas.
 await prisma.editorialJob.updateMany({where:{status:'RUNNING',lockedAt:{lt:new Date(Date.now()-20*60000)}},data:{status:'QUEUED',lockedAt:null,runAt:new Date()}});
 const slots=Math.max(0,settings.concurrency-active);const jobs=[];
 for(let i=0;i<slots;i++){const job=await claim(prisma);if(!job)break;jobs.push(job)}
 active+=jobs.length;
 await Promise.all(jobs.map(async job=>{try{await execute(prisma,job,settings)}finally{active--}}));
 }finally{workerBusy=false}
}
async function tick(prisma,{force=false}={}){
 if(tickerBusy)return;tickerBusy=true;
 try{
 const settings=await getConfig(prisma);
 if(!settings.enabled&&!force)return;
 const last=await prisma.appSetting.findUnique({where:{key:'editorial.lastCycle'}});
 const elapsed=Date.now()-new Date(last?.value?.at||0).getTime();
 if(force||!last||elapsed>=settings.intervalMinutes*60000){
 const bucket=cycleKey(new Date(),settings.intervalMinutes);
 // A unique cycle key avoids double scheduling after a restart.
 const old=await prisma.appSetting.findUnique({where:{key:'editorial.lastCycle'}});
 if(old?.value?.bucket!==bucket){
 await scheduleCycle(prisma,settings);
 await prisma.appSetting.upsert({where:{key:'editorial.lastCycle'},create:{key:'editorial.lastCycle',value:{at:new Date().toISOString(),bucket}},update:{value:{at:new Date().toISOString(),bucket}}});
 }
 }
 await processQueue(prisma,settings);
 }finally{tickerBusy=false}
}
async function overview(prisma,stateCode){
 const where=stateCode?{stateCode}:{};
 const [jobs,pieces,settings]=await Promise.all([
 prisma.editorialJob.findMany({where,orderBy:{createdAt:'desc'},take:100}),
 prisma.contentPiece.findMany({where:{status:'GENERATED',metadata:{path:['imageStatus'],equals:'SOURCE_IMAGE_RENDERED'},...(stateCode?{story:{stateBrain:{stateCode}}}:{})},omit:{imageUrl:true},include:{story:{select:{publicId:true,title:true,detectedAt:true,sources:{include:{source:{select:{name:true}}}}}},mediaIdentity:{select:{name:true,id:true}}},orderBy:{createdAt:'desc'},take:100}),
 getConfig(prisma)]);
 return {settings,jobs,pieces,counts:jobs.reduce((o,j)=>(o[j.status]=(o[j.status]||0)+1,o),{})};
}
module.exports={DEFAULTS,config,getConfig,setConfig,enqueue,scheduleCycle,queueProduction,perform,claim,execute,processQueue,tick,overview};
