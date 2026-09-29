const { callAI, generateImage } = require('./ai');

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
  const facts=Array.isArray(story.keyFacts)?story.keyFacts:[];
  const headline=story.title;
  const core=[story.summary||story.title,...facts.slice(0,3)].filter(Boolean).join('\n\n');
  if(type==='X_POST') return {headline,copy:(story.summary||headline).slice(0,270),body:null,imagePrompt:null};
  if(type.includes('STORY')) return {headline:headline.slice(0,90),copy:facts.slice(0,2).join(' · ')||story.summary,body:null,imagePrompt:`Diseño editorial informativo para ${identity.name}, tema: ${headline}. Sin texto inventado.`};
  if(type==='INSTAGRAM_REEL'||type==='TIKTOK') return {headline,copy:null,body:`GANCHO: ${headline}\n\nCONTEXTO: ${story.summary||''}\n\nDATOS CLAVE:\n${facts.map(x=>`- ${x}`).join('\n')}\n\nCIERRE: Información en desarrollo; consulta las fuentes citadas.`,imagePrompt:null};
  return {headline,copy:core,body:type==='ARTICLE'?`${story.context||''}\n\n${facts.map(x=>`• ${x}`).join('\n')}`:null,imagePrompt:`Imagen editorial periodística sobre: ${headline}. Estilo de ${identity.name}. No representar hechos no confirmados.`};
}

async function generatePiece(prisma,{publicId,identityId,type}){
  if(!FORMAT_RULES[type]) throw new Error('INVALID_CONTENT_TYPE');
  const story=await prisma.story.findUnique({where:{publicId},include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}}}});
  if(!story) throw new Error('STORY_NOT_FOUND');
  const identity=await prisma.mediaIdentity.findUnique({where:{id:identityId},include:{mediaDNA:true}});
  if(!identity) throw new Error('IDENTITY_NOT_FOUND');
  const dna=identity.mediaDNA||{};
  const schema={name:'content_piece',schema:{type:'object',additionalProperties:false,properties:{headline:{type:'string'},copy:{type:['string','null']},body:{type:['string','null']},imagePrompt:{type:['string','null']}},required:['headline','copy','body','imagePrompt']}};
  let generated;
  try{
    generated=await callAI({
      system:`Eres el estudio editorial de AI Media Network. Redacta contenido periodístico factual, claro y verificable. No inventes hechos, cifras o citas. Si el tema es político/electoral, mantén neutralidad informativa: no persuadas, no recomiendes opciones políticas, no clasifiques candidatos y no predigas elecciones. Respeta el ADN editorial sin sacrificar exactitud.`,
      input:`IDENTIDAD: ${identity.name}\nTONO: ${dna.tone||'informativo'}\nESTILO: ${dna.editorialStyle||'periodístico'}\nENFOQUE: ${dna.geographicFocus||story.stateBrain.name}\nREGLAS A EVITAR: ${JSON.stringify(dna.avoidRules||[])}\nFORMATO: ${type}\nREGLA DE FORMATO: ${FORMAT_RULES[type]}\n\nHISTORIA: ${story.title}\nRESUMEN: ${story.summary||''}\nCONTEXTO: ${story.context||''}\nDATOS CLAVE: ${JSON.stringify(story.keyFacts||[])}\nRIESGOS: ${JSON.stringify(story.editorialRisks||[])}\nFUENTES: ${(story.sources||[]).map(x=>`${x.source?.name}: ${x.sourceUrl||''}`).join('\n')}`,
      jsonSchema:schema
    });
  }catch(e){console.error('AI generation fallback:',e.message);generated=null}
  if(!generated) generated=fallbackPiece(story,type,identity);
  const last=await prisma.contentPiece.findFirst({where:{storyId:story.id,mediaIdentityId:identity.id,type},orderBy:{version:'desc'}});
  const piece=await prisma.contentPiece.create({data:{storyId:story.id,mediaIdentityId:identity.id,type,status:'GENERATED',version:(last?.version||0)+1,headline:generated.headline,copy:generated.copy,body:generated.body,generationPrompt:generated.imagePrompt,metadata:{engine:process.env.OPENAI_API_KEY?'AI':'FALLBACK',createdFromStoryVersion:story.updatedAt.toISOString()}}});
  await prisma.story.update({where:{id:story.id},data:{status:'CONTENT_READY'}});
  await prisma.activityEvent.create({data:{type:'CONTENT_GENERATED',scope:story.stateBrain.stateCode,entityType:'CONTENT_PIECE',entityId:piece.id,title:`${type} generado para ${identity.name}`,detail:story.title}});
  return piece;
}

async function generatePieces(prisma,args){
  const results=[];
  for(const type of args.types||[]) results.push(await generatePiece(prisma,{...args,type}));
  return results;
}

async function generatePieceImage(prisma,id){
  const piece=await prisma.contentPiece.findUnique({where:{id},include:{story:true,mediaIdentity:{include:{mediaDNA:true}}}});
  if(!piece) throw new Error('CONTENT_PIECE_NOT_FOUND');
  const prompt=piece.generationPrompt||`Imagen editorial periodística para ${piece.mediaIdentity.name} sobre ${piece.story.title}. Neutral, factual, sin texto.`;
  const imageUrl=await generateImage(prompt);
  if(!imageUrl) throw new Error('IMAGE_AI_NOT_CONFIGURED');
  return prisma.contentPiece.update({where:{id},data:{imageUrl}});
}
module.exports={generatePiece,generatePieces,generatePieceImage,FORMAT_RULES};
