const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STATES = [
 ['aguascalientes','Aguascalientes','AGS'],['baja-california','Baja California','BC'],['baja-california-sur','Baja California Sur','BCS'],
 ['campeche','Campeche','CAM'],['chiapas','Chiapas','CHIS'],['chihuahua','Chihuahua','CHIH'],['ciudad-de-mexico','Ciudad de México','CDMX'],
 ['coahuila','Coahuila','COAH'],['colima','Colima','COL'],['durango','Durango','DGO'],['guanajuato','Guanajuato','GTO'],['guerrero','Guerrero','GRO'],
 ['hidalgo','Hidalgo','HGO'],['jalisco','Jalisco','JAL'],['estado-de-mexico','Estado de México','EDOMEX'],['michoacan','Michoacán','MICH'],
 ['morelos','Morelos','MOR'],['nayarit','Nayarit','NAY'],['nuevo-leon','Nuevo León','NL'],['oaxaca','Oaxaca','OAX'],['puebla','Puebla','PUE'],
 ['queretaro','Querétaro','QRO'],['quintana-roo','Quintana Roo','QROO'],['san-luis-potosi','San Luis Potosí','SLP'],['sinaloa','Sinaloa','SIN'],
 ['sonora','Sonora','SON'],['tabasco','Tabasco','TAB'],['tamaulipas','Tamaulipas','TAMPS'],['tlaxcala','Tlaxcala','TLAX'],
 ['veracruz','Veracruz','VER'],['yucatan','Yucatán','YUC'],['zacatecas','Zacatecas','ZAC']
];

async function upsertIdentity(stateBrainId, def){
  const row=await prisma.mediaIdentity.upsert({where:{slug:def.slug},update:{name:def.name,code:def.code,status:def.status,description:def.description,stateBrainId},create:{stateBrainId,...def}});
  if(def.dna){
    await prisma.mediaDNA.upsert({where:{mediaIdentityId:row.id},update:def.dna,create:{mediaIdentityId:row.id,...def.dna}});
  }
  return row;
}

