const crypto=require('node:crypto');
const {safeWebsite}=require('./source-auto-discovery');
function normalize(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim()}
function validateSearch(body){
 const kind=String(body.type||'PROFILE').toUpperCase(),query=String(body.query||'').trim();
 const hours=Number(body.hours||168),scope=String(body.scope||'').toUpperCase();
 if(!['PROFILE','TOPIC','EVENT'].includes(kind))throw Object.assign(new Error('Tipo de búsqueda inválido.'),{status:400});
 if(query.length<3||query.length>120)throw Object.assign(new Error('Escribe una consulta de 3 a 120 caracteres.'),{status:400});
 if(![24,168,720].includes(hours))throw Object.assign(new Error('Periodo inválido.'),{status:400});
 if(!/^(MX|[A-Z]{2,8})$/.test(scope))throw Object.assign(new Error('Estado inválido.'),{status:400});
 return {type:kind,query,hours,scope,web:body.web===true};
}
function matchText(item,query){const terms=normalize(query).split(' ').filter(x=>x.length>=3);const hay=normalize(item.title+' '+(item.excerpt||''));return terms.length>0&&terms.every(x=>hay.includes(x))}
function parseWebSources(raw){
 const start=String(raw||'').indexOf('{'),end=String(raw||'').lastIndexOf('}');
 if(start<0||end<=start)throw new Error('WEB_SEARCH_INVALID_RESPONSE');
 const data=JSON.parse(raw.slice(start,end+1));
 return (Array.isArray(data.results)?data.results:[]).slice(0,15).filter(x=>x&&typeof x.title==='string'&&typeof x.url==='string'&&x.title.trim().length>12);
}
async function webLookup({query,type,scopeName,hours}){
 if(!process.env.OPENAI_API_KEY)throw Object.assign(new Error('La búsqueda web necesita OPENAI_API_KEY configurada.'),{status:503});
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),70000);
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:ctrl.signal,headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_SOURCE_MODEL||process.env.OPENAI_MODEL||'gpt-5-mini',tools:[{type:'web_search',search_context_size:'medium'}],
    instructions:'Investiga noticias periodísticas reales con búsqueda web. Devuelve exclusivamente JSON {"results":[{"title":"Titular textual","url":"https://...","excerpt":"Resumen breve","sourceName":"Medio","publishedAt":"ISO fecha o null"}]}. Solo URLs de artículos reales, no homepages ni URLs inventadas. Si no hay confirmación, devuelve results vacío. No atribuyas noticias sin evidencia. Máximo 12.',
    input:'Buscar noticias concretas de los últimos '+hours+' horas sobre '+type+': '+query+'. Cobertura: '+scopeName+', México.'})});
  if(!response.ok){
   let details={};try{details=await response.json()}catch{}
   const quota=JSON.stringify(details).includes('insufficient_quota');
   throw Object.assign(new Error(response.status===429?(quota?'La cuenta OpenAI API no tiene cuota disponible.':'Límite temporal de OpenAI API. La búsqueda local sigue disponible.'):'OpenAI API rechazó la búsqueda web (HTTP '+response.status+').'),{status:response.status===429?429:502});
  }
  const data=await response.json(),raw=data.output_text||data.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  return parseWebSources(raw);
 }finally{clearTimeout(timer)}
}
async function specializedSearch(prisma,input,{searchWeb=webLookup}={}){
 const opt=validateSearch(input),where=opt.scope==='MX'?{}:{stateCode:opt.scope};
 const state=opt.scope==='MX'?null:await prisma.stateBrain.findFirst({where});
 if(opt.scope!=='MX'&&!state)throw Object.assign(new Error('Estado no registrado.'),{status:404});
 const since=new Date(Date.now()-opt.hours*3600000);
 const local=await prisma.discoveryCandidate.findMany({
  where:{discoveryRun:{stateBrain:opt.scope==='MX'?{}:{stateCode:opt.scope}},createdAt:{gte:since},status:{in:['CANDIDATE','LOW_RELEVANCE','PROMOTED']}},
  include:{source:true,discoveryRun:{include:{stateBrain:{select:{name:true,stateCode:true}}}}},orderBy:{createdAt:'desc'},take:500
 });
 const matched=local.filter(x=>matchText(x,opt.query)).slice(0,100);
 const results=matched.map(x=>({id:x.id,title:x.title,url:x.url,excerpt:x.excerpt||'',origin:'LOCAL',status:x.status,sourceName:x.source?.name||(function(){try{return new URL(x.url).hostname}catch{return 'Fuente no identificada'}})(),stateCode:x.discoveryRun.stateBrain.stateCode,publishedAt:x.publishedAt,score:x.relevanceScore}));
 let webError=null,webCount=0;
 if(opt.web){
  try{
   const web=await searchWeb({query:opt.query,type:opt.type,scopeName:state?.name||'México',hours:opt.hours});
   const known=new Set(results.map(x=>x.url));
   for(const item of web){
    try{
     const url=new URL(item.url);await safeWebsite(url.href);
     url.hash='';url.searchParams.delete('fbclid');
     if(known.has(url.href))continue;
     known.add(url.href);
     results.push({id:null,title:item.title.slice(0,220),url:url.href,excerpt:String(item.excerpt||'').slice(0,500),origin:'WEB_UNVERIFIED',status:'REVIEW_REQUIRED',sourceName:String(item.sourceName||url.hostname).slice(0,100),stateCode:opt.scope,publishedAt:item.publishedAt||null,score:null});
     webCount++;
    }catch{}
   }
  }catch(e){webError=e.message}
 }
 return {query:opt.query,type:opt.type,scope:opt.scope,hours:opt.hours,localCount:matched.length,webCount,webError,results};
}
module.exports={validateSearch,matchText,parseWebSources,specializedSearch};
