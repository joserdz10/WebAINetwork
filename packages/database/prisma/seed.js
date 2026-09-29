const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDatabase() {
  const mx = await prisma.country.upsert({
    where: { code: 'MX' },
    update: { name: 'México', isActive: true },
    create: { code: 'MX', name: 'México', isActive: true }
  });

  const nl = await prisma.stateBrain.upsert({
    where: { slug: 'nuevo-leon' },
    update: { name: 'Nuevo León', stateCode: 'NL', status: 'ACTIVE' },
    create: { countryId: mx.id, slug: 'nuevo-leon', name: 'Nuevo León', stateCode: 'NL', status: 'ACTIVE', description: 'Cerebro estatal inicial de AI Media Network.' }
  });
  const hgo = await prisma.stateBrain.upsert({
    where: { slug: 'hidalgo' },
    update: { name: 'Hidalgo', stateCode: 'HGO', status: 'DRAFT' },
    create: { countryId: mx.id, slug: 'hidalgo', name: 'Hidalgo', stateCode: 'HGO', status: 'DRAFT' }
  });
  const col = await prisma.stateBrain.upsert({
    where: { slug: 'colima' },
    update: { name: 'Colima', stateCode: 'COL', status: 'DRAFT' },
    create: { countryId: mx.id, slug: 'colima', name: 'Colima', stateCode: 'COL', status: 'DRAFT' }
  });

  const identities = [
    ['norte-en-alerta','Norte En Alerta','NEA','ACTIVE','Generalista · Nuevo León'],
    ['codigo-regio','Código Regio','CR','ACTIVE','Ciudad y seguridad'],
    ['punto-norte','Punto Norte','PN','ACTIVE','Información local'],
    ['circulo-politico-nl','Círculo Político NL','CPNL','ACTIVE','Política estatal']
  ];
  const identityMap = {};
  for (const [slug,name,code,status,description] of identities) {
    const row = await prisma.mediaIdentity.upsert({
      where: { slug },
      update: { name, code, status, description },
      create: { stateBrainId: nl.id, slug, name, code, status, description }
    });
    identityMap[slug] = row;
  }

  const independent = await prisma.mediaIdentity.upsert({
    where: { slug: 'el-independiente-hgo' },
    update: { name: 'El Independiente HGO', code: 'EIH', status: 'ACTIVE', description: 'Identidad Hidalgo' },
    create: { stateBrainId: hgo.id, slug: 'el-independiente-hgo', name: 'El Independiente HGO', code: 'EIH', status: 'ACTIVE', description: 'Identidad Hidalgo' }
  });
  await prisma.mediaIdentity.upsert({
    where: { slug: 'colima-identidad-pendiente' },
    update: { name: 'Colima — identidad pendiente', status: 'DRAFT' },
    create: { stateBrainId: col.id, slug: 'colima-identidad-pendiente', name: 'Colima — identidad pendiente', status: 'DRAFT' }
  });

  await prisma.mediaDNA.upsert({
    where: { mediaIdentityId: identityMap['norte-en-alerta'].id },
    update: {
      tone: 'Directo e informativo', editorialStyle: 'Periodístico local, ágil y verificable', geographicFocus: 'Nuevo León',
      headlineStyle: 'Corto, claro y de alto impacto informativo', politicalTone: 'Neutral', audience: 'Audiencia general de Nuevo León', language: 'es-MX',
      avoidRules: ['Clickbait excesivo','Afirmaciones no verificadas','Lenguaje partidista'],
      preferredFormats: ['FACEBOOK_POST','INSTAGRAM_POST','INSTAGRAM_STORY','INSTAGRAM_REEL','ARTICLE']
    },
    create: {
      mediaIdentityId: identityMap['norte-en-alerta'].id,
      tone: 'Directo e informativo', editorialStyle: 'Periodístico local, ágil y verificable', geographicFocus: 'Nuevo León',
      headlineStyle: 'Corto, claro y de alto impacto informativo', politicalTone: 'Neutral', audience: 'Audiencia general de Nuevo León', language: 'es-MX',
      avoidRules: ['Clickbait excesivo','Afirmaciones no verificadas','Lenguaje partidista'],
      preferredFormats: ['FACEBOOK_POST','INSTAGRAM_POST','INSTAGRAM_STORY','INSTAGRAM_REEL','ARTICLE']
    }
  });

  const topicDefs = [
    ['proceso-electoral-nl-2026-2027','Proceso Electoral NL 2026-2027','HIGH'],
    ['agua','Agua','HIGH'],
    ['metro-linea-6-gonzalitos','Metro Línea 6 / Gonzalitos','HIGH'],
    ['seguridad','Seguridad','NORMAL']
  ];
  const topicMap = {};
  for (const [slug,name,priority] of topicDefs) {
    topicMap[slug] = await prisma.topic.upsert({
      where: { stateBrainId_slug: { stateBrainId: nl.id, slug } },
      update: { name, priority, status: 'WATCHING' },
      create: { stateBrainId: nl.id, slug, name, priority, status: 'WATCHING' }
    });
  }

  const profileDefs = [
    ['samuel-garcia','Samuel García','PUBLIC_FIGURE'],
    ['mariana-rodriguez','Mariana Rodríguez','PUBLIC_FIGURE'],
    ['gobierno-nuevo-leon','Gobierno de Nuevo León','ORGANIZATION'],
    ['metrorrey','Metrorrey','ORGANIZATION']
  ];
  const profileMap = {};
  for (const [slug,name,type] of profileDefs) {
    profileMap[slug] = await prisma.profile.upsert({
      where: { stateBrainId_slug: { stateBrainId: nl.id, slug } },
      update: { name, type },
      create: { stateBrainId: nl.id, slug, name, type }
    });
  }

  const watchDefs = [
    ['Samuel García','PROFILE','samuel garcia','HIGH'],
    ['Proceso Electoral NL','TOPIC','proceso electoral nuevo leon','HIGH'],
    ['Agua Nuevo León','TOPIC','agua nuevo leon','HIGH'],
    ['Línea 6','TOPIC','linea 6 gonzalitos','HIGH']
  ];
  for (const [name,type,query,priority] of watchDefs) {
    const existing = await prisma.watch.findFirst({ where: { stateBrainId: nl.id, name } });
    if (existing) {
      await prisma.watch.update({ where: { id: existing.id }, data: { type, query, priority, isActive: true } });
    } else {
      await prisma.watch.create({ data: { stateBrainId: nl.id, name, type, query, priority, isActive: true } });
    }
  }

  const sourceDefs = [
    ['Gobierno de Nuevo León','GOVERNMENT','https://www.nl.gob.mx','nl.gob.mx',0.95],
    ['Congreso de Nuevo León','GOVERNMENT','https://www.hcnl.gob.mx','hcnl.gob.mx',0.95],
    ['Milenio Monterrey','MEDIA','https://www.milenio.com/politica/comunidad','milenio.com',0.80],
    ['ABC Noticias','MEDIA','https://abcnoticias.mx','abcnoticias.mx',0.78]
  ];
  const sourceMap = {};
  for (const [name,type,url,domain,trustScore] of sourceDefs) {
    let src = await prisma.source.findFirst({ where: { stateBrainId: nl.id, name } });
    if (src) src = await prisma.source.update({ where: { id: src.id }, data: { type, url, domain, trustScore, isActive: true } });
    else src = await prisma.source.create({ data: { stateBrainId: nl.id, name, type, url, domain, trustScore, isActive: true } });
    sourceMap[name] = src;
  }

  const storyDefs = [
    {
      title: 'Congreso de Nuevo León discute nuevo paquete de movilidad', status:'READY', priority:'URGENT', confidence:'HIGH',
      summary:'El Congreso estatal analiza un paquete relacionado con movilidad y transporte.', topic:'proceso-electoral-nl-2026-2027', sourceNames:['Congreso de Nuevo León','Milenio Monterrey']
    },
    {
      title: 'Gobierno reporta avance del viaducto de Línea 6 en Gonzalitos', status:'CONTENT_READY', priority:'HIGH', confidence:'HIGH',
      summary:'Actualización del avance de obras de la Línea 6 y condiciones viales en Gonzalitos.', topic:'metro-linea-6-gonzalitos', sourceNames:['Gobierno de Nuevo León','ABC Noticias']
    },
    {
      title: 'Actualización de niveles y abasto de agua en zona metropolitana', status:'ANALYZING', priority:'NORMAL', confidence:'MEDIUM',
      summary:'Seguimiento de disponibilidad de agua y operación del sistema metropolitano.', topic:'agua', sourceNames:['Gobierno de Nuevo León','Milenio Monterrey']
    },
    {
      title: 'Agenda pública estatal: eventos y anuncios para esta tarde', status:'DISCOVERED', priority:'NORMAL', confidence:'MEDIUM',
      summary:'Concentrado de actividades públicas relevantes del gobierno estatal.', topic:'seguridad', sourceNames:['Gobierno de Nuevo León']
    }
  ];

  const storyRows = [];
  for (const def of storyDefs) {
    let story = await prisma.story.findFirst({ where: { stateBrainId: nl.id, title: def.title } });
    if (!story) {
      story = await prisma.story.create({ data: {
        stateBrainId: nl.id, title: def.title, status: def.status, priority: def.priority, confidence: def.confidence,
        summary: def.summary, context: 'Registro inicial del MVP para validar el flujo de inteligencia editorial y publicación.'
      }});
    } else {
      story = await prisma.story.update({ where:{id:story.id}, data:{status:def.status,priority:def.priority,confidence:def.confidence,summary:def.summary} });
    }
    storyRows.push(story);
    await prisma.storyTopic.upsert({ where:{storyId_topicId:{storyId:story.id,topicId:topicMap[def.topic].id}}, update:{}, create:{storyId:story.id,topicId:topicMap[def.topic].id} });
    for (const sourceName of def.sourceNames) {
      const source = sourceMap[sourceName];
      await prisma.storySource.upsert({
        where:{storyId_sourceId:{storyId:story.id,sourceId:source.id}}, update:{sourceUrl:source.url,sourceTitle:source.name},
        create:{storyId:story.id,sourceId:source.id,sourceUrl:source.url,sourceTitle:source.name,isPrimary:def.sourceNames[0]===sourceName}
      });
    }
  }

  const line6Story = storyRows[1];
  let piece = await prisma.contentPiece.findFirst({ where:{ storyId:line6Story.id, mediaIdentityId:identityMap['norte-en-alerta'].id, type:'FACEBOOK_POST' } });
  if (!piece) piece = await prisma.contentPiece.create({data:{
    storyId:line6Story.id, mediaIdentityId:identityMap['norte-en-alerta'].id, type:'FACEBOOK_POST', status:'APPROVED',
    headline:'Línea 6 mantiene avance en Gonzalitos', copy:'Nuevo León reportó nuevos avances en el viaducto de la Línea 6. La plataforma conserva fuentes, contexto y trazabilidad antes de publicar.', version:1
  }});

  const accountDefs = [
    [identityMap['norte-en-alerta'].id,'FACEBOOK','Norte En Alerta Facebook','CONNECTED'],
    [identityMap['norte-en-alerta'].id,'INSTAGRAM','Norte En Alerta Instagram','CONNECTED'],
    [independent.id,'FACEBOOK','El Independiente HGO Facebook','CONNECTED']
  ];
  for (const [mediaIdentityId,platform,name,connectionStatus] of accountDefs) {
    await prisma.socialAccount.upsert({
      where:{mediaIdentityId_platform_name:{mediaIdentityId,platform,name}},
      update:{connectionStatus,isActive:true}, create:{mediaIdentityId,platform,name,connectionStatus,isActive:true}
    });
  }

  const recentRun = await prisma.discoveryRun.findFirst({ where:{stateBrainId:nl.id}, orderBy:{createdAt:'desc'} });
  if (!recentRun) {
    await prisma.discoveryRun.create({data:{
      stateBrainId:nl.id,status:'COMPLETED',startedAt:new Date(Date.now()-30*60*1000),finishedAt:new Date(Date.now()-12*60*1000),
      periodStart:new Date(Date.now()-6*60*60*1000),periodEnd:new Date(),itemsScanned:328,candidatesFound:38,storiesCreated:12,itemsDiscarded:26
    }});
  }

  return { country: mx, stateBrain: nl };
}

if (require.main === module) {
  seedDatabase().then(()=>console.log('Seed completado')).catch(err=>{console.error(err);process.exitCode=1}).finally(()=>prisma.$disconnect());
}

module.exports = { seedDatabase };