async function seedDatabase(){
  const mx=await prisma.country.upsert({where:{code:'MX'},update:{name:'México',isActive:true},create:{code:'MX',name:'México',isActive:true}});
  const stateMap={};
  for(const [slug,name,stateCode] of STATES){
    const active=stateCode==='NL';
    stateMap[stateCode]=await prisma.stateBrain.upsert({
      where:{slug},
      update:{name,stateCode,status:active?'ACTIVE':'DRAFT',countryId:mx.id},
      create:{countryId:mx.id,slug,name,stateCode,status:active?'ACTIVE':'DRAFT',description:active?'Cerebro estatal inicial de AI Media Network.':'Cerebro estatal preparado para activación.'}
    });
  }
  const nl=stateMap.NL, hgo=stateMap.HGO, col=stateMap.COL;
  const dna={tone:'Directo e informativo',editorialStyle:'Periodístico local, ágil y verificable',geographicFocus:'Nuevo León',headlineStyle:'Corto, claro y de alto impacto informativo',politicalTone:'Neutral',audience:'Audiencia general de Nuevo León',language:'es-MX',avoidRules:['Clickbait excesivo','Afirmaciones no verificadas','Lenguaje partidista','Predicciones electorales propias'],preferredFormats:['FACEBOOK_POST','INSTAGRAM_POST','INSTAGRAM_STORY','INSTAGRAM_REEL','ARTICLE'],promptInstructions:'Priorizar hechos verificables, atribuir afirmaciones y separar información confirmada de versiones.'};
  const identities={};
  identities.nea=await upsertIdentity(nl.id,{slug:'norte-en-alerta',name:'Norte En Alerta',code:'NEA',status:'ACTIVE',description:'Generalista · Nuevo León',dna});
  identities.cr=await upsertIdentity(nl.id,{slug:'codigo-regio',name:'Código Regio',code:'CR',status:'ACTIVE',description:'Ciudad y seguridad',dna:{...dna,tone:'Directo, urbano e informativo'}});
  identities.pn=await upsertIdentity(nl.id,{slug:'punto-norte',name:'Punto Norte',code:'PN',status:'ACTIVE',description:'Información local',dna:{...dna,tone:'Cercano, útil e informativo'}});
  identities.cp=await upsertIdentity(nl.id,{slug:'circulo-politico-nl',name:'Círculo Político NL',code:'CPNL',status:'ACTIVE',description:'Política estatal',dna:{...dna,tone:'Analítico y sobrio',editorialStyle:'Política pública y vida institucional con neutralidad factual'}});
  await upsertIdentity(hgo.id,{slug:'el-independiente-hgo',name:'El Independiente HGO',code:'EIH',status:'ACTIVE',description:'Identidad Hidalgo'});
  await upsertIdentity(col.id,{slug:'colima-identidad-pendiente',name:'Colima — identidad pendiente',code:'COL01',status:'DRAFT',description:'Identidad por definir'});

  const topicDefs=[
    ['proceso-electoral-nl-2026-2027','Proceso Electoral NL 2026-2027','HIGH',['elecciones','proceso electoral','partidos','candidaturas']],
    ['agua','Agua','HIGH',['agua','abasto','presa','acueducto']],
    ['metro-linea-6-gonzalitos','Metro Línea 6 / Gonzalitos','HIGH',['linea 6','línea 6','gonzalitos','metro']],
    ['seguridad','Seguridad','HIGH',['seguridad','fuerza civil','fiscalia','fiscalía']],
    ['movilidad','Movilidad','NORMAL',['movilidad','transporte','trafico','tráfico']],
    ['economia','Economía','NORMAL',['economia','economía','empleo','inversion','inversión']]
  ];
  for(const [slug,name,priority,keywords] of topicDefs) await prisma.topic.upsert({where:{stateBrainId_slug:{stateBrainId:nl.id,slug}},update:{name,priority,status:'WATCHING',keywords},create:{stateBrainId:nl.id,slug,name,priority,status:'WATCHING',keywords}});

  const profileDefs=[['samuel-garcia','Samuel García','PUBLIC_FIGURE',['Samuel Alejandro García Sepúlveda']],['mariana-rodriguez','Mariana Rodríguez','PUBLIC_FIGURE',[]],['gobierno-nuevo-leon','Gobierno de Nuevo León','ORGANIZATION',['Gobierno NL']],['metrorrey','Metrorrey','ORGANIZATION',[]],['congreso-nuevo-leon','Congreso de Nuevo León','ORGANIZATION',['HCNL']]];
  for(const [slug,name,type,aliases] of profileDefs) await prisma.profile.upsert({where:{stateBrainId_slug:{stateBrainId:nl.id,slug}},update:{name,type,aliases},create:{stateBrainId:nl.id,slug,name,type,aliases}});

  const watchDefs=[['Samuel García','PROFILE','samuel garcia','HIGH'],['Proceso Electoral NL','TOPIC','proceso electoral nuevo leon','HIGH'],['Agua Nuevo León','TOPIC','agua nuevo leon','HIGH'],['Línea 6','TOPIC','linea 6 gonzalitos','HIGH'],['Seguridad NL','TOPIC','seguridad nuevo leon','NORMAL']];
  for(const [name,type,query,priority] of watchDefs){const e=await prisma.watch.findFirst({where:{stateBrainId:nl.id,name}}); if(e) await prisma.watch.update({where:{id:e.id},data:{type,query,priority,isActive:true}}); else await prisma.watch.create({data:{stateBrainId:nl.id,name,type,query,priority,isActive:true}})}

  const sourceDefs=[
    ['Gobierno de Nuevo León - Noticias','GOVERNMENT','https://www.nl.gob.mx/es/noticias','nl.gob.mx',0.95],
    ['H. Congreso de Nuevo León','GOVERNMENT','https://www.hcnl.gob.mx/','hcnl.gob.mx',0.95],
    ['H. Congreso de Nuevo León - Sala de Prensa','GOVERNMENT','https://www.hcnl.gob.mx/sala_de_prensa/','hcnl.gob.mx',0.95]
  ];
  for(const [name,type,url,domain,trustScore] of sourceDefs){const e=await prisma.source.findFirst({where:{stateBrainId:nl.id,name}});if(e) await prisma.source.update({where:{id:e.id},data:{type,url,domain,trustScore,isActive:true}});else await prisma.source.create({data:{stateBrainId:nl.id,name,type,url,domain,trustScore,isActive:true}})}

  const accountDefs=[
    [identities.nea.id,'FACEBOOK','Norte En Alerta Facebook'],[identities.nea.id,'INSTAGRAM','Norte En Alerta Instagram'],
    [identities.cr.id,'FACEBOOK','Código Regio Facebook'],[identities.pn.id,'FACEBOOK','Punto Norte Facebook'],
    [identities.cp.id,'FACEBOOK','Círculo Político NL Facebook'],[identities.cp.id,'X','Círculo Político NL X'],
    [identities.nea.id,'TELEGRAM','AI Media Network Operator']
  ];
  for(const [mediaIdentityId,platform,name] of accountDefs) await prisma.socialAccount.upsert({where:{mediaIdentityId_platform_name:{mediaIdentityId,platform,name}},update:{isActive:true},create:{mediaIdentityId,platform,name,isActive:true,connectionStatus:'PENDING'}});

  const settings={
    'system.defaultState':'NL','system.reviewBeforePublish':true,'discovery.relevanceThreshold':0.55,'discovery.lookbackHours':6,
    'editorial.requireSource':true,'editorial.politicalNeutrality':true,'generation.defaultIdentity':'norte-en-alerta'
  };
  for(const [key,value] of Object.entries(settings)) await prisma.appSetting.upsert({where:{key},update:{value},create:{key,value}});
  const activityCount=await prisma.activityEvent.count();
  if(!activityCount) await prisma.activityEvent.create({data:{type:'SYSTEM_READY',scope:'MX',title:'AI Media Network v1.0 inicializado',detail:'Estructura nacional, Nuevo León y núcleo editorial preparados.'}});
  return {country:mx,stateBrain:nl};
}

if(require.main===module){seedDatabase().then(()=>console.log('Seed v1.0 completado')).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect())}
module.exports={seedDatabase};
