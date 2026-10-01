const crypto=require('crypto');
const Parser=require('rss-parser');
const cheerio=require('cheerio');
const parser=new Parser({timeout:12000,headers:{'User-Agent':'AI-Media-Network/1.0 Editorial Discovery'}});

function strip(text=''){return String(text).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function norm(text=''){return strip(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function hashTitle(title=''){return crypto.createHash('sha1').update(norm(title)).digest('hex')}
function canonical(url){try{const u=new URL(url);['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid'].forEach(k=>u.searchParams.delete(k));u.hash='';return u.toString()}catch{return url}}
function absolute(value,base){try{return new URL(value,base).href}catch{return null}}
function array(v){return Array.isArray(v)?v:[]}
function firstImageFromJsonLd($,baseUrl){
  const found=[];
  $('script[type="application/ld+json"]').each((_,el)=>{try{
    const raw=$(el).contents().text();if(!raw)return;const parsed=JSON.parse(raw);const nodes=Array.isArray(parsed)?parsed:[parsed];
    const visit=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(visit);return}
      const image=node.image||node.thumbnailUrl||node.thumbnail;
      if(typeof image==='string')found.push(image);else if(Array.isArray(image))image.forEach(x=>typeof x==='string'?found.push(x):x?.url&&found.push(x.url));else if(image?.url)found.push(image.url);
      if(node['@graph'])visit(node['@graph']);
    };nodes.forEach(visit);
  }catch{}});
  return found.map(x=>absolute(x,baseUrl)).find(Boolean)||null;
}
async function resolveArticleImage(url){
  if(!url||!/^https?:/i.test(url))return null;
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
    const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; AI-Media-Network/1.6.3; +editorial-discovery)','Accept':'text/html,application/xhtml+xml'},redirect:'follow',signal:ctrl.signal});
    if(!r.ok)return null;const type=r.headers.get('content-type')||'';if(!type.includes('text/html')&&!type.includes('application/xhtml'))return null;
    const html=await r.text();const $=cheerio.load(html);const candidates=[
      $('meta[property="og:image:secure_url"]').attr('content'),$('meta[property="og:image"]').attr('content'),
      $('meta[name="twitter:image"]').attr('content'),$('meta[property="twitter:image"]').attr('content'),
      $('link[rel="image_src"]').attr('href'),firstImageFromJsonLd($,r.url||url)
    ].filter(Boolean);
    for(const c of candidates){const a=absolute(c,r.url||url);if(a&&/^https?:/i.test(a))return a}
    const articleImg=$('article img[src], main img[src]').filter((_,el)=>{const src=$(el).attr('src')||'';const alt=($(el).attr('alt')||'').toLowerCase();return src&&!/logo|icon|avatar|emoji|sprite/i.test(src+' '+alt)}).first().attr('src');
    return articleImg?absolute(articleImg,r.url||url):null;
  }catch{return null}finally{clearTimeout(timer)}
}
function rssImage(i){
  const candidates=[i.enclosure?.url,i['media:content']?.url,i['media:thumbnail']?.url,i.image?.url,i.image];
  return candidates.find(x=>typeof x==='string'&&/^https?:/i.test(x))||null;
}

function scoreCandidate(item,{topics,profiles,watches}){
  const hay=norm(`${item.title} ${item.excerpt||''}`); let score=.12; const matches=[];
  for(const t of topics){const terms=[t.name,...array(t.keywords)].map(norm).filter(Boolean);if(terms.some(x=>hay.includes(x))){score+=t.priority==='URGENT'?.34:t.priority==='HIGH'?.26:.16;matches.push(`Tema: ${t.name}`)}}
  for(const p of profiles){const terms=[p.name,...array(p.aliases)].map(norm).filter(Boolean);if(terms.some(x=>hay.includes(x))){score+=.18;matches.push(`Perfil: ${p.name}`)}}
  for(const w of watches){if(w.query&&hay.includes(norm(w.query))){score+=w.priority==='HIGH'?.24:.16;matches.push(`Monitoreo: ${w.name}`)}}
  if(item.publishedAt){const age=(Date.now()-new Date(item.publishedAt).getTime())/3600000;if(age<=6)score+=.22;else if(age<=24)score+=.16;else if(age<=72)score+=.07}
  return {score:Math.min(1,Number(score.toFixed(2))),matches:[...new Set(matches)]};
}

