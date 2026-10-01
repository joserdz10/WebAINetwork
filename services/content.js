const { callAI } = require('./ai');
const { selectTemplate, renderTemplate } = require('./template-engine');
const { resolveArticleImage } = require('./discovery');

const FORMAT_RULES={
  FACEBOOK_POST:'Post de Facebook: titular claro, copy informativo de 2 a 5 párrafos cortos y cierre sin clickbait.',
  FACEBOOK_STORY:'Historia de Facebook: titular de máximo 12 palabras, texto breve y directo, pensado para 9:16.',
  INSTAGRAM_POST:'Post de Instagram: copy legible, contexto suficiente, hashtags mínimos y relevantes.',
  INSTAGRAM_STORY:'Historia de Instagram: titular breve, máximo 3 bloques de texto, pensado para 9:16.',
  INSTAGRAM_REEL:'Reel: guion de 25 a 45 segundos con gancho factual, desarrollo, datos clave y cierre.',
  X_POST:'Post de X: conciso y factual, dentro de 280 caracteres si es posible.',
  TIKTOK:'TikTok: guion vertical de 25 a 45 segundos con lenguaje natural y factual.',
  ARTICLE:'Artículo web: titular, bajada y cuerpo estructurado; atribuye fuentes y no inventes citas.',
  EDITORIAL_GRAPHIC:'Gráfico editorial: titular corto, subtítulo y 3 datos clave.'
};

function fallbackPiece(story,type,identity){
  const facts=Array.isArray(story.keyFacts)?story.keyFacts:[];const headline=story.title;const core=[story.summary||story.title,...facts.slice(0,3)].filter(Boolean).join('\n\n');
  if(type==='X_POST') return {headline,copy:(story.summary||headline).slice(0,270),body:null,imagePrompt:null};
  if(type.includes('STORY')) return {headline:headline.slice(0,90),copy:facts.slice(0,2).join(' · ')||story.summary,body:null,imagePrompt:null};
  if(type==='INSTAGRAM_REEL'||type==='TIKTOK') return {headline,copy:null,body:`GANCHO: ${headline}\n\nCONTEXTO: ${story.summary||''}\n\nDATOS CLAVE:\n${facts.map(x=>`- ${x}`).join('\n')}\n\nCIERRE: Información en desarrollo; consulta las fuentes citadas.`,imagePrompt:null};
  return {headline,copy:core,body:type==='ARTICLE'?`${story.context||''}\n\n${facts.map(x=>`• ${x}`).join('\n')}`:null,imagePrompt:null};
}

async function generatePiece(prisma,{publicId,identityId,type}){
  if(!FORMAT_RULES[type]) throw new Error('INVALID_CONTENT_TYPE');
  const story=await prisma.story.findUnique({where:{publicId},include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}}}});if(!story) throw new Error('STORY_NOT_FOUND');
  const identity=await prisma.mediaIdentity.findUnique({where:{id:identityId},include:{mediaDNA:true,visualDNA:true}});if(!identity) throw new Error('IDENTITY_NOT_FOUND');
  const dna=identity.mediaDNA||{};const schema={name:'content_piece',schema:{type:'object',additionalProperties:false,properties:{headline:{type:'string'},copy:{type:['string','null']},body:{type:['string','null']},imagePrompt:{type:['string','null']}},required:['headline','copy','body','imagePrompt']}};let generated;
  try{generated=await callAI({system:`Eres el estudio editorial de AI Media Network. Redacta contenido periodístico factual, claro y verificable. No inventes hechos, cifras o citas. Si el tema es político/electoral, mantén neutralidad informativa: no persuadas, no recomiendes opciones políticas, no clasifiques candidatos y no predigas elecciones. Respeta el ADN editorial sin sacrificar exactitud.`,input:`IDENTIDAD: ${identity.name}\nTONO: ${dna.tone||'informativo'}\nESTILO: ${dna.editorialStyle||'periodístico'}\nENFOQUE: ${dna.geographicFocus||story.stateBrain.name}\nREGLAS A EVITAR: ${JSON.stringify(dna.avoidRules||[])}\nFORMATO: ${type}\nREGLA DE FORMATO: ${FORMAT_RULES[type]}\n\nHISTORIA: ${story.title}\nRESUMEN: ${story.summary||''}\nCONTEXTO: ${story.context||''}\nDATOS CLAVE: ${JSON.stringify(story.keyFacts||[])}\nRIESGOS: ${JSON.stringify(story.editorialRisks||[])}\nFUENTES: ${(story.sources||[]).map(x=>`${x.source?.name}: ${x.sourceUrl||''}`).join('\n')}`,jsonSchema:schema})}catch(e){console.error('AI generation fallback:',e.message);generated=null}
  if(!generated) generated=fallbackPiece(story,type,identity);
  const last=await prisma.contentPiece.findFirst({where:{storyId:story.id,mediaIdentityId:identity.id,type},orderBy:{version:'desc'}});
  const sourceImage=story.generationContext?.sourceImage||null;
  const piece=await prisma.contentPiece.create({data:{storyId:story.id,mediaIdentityId:identity.id,type,status:'GENERATED',version:(last?.version||0)+1,headline:generated.headline,copy:generated.copy,body:generated.body,generationPrompt:null,metadata:{engine:process.env.OPENAI_API_KEY?'AI':'FALLBACK',createdFromStoryVersion:story.updatedAt.toISOString(),imagePolicy:'SOURCE_ONLY',sourceImage:sourceImage||null,syntheticImage:false}}});
  await prisma.story.update({where:{id:story.id},data:{status:'CONTENT_READY'}});await prisma.activityEvent.create({data:{type:'CONTENT_GENERATED',scope:story.stateBrain.stateCode,entityType:'CONTENT_PIECE',entityId:piece.id,title:`${type} generado para ${identity.name}`,detail:story.title}});return piece;
}
async function generatePieces(prisma,args){const results=[];for(const type of args.types||[]) results.push(await generatePiece(prisma,{...args,type}));return results}

