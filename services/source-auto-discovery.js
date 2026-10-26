const dns=require('node:dns').promises;
const net=require('node:net');
const cheerio=require('cheerio');
const {sourceKey,sourceHost}=require('./source-recommendations');
function privateIP(ip){
 if(net.isIP(ip)===4){const p=ip.split('.').map(Number);return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===198&&(p[1]===18||p[1]===19))||(p[0]===198&&p[1]===51&&p[2]===100)||(p[0]===203&&p[1]===0&&p[2]===113)}
 if(net.isIP(ip)===6){const s=ip.toLowerCase();return s.includes('.')||s==='::'||s==='::1'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe')||s.startsWith('ff')||s.startsWith('2001:db8:')}
 return true;
}
async function safeWebsite(raw){
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.'))throw new Error('URL_NOT_ALLOWED');
 const host=u.hostname.toLowerCase();
 if(net.isIP(host)||host.endsWith('.local')||host.endsWith('.localhost')||host.endsWith('.internal'))throw new Error('HOST_NOT_ALLOWED');
 const ips=await dns.lookup(host,{all:true});
 if(!ips.length||ips.some(x=>privateIP(x.address)))throw new Error('IP_NOT_ALLOWED');
 return u;
}
function parseCandidates(text){
 const raw=String(text||'');
 const begin=raw.indexOf('{'),end=raw.lastIndexOf('}');
 if(begin<0||end<begin)throw new Error('AI_INVALID_JSON');
 const data=JSON.parse(raw.slice(begin,end+1));
 if(!Array.isArray(data.sources))throw new Error('AI_INVALID_SOURCES');
 return data.sources.slice(0,20).filter(x=>x&&typeof x.name==='string'&&typeof x.url==='string');
}
async function searchStateSources(stateName){
 if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY_REQUIRED');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),90000);
 try{
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:ctrl.signal,headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.OPENAI_SOURCE_MODEL||process.env.OPENAI_MODEL||'gpt-5-mini',tools:[{type:'web_search',search_context_size:'medium'}],
    instructions:'Investiga sitios web oficiales de medios noticiosos de un estado de México mediante búsqueda web actual. No inventes dominios, evita redes sociales y artículos individuales. Responde solo JSON: {"sources":[{"name":"Medio","url":"https://dominio.tld/","region":"municipio o estatal"}]}. Hasta 18 fuentes, diversas regiones. Las URLs deben ser dominios originales de los medios.',
    input:'Buscar sitios oficiales de medios de noticias regionales y estatales en '+stateName+', México.'})});
  if(!r.ok){
   let apiError={};try{apiError=await r.json()}catch{}
   const code=String(apiError.error?.code||apiError.error?.type||'');
   const quota=/insufficient_quota|billing|payment/i.test(code+' '+String(apiError.error?.message||''));
   const limit=r.status===429;
   const err=new Error(quota
    ?'OpenAI API no tiene cuota disponible. Revisa la facturación y los límites del proyecto en platform.openai.com.'
    :limit
     ?'OpenAI API alcanzó su límite temporal de solicitudes. Revisa los límites de uso del proyecto e inténtalo más tarde.'
     :'OpenAI API rechazó la búsqueda (HTTP '+r.status+'). Revisa el modelo y los permisos de la API.');
   err.code=quota?'OPENAI_INSUFFICIENT_QUOTA':limit?'OPENAI_RATE_LIMIT':'SOURCE_SEARCH_'+r.status;
   err.status=quota?429:limit?429:502;
   throw err;
  }
  const data=await r.json();
  const text=data.output_text||data.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');
  if(!text)throw new Error('SOURCE_SEARCH_EMPTY');
  return parseCandidates(text);
 }finally{clearTimeout(timer)}
}
async function verifySite(raw){
 let u=await safeWebsite(raw);
 for(let redirects=0;redirects<3;redirects++){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
  try{
   const r=await fetch(u.href,{redirect:'manual',signal:ctrl.signal,headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'AI-Media-Network/1.8 Source Verification'}});
   if([301,302,303,307,308].includes(r.status)){
    const loc=r.headers.get('location');if(!loc)throw new Error('INVALID_REDIRECT');
    u=await safeWebsite(new URL(loc,u).href);continue;
   }
   if(!r.ok)throw new Error('HTTP_'+r.status);
   if(!/html/i.test(r.headers.get('content-type')||''))throw new Error('NOT_HTML');
   const html=(await r.text()).slice(0,250000),$=cheerio.load(html);
   const title=($('title').first().text()||$('meta[property="og:site_name"]').attr('content')||'').trim();
   if(!title||!$('a[href]').length)throw new Error('NO_EDITORIAL_HTML');
   const feed=$('link[rel="alternate"][type*="rss"],link[rel="alternate"][type*="atom"]').first().attr('href');
   let rssUrl=null;
   if(feed)try{const f=new URL(feed,u);if(f.hostname===u.hostname&&f.protocol==='https:')rssUrl=f.href}catch{}
   return {finalUrl:u.origin+'/',title:title.slice(0,120),rssUrl};
  }finally{clearTimeout(timer)}
 }
 throw new Error('TOO_MANY_REDIRECTS');
}
async function discoverStateSources(prisma,stateCode,{search=searchStateSources,verify=verifySite}={}){
 const state=await prisma.stateBrain.findFirst({where:{stateCode}});
 if(!state)throw new Error('STATE_NOT_FOUND');
 const candidates=await search(state.name),existing=await prisma.source.findMany({where:{stateBrainId:state.id},select:{url:true,domain:true}});
 const seen=new Set(existing.map(sourceKey).filter(Boolean));
 const report={stateCode,found:candidates.length,added:[],skipped:[],rejected:[]};
 for(const candidate of candidates){
  const host=sourceHost(candidate.url);
  if(!host||seen.has(host)){report.skipped.push({name:candidate.name,reason:host?'EXISTS':'BAD_URL'});continue}
  try{
   const check=await verify(candidate.url),finalHost=sourceHost(check.finalUrl);
   if(!finalHost||seen.has(finalHost)){report.skipped.push({name:candidate.name,reason:'EXISTS'});continue}
   const row=await prisma.source.create({data:{stateBrainId:state.id,name:candidate.name.trim().slice(0,160),type:'WEBSITE',url:check.finalUrl,domain:finalHost,isActive:false,trustScore:null,
    configuration:{origin:'AI_WEB_DISCOVERY',verification:'REVIEW_PENDING',checkedAt:new Date().toISOString(),region:String(candidate.region||'Estatal').slice(0,100),rssCandidate:check.rssUrl||null,siteTitle:check.title}}});
   seen.add(host);seen.add(finalHost);report.added.push({id:row.id,name:row.name,url:row.url});
  }catch(e){report.rejected.push({name:candidate.name,reason:String(e.message||e).slice(0,100)})}
 }
 return report;
}
module.exports={privateIP,safeWebsite,parseCandidates,verifySite,discoverStateSources};