async function rssItems(source){
  const feed=await parser.parseURL(source.url);
  return (feed.items||[]).slice(0,60).map(i=>({sourceId:source.id,title:strip(i.title),url:i.link||i.guid,excerpt:strip(i.contentSnippet||i.content||i.summary||''),publishedAt:i.isoDate?new Date(i.isoDate):i.pubDate&& !Number.isNaN(Date.parse(i.pubDate))?new Date(i.pubDate):null,imageUrl:rssImage(i)})).filter(x=>x.title&&x.url);
}
async function htmlItems(source){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
  try{const r=await fetch(source.url,{headers:{'User-Agent':'AI-Media-Network/1.0 Editorial Discovery','Accept':'text/html,application/xhtml+xml'},signal:ctrl.signal});if(!r.ok)throw new Error(`HTTP_${r.status}`);const html=await r.text();const $=cheerio.load(html);const out=[];const seen=new Set();
    $('article a[href], main a[href], .view-content a[href], a[href]').each((_,el)=>{if(out.length>=100)return false;let title=strip($(el).text());if(title.length<24||title.length>220)return;let url;try{url=new URL($(el).attr('href'),source.url).href}catch{return}if(!/^https?:/.test(url))return;url=canonical(url);if(seen.has(url))return;seen.add(url);const parent=$(el).closest('article,li,.views-row,.card,.item');const excerpt=strip(parent.find('p').first().text()).slice(0,500)||null;const dateText=strip(parent.find('time').attr('datetime')||parent.find('time').text()||'');const publishedAt=dateText&&!Number.isNaN(Date.parse(dateText))?new Date(dateText):null;const rawImg=parent.find('img').first().attr('src')||parent.find('img').first().attr('data-src')||null;const imageUrl=rawImg?absolute(rawImg,source.url):null;out.push({sourceId:source.id,title,url,excerpt,publishedAt,imageUrl})});
    return out;
  }finally{clearTimeout(timer)}
}
async function fetchSource(source){if(!source.url)return[];if(source.type==='RSS')return rssItems(source);return htmlItems(source)}

async function runDiscovery(prisma,stateCode='NL',options={}){
  const state=await prisma.stateBrain.findFirst({where:{stateCode}});if(!state)throw new Error('STATE_NOT_FOUND');
  const [sources,topics,profiles,watches,thresholdSetting]=await Promise.all([
    prisma.source.findMany({where:{stateBrainId:state.id,isActive:true}}),prisma.topic.findMany({where:{stateBrainId:state.id,status:{in:['ACTIVE','WATCHING']}}}),prisma.profile.findMany({where:{stateBrainId:state.id}}),prisma.watch.findMany({where:{stateBrainId:state.id,isActive:true}}),prisma.appSetting.findUnique({where:{key:'discovery.relevanceThreshold'}})
  ]);
  const threshold=Number(options.threshold??thresholdSetting?.value??.55);const hours=Number(options.hours||6);
  const run=await prisma.discoveryRun.create({data:{stateBrainId:state.id,status:'RUNNING',startedAt:new Date(),periodStart:new Date(Date.now()-hours*3600000),periodEnd:new Date(),summary:{threshold,hours}}});
  let scanned=0,failures=0;const byKey=new Map();
  for(const source of sources){try{const items=await fetchSource(source);scanned+=items.length;for(const item of items){const key=hashTitle(item.title);const scored=scoreCandidate(item,{topics,profiles,watches});const candidate={...item,url:canonical(item.url),canonicalUrl:canonical(item.url),duplicateKey:key,relevanceScore:scored.score,metadata:{matches:scored.matches,sourceName:source.name,imageUrl:item.imageUrl||null,imageOrigin:item.imageUrl?'SOURCE_LISTING':null}};delete candidate.imageUrl;const prev=byKey.get(key);if(!prev||candidate.relevanceScore>prev.relevanceScore)byKey.set(key,candidate)}}catch(e){failures++;await prisma.systemError.create({data:{code:'DISCOVERY_SOURCE_ERROR',module:'DISCOVERY',message:`${source.name}: ${e.message}`,entityType:'SOURCE',entityId:source.id}})}}
  const recentKeys=new Set((await prisma.discoveryCandidate.findMany({where:{createdAt:{gte:new Date(Date.now()-7*86400000)}},select:{duplicateKey:true,canonicalUrl:true}})).flatMap(x=>[x.duplicateKey,x.canonicalUrl]).filter(Boolean));
  const candidates=[...byKey.values()].filter(c=>!recentKeys.has(c.duplicateKey)&&!recentKeys.has(c.canonicalUrl)).sort((a,b)=>b.relevanceScore-a.relevanceScore).slice(0,200);
  if(candidates.length)await prisma.discoveryCandidate.createMany({data:candidates.map(c=>({...c,discoveryRunId:run.id,status:c.relevanceScore>=threshold?'CANDIDATE':'LOW_RELEVANCE'}))});
  const candidateCount=candidates.filter(c=>c.relevanceScore>=threshold).length;
  const status=failures===sources.length&&sources.length?'FAILED':failures?'PARTIAL':'COMPLETED';
  const updated=await prisma.discoveryRun.update({where:{id:run.id},data:{status,finishedAt:new Date(),itemsScanned:scanned,candidatesFound:candidateCount,itemsDiscarded:candidates.length-candidateCount,summary:{threshold,hours,sources:sources.length,failures,totalUnique:candidates.length}}});
  await prisma.activityEvent.create({data:{type:'DISCOVERY_RUN',scope:stateCode,entityType:'DISCOVERY_RUN',entityId:run.id,title:`Corrida ${status.toLowerCase()} en ${state.name}`,detail:`${scanned} elementos analizados · ${candidateCount} candidatos`}});
  return updated;
}