async function realSourceImages(story){
  const out=[],seen=new Set();const add=x=>{if(!x?.url||seen.has(x.url))return;seen.add(x.url);out.push({...x,synthetic:false})};
  const gc=story.generationContext||{};add(gc.sourceImage);
  for(const link of story.sources||[]){
    if(link.verification?.imageUrl)add({url:link.verification.imageUrl,origin:link.verification.imageOrigin||'SOURCE_VERIFICATION',sourceUrl:link.sourceUrl,sourceName:link.source?.name||null});
    if(link.sourceUrl){const url=await resolveArticleImage(link.sourceUrl);if(url)add({url,origin:'ARTICLE_METADATA',sourceUrl:link.sourceUrl,sourceName:link.source?.name||null})}
  }
  return out;
}
async function generatePieceImage(prisma,id){
  const piece=await prisma.contentPiece.findUnique({where:{id},include:{story:{include:{sources:{include:{source:true}},topics:{include:{topic:true}}}},mediaIdentity:{include:{mediaDNA:true,visualDNA:true,templates:true}}}});if(!piece) throw new Error('CONTENT_PIECE_NOT_FOUND');
  const template=selectTemplate(piece.mediaIdentity,piece.type,piece.mediaIdentity.templates||[]);const candidates=await realSourceImages(piece.story);
  if(!candidates.length){
    const metadata={...(piece.metadata&&typeof piece.metadata==='object'?piece.metadata:{}),imagePolicy:'SOURCE_ONLY',syntheticImage:false,imageStatus:'NO_REAL_SOURCE_IMAGE',templateCode:template?.code||null,generatedAt:new Date().toISOString()};
    await prisma.contentPiece.update({where:{id},data:{metadata}});throw new Error('REAL_SOURCE_IMAGE_NOT_FOUND: La fuente no publicó una fotografía utilizable. El sistema no generará una foto falsa para una noticia real.');
  }
  let imageUrl=null,templateCode=null,used=null,lastError=null;
  for(const realImage of candidates){
    try{
      if(template){const rendered=await renderTemplate(template,{photo:realImage.url,headline:piece.headline||piece.story.title,category:piece.story.topics?.[0]?.topic?.name||'ACTUALIDAD',summary:piece.story.summary||piece.copy||'Información en desarrollo.',source:piece.story.sources?.[0]?.source?.name||realImage.sourceName||'Fuente original'});imageUrl=`data:image/png;base64,${rendered.toString('base64')}`;templateCode=template.code}
      else imageUrl=realImage.url;
      used=realImage;break;
    }catch(e){lastError=e;console.warn('Source image rejected:',realImage.url,e.message)}
  }
  if(!imageUrl||!used){
    const metadata={...(piece.metadata&&typeof piece.metadata==='object'?piece.metadata:{}),imagePolicy:'SOURCE_ONLY',syntheticImage:false,imageStatus:'SOURCE_IMAGE_UNUSABLE',templateCode:template?.code||null,generatedAt:new Date().toISOString()};
    await prisma.contentPiece.update({where:{id},data:{metadata}});throw new Error(`REAL_SOURCE_IMAGE_UNUSABLE: Encontré imagen de fuente, pero no pude utilizarla${lastError?` (${lastError.message})`:''}. No se generará una sustitución sintética.`);
  }
  const metadata={...(piece.metadata&&typeof piece.metadata==='object'?piece.metadata:{}),visualEngine:'TEMPLATE_ENGINE_1.6.3',templateCode,imagePolicy:'SOURCE_ONLY',imageStatus:'SOURCE_IMAGE_RENDERED',sourceImageUrl:used.url,sourceImageOrigin:used.origin,sourceImageSourceUrl:used.sourceUrl||null,syntheticImage:false,generatedAt:new Date().toISOString()};
  await prisma.story.update({where:{id:piece.story.id},data:{generationContext:{...(piece.story.generationContext||{}),sourceImage:used,imagePolicy:'SOURCE_ONLY'}}}).catch(()=>{});
  return prisma.contentPiece.update({where:{id},data:{imageUrl,metadata}});
}
module.exports={generatePiece,generatePieces,generatePieceImage,FORMAT_RULES};
