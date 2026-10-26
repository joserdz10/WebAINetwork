const crypto=require('node:crypto');
const {safeWebsite}=require('./source-auto-discovery');

function canonicalArticle(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password)throw new Error('INVALID_ARTICLE_URL');
 u.hash='';
 for(const key of [...u.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/i.test(key))u.searchParams.delete(key);
 return u.href;
}
async function saveResearchFindings(prisma,search){
 if(search.scope==='MX')return {saved:0,existing:0,reason:'Choose a state to save external results'};
 const web=search.results.filter(x=>x.origin==='WEB_UNVERIFIED');
 if(!web.length)return {saved:0,existing:0};
 const state=await prisma.stateBrain.findFirst({where:{stateCode:search.scope}});
 if(!state)throw new Error('STATE_NOT_FOUND');
 const entries=[];const unique=new Set();let existing=0;
 for(const item of web){
  try{
   const url=canonicalArticle(item.url);
   if(unique.has(url)){existing++;continue}
   unique.add(url);
   // Restrict the persisted record to a public hostname, never an internal URL.
   await safeWebsite(url);
   const found=await prisma.discoveryCandidate.findFirst({where:{canonicalUrl:url,discoveryRun:{stateBrainId:state.id}},select:{id:true}});
   if(found){existing++;continue}
   entries.push({url,canonicalUrl:url,title:String(item.title).slice(0,220),excerpt:String(item.excerpt||'').slice(0,500),publishedAt:item.publishedAt&&!Number.isNaN(Date.parse(item.publishedAt))?new Date(item.publishedAt):null,status:'REVIEW_REQUIRED',relevanceScore:0,duplicateKey:crypto.createHash('sha256').update(url).digest('hex'),metadata:{origin:'SPECIALIZED_WEB',sourceName:item.sourceName||new URL(url).hostname,query:search.query,type:search.type,review:'PENDING',verified:false}});
  }catch{}
 }
 if(!entries.length)return {saved:0,existing};
 const run=await prisma.discoveryRun.create({data:{stateBrainId:state.id,status:'COMPLETED',startedAt:new Date(),finishedAt:new Date(),periodStart:new Date(Date.now()-search.hours*3600000),periodEnd:new Date(),itemsScanned:entries.length,candidatesFound:0,summary:{kind:'SPECIALIZED_RESEARCH',query:search.query,type:search.type,scope:search.scope,web:true}}});
 await prisma.discoveryCandidate.createMany({data:entries.map(x=>({...x,discoveryRunId:run.id}))});
 return {saved:entries.length,existing};
}
async function getResearchInbox(prisma,code){
 const state=await prisma.stateBrain.findFirst({where:{stateCode:code}});
 if(!state)throw Object.assign(new Error('STATE_NOT_FOUND'),{status:404});
 const rows=await prisma.discoveryCandidate.findMany({where:{discoveryRun:{stateBrainId:state.id},metadata:{path:['origin'],equals:'SPECIALIZED_WEB'}},include:{source:true},orderBy:{createdAt:'desc'},take:200});
 return rows.map(x=>({id:x.id,title:x.title,url:x.url,excerpt:x.excerpt,sourceName:x.source?.name||x.metadata?.sourceName||'Fuente externa',query:x.metadata?.query||'',status:x.status,createdAt:x.createdAt,sourceId:x.sourceId,storyId:x.storyId}));
}
async function reviewResearch(prisma,{id,stateCode,action}){
 if(!['APPROVE','DISCARD'].includes(action))throw Object.assign(new Error('INVALID_ACTION'),{status:400});
 const state=await prisma.stateBrain.findFirst({where:{stateCode}});
 if(!state)throw Object.assign(new Error('STATE_NOT_FOUND'),{status:404});
 const row=await prisma.discoveryCandidate.findFirst({where:{id,discoveryRun:{stateBrainId:state.id}}});
 if(!row||row.metadata?.origin!=='SPECIALIZED_WEB')throw Object.assign(new Error('RESEARCH_NOT_FOUND'),{status:404});
 if(row.status!=='REVIEW_REQUIRED')throw Object.assign(new Error('RESEARCH_ALREADY_REVIEWED'),{status:409});
 if(action==='DISCARD')return prisma.discoveryCandidate.update({where:{id},data:{status:'DISCARDED',decisionReason:'Descartado durante revisión editorial',metadata:{...row.metadata,review:'DISCARDED'}}});
 const article=await safeWebsite(canonicalArticle(row.url));
 const domain=article.hostname.replace(/^www\./,'').toLowerCase();
 let source=await prisma.source.findFirst({where:{stateBrainId:state.id,OR:[{domain},{domain:'www.'+domain}]}});
 if(!source)source=await prisma.source.create({data:{stateBrainId:state.id,name:String(row.metadata?.sourceName||domain).slice(0,150),type:'WEBSITE',url:article.origin+'/',domain,isActive:false,trustScore:null,configuration:{origin:'SPECIALIZED_RESEARCH',verification:'MANUAL_REVIEW',notes:'Sitio no habilitado para monitoreo automático'}}});
 return prisma.discoveryCandidate.update({where:{id},data:{status:'CANDIDATE',sourceId:source.id,decisionReason:'Fuente enlazada y aprobada por operador',metadata:{...row.metadata,review:'APPROVED',verified:true}}});
}
module.exports={canonicalArticle,saveResearchFindings,getResearchInbox,reviewResearch};