async function candidateToStory(prisma,id){
  const c=await prisma.discoveryCandidate.findUnique({where:{id},include:{discoveryRun:true,source:true}});if(!c)throw new Error('CANDIDATE_NOT_FOUND');if(c.storyId)return prisma.story.findUnique({where:{id:c.storyId}});
  let imageUrl=c.metadata?.imageUrl||null,imageOrigin=c.metadata?.imageOrigin||null;
  if(!imageUrl){imageUrl=await resolveArticleImage(c.url);if(imageUrl)imageOrigin='ARTICLE_METADATA'}
  const imageInfo=imageUrl?{url:imageUrl,origin:imageOrigin||'ARTICLE_METADATA',sourceUrl:c.url,sourceName:c.source?.name||null,synthetic:false}:null;
  const story=await prisma.story.create({data:{stateBrainId:c.discoveryRun.stateBrainId,title:c.title,status:'DISCOVERED',priority:c.relevanceScore>=.85?'HIGH':'NORMAL',confidence:c.source?.trustScore>=.9?'HIGH':c.source?.trustScore>=.75?'MEDIUM':'LOW',summary:c.excerpt,generationContext:{discoveryCandidateId:c.id,matches:c.metadata?.matches||[],relevanceScore:c.relevanceScore,sourceImage:imageInfo,imagePolicy:'SOURCE_ONLY'},sources:c.sourceId?{create:{sourceId:c.sourceId,sourceUrl:c.url,sourceTitle:c.title,publishedAt:c.publishedAt,excerpt:c.excerpt,isPrimary:true,verification:imageInfo?{imageUrl:imageInfo.url,imageOrigin:imageInfo.origin,synthetic:false}:undefined}}:undefined}});
  await prisma.$transaction([prisma.discoveryCandidate.update({where:{id},data:{storyId:story.id,status:'PROMOTED',decisionReason:'Aprobado por operador'}}),prisma.discoveryRun.update({where:{id:c.discoveryRunId},data:{storiesCreated:{increment:1}}}),prisma.activityEvent.create({data:{type:'CANDIDATE_PROMOTED',entityType:'STORY',entityId:story.id,title:`Historia #${story.publicId} creada desde Descubrimiento`,detail:story.title,metadata:{sourceImage:imageInfo}}})]);
  return story;
}
module.exports={runDiscovery,candidateToStory,resolveArticleImage};
