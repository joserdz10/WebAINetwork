const { callAI } = require('./ai');

function textFromSources(story) {
  return (story.sources || []).map((s,i)=>`FUENTE ${i+1}: ${s.source?.name || ''}\nTítulo: ${s.sourceTitle || ''}\nURL: ${s.sourceUrl || ''}\nExtracto: ${s.excerpt || ''}`).join('\n\n');
}

function fallbackAnalysis(story) {
  const sourceNames = [...new Set((story.sources||[]).map(x=>x.source?.name).filter(Boolean))];
  const facts = (story.sources||[]).map(x=>x.sourceTitle).filter(Boolean).slice(0,6);
  return {
    summary: story.summary || story.title,
    context: `Historia detectada a partir de ${sourceNames.length || story.sources?.length || 0} fuente(s). Requiere revisión editorial antes de publicación.`,
    keyFacts: facts.length ? facts : [story.title],
    actors: [],
    timeline: [],
    contradictions: [],
    editorialRisks: sourceNames.length < 2 ? ['Confirmar con una segunda fuente independiente cuando sea posible.'] : [],
    sourceAssessment: { sourceCount: story.sources?.length || 0, assessment: sourceNames.length >= 2 ? 'MULTIPLE_SOURCES' : 'SINGLE_SOURCE', notes: [] },
    confidence: sourceNames.length >= 3 ? 'HIGH' : sourceNames.length >= 2 ? 'MEDIUM' : 'LOW',
    topicNames: [],
    profileNames: []
  };
}

async function analyzeStory(prisma, publicId) {
  const story = await prisma.story.findUnique({
    where:{publicId},
    include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}}}
  });
  if (!story) throw new Error('STORY_NOT_FOUND');
  await prisma.story.update({where:{id:story.id},data:{status:'ANALYZING'}});
  const topics = await prisma.topic.findMany({where:{stateBrainId:story.stateBrainId,status:{in:['ACTIVE','WATCHING']}}});
  const profiles = await prisma.profile.findMany({where:{stateBrainId:story.stateBrainId}});
  const schema = {
    name:'story_analysis',
    schema:{
      type:'object',additionalProperties:false,
      properties:{
        summary:{type:'string'},context:{type:'string'},
        keyFacts:{type:'array',items:{type:'string'}},actors:{type:'array',items:{type:'string'}},
        timeline:{type:'array',items:{type:'object',additionalProperties:false,properties:{date:{type:'string'},event:{type:'string'}},required:['date','event']}},
        contradictions:{type:'array',items:{type:'string'}},editorialRisks:{type:'array',items:{type:'string'}},
        sourceAssessment:{type:'object',additionalProperties:false,properties:{sourceCount:{type:'integer'},assessment:{type:'string'},notes:{type:'array',items:{type:'string'}}},required:['sourceCount','assessment','notes']},
        confidence:{type:'string',enum:['LOW','MEDIUM','HIGH']},
        topicNames:{type:'array',items:{type:'string'}},profileNames:{type:'array',items:{type:'string'}}
      },required:['summary','context','keyFacts','actors','timeline','contradictions','editorialRisks','sourceAssessment','confidence','topicNames','profileNames']
    }
  };
  let analysis;
  try {
    analysis = await callAI({
      system:`Eres el motor de inteligencia editorial de AI Media Network. Analiza hechos de manera factual y neutral. No inventes datos. Distingue hechos confirmados de afirmaciones. Para política y elecciones, nunca recomiendes, persuadas, califiques candidatos ni predigas resultados. Usa exclusivamente la información de las fuentes y contexto suministrados.`,
      input:`ESTADO: ${story.stateBrain.name}\nHISTORIA: ${story.title}\n\nFUENTES:\n${textFromSources(story)}\n\nTEMAS DISPONIBLES: ${topics.map(t=>t.name).join(', ')}\nPERFILES DISPONIBLES: ${profiles.map(p=>p.name).join(', ')}`,
      jsonSchema:schema
    });
  } catch (e) {
    console.error('AI analysis fallback:',e.message);
    analysis = fallbackAnalysis(story);
  }
  if (!analysis) analysis = fallbackAnalysis(story);

  const matchedTopics = topics.filter(t=>analysis.topicNames.some(n=>n.toLowerCase()===t.name.toLowerCase()));
  const matchedProfiles = profiles.filter(p=>analysis.profileNames.some(n=>n.toLowerCase()===p.name.toLowerCase()));
  await prisma.$transaction(async tx=>{
    await tx.story.update({where:{id:story.id},data:{
      summary:analysis.summary, context:analysis.context, keyFacts:analysis.keyFacts, actors:analysis.actors,
      timeline:analysis.timeline, contradictions:analysis.contradictions, editorialRisks:analysis.editorialRisks,
      sourceAssessment:analysis.sourceAssessment, confidence:analysis.confidence, status:'READY', readyAt:new Date(),
      generationContext:{analyzedAt:new Date().toISOString(),engine:process.env.OPENAI_API_KEY?'AI':'FALLBACK'}
    }});
    for(const t of matchedTopics) await tx.storyTopic.upsert({where:{storyId_topicId:{storyId:story.id,topicId:t.id}},create:{storyId:story.id,topicId:t.id},update:{}});
    for(const p of matchedProfiles) await tx.storyProfile.upsert({where:{storyId_profileId:{storyId:story.id,profileId:p.id}},create:{storyId:story.id,profileId:p.id},update:{}});
    await tx.activityEvent.create({data:{type:'STORY_ANALYZED',scope:story.stateBrain.stateCode,entityType:'STORY',entityId:story.id,title:`Historia #${publicId} analizada`,detail:story.title}});
  });
  return prisma.story.findUnique({where:{id:story.id},include:{sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}}}});
}

module.exports={analyzeStory};
