const {assertEditorialQuality}=require('./services/editorial-quality');
const {VISUAL_TYPES,validateVisual,context,safeCaption}=require('./services/visual-policy');
const express=require('express');
const path=require('path');
const {execSync}=require('child_process');
const {PrismaClient}=require('@prisma/client');
const {seedDatabase,ensureVisualDefaults}=require('./packages/database/prisma/seed');
const {STATES,getState}=require('./services/state-catalog');
const {RECOMMENDATIONS,sourceKey,previewSources}=require('./services/source-recommendations');
const {discoverStateSources}=require('./services/source-auto-discovery');
const {specializedSearch}=require('./services/specialized-search');
const {runDiscovery,candidateToStory}=require('./services/discovery');
const {analyzeStory}=require('./services/story-intelligence');
const {generatePieces,generatePieceImage}=require('./services/content');
const {publishPiece,savePieceToDrive,schedulePiece,processScheduled}=require('./services/publication');
const {slugify,propose:proposeIdentity}=require('./services/identity-studio');
const {handleTelegramUpdate}=require('./services/telegram-operator');
const {inspectPsd,statusFor,safeTemplate,diagnosticsFor}=require('./services/template-library');
const {renderTemplatePreview}=require('./services/template-engine');
const {design:designBrand,brandImage,buildTemplates,paletteFor,normalizeLogo}=require('./services/brand-studio');
const {discoverMetaPages,inspectPageAccessToken,decryptTicket,validateMetaAccount}=require('./services/integrations/meta');
const {configured:socialVaultConfigured,encryptSecret,verifyMediaId}=require('./services/secret-vault');
const metaOauth=require('./services/integrations/meta-oauth');

const app=express(), prisma=new PrismaClient();
const port=process.env.PORT||3000, publicDir=path.join(__dirname,'public');
let databaseReady=false; const hasDatabase=Boolean(process.env.DATABASE_URL);
app.use(express.json({limit:'60mb'}));
const templateSelect={id:true,mediaIdentityId:true,code:true,name:true,format:true,renderer:true,sourceType:true,status:true,width:true,height:true,version:true,isActive:true,referenceImageUrl:true,masterFileName:true,masterMimeType:true,masterFileSize:true,detectedLayers:true,layerMap:true,compiledDefinition:true,configuration:true,createdAt:true,updatedAt:true};
const socialAccountSelect={id:true,mediaIdentityId:true,platform:true,name:true,externalAccountId:true,username:true,isActive:true,connectionStatus:true,credentialsRef:true,tokenExpiresAt:true,permissions:true,lastCheckedAt:true,lastError:true,configuration:true,createdAt:true,updatedAt:true};
const socialAccountWithIdentitySelect={...socialAccountSelect,mediaIdentity:{select:{id:true,name:true,slug:true,stateBrain:{select:{stateCode:true,name:true}}}},_count:{select:{publications:true}}};

async function prepareDatabase(){
  if(!hasDatabase){console.warn('DATABASE_URL no configurada. La UI abrirá, pero la API de datos quedará en espera.');return}
  try{
    if(process.env.AUTO_DB_PUSH!=='false')execSync('npx prisma db push --schema=packages/database/prisma/schema.prisma',{cwd:__dirname,stdio:'inherit'});
    if(process.env.SEED_ON_EMPTY!=='false' && await prisma.country.count()===0)await seedDatabase();
    if(process.env.SEED_VISUAL_DEFAULTS!=='false')await ensureVisualDefaults();
    databaseReady=true;console.log('PostgreSQL listo.');
  }catch(e){console.error('Error preparando PostgreSQL:',e)}
}
function fail(res,e,status=500){console.error(e);res.status(status).json({ok:false,error:e.code||e.message||'INTERNAL_ERROR',message:e.message||'Error interno'})}
function dbGuard(req,res,next){if(!databaseReady)return res.status(503).json({ok:false,error:'DATABASE_NOT_READY',message:'PostgreSQL aún no está disponible.'});next()}
function stateWhere(code){return code?{stateBrain:{stateCode:code}}:{}}
function validEnum(value,allowed,def){return allowed.includes(value)?value:def}

app.get('/api/health',async(_req,res)=>{let db=false;if(databaseReady)try{await prisma.$queryRaw`SELECT 1`;db=true}catch{}res.json({ok:true,version:'1.9.5',databaseConfigured:hasDatabase,databaseReady:db,aiConfigured:Boolean(process.env.OPENAI_API_KEY),metaConfigured:Boolean(process.env.META_ACCESS_TOKEN)||socialVaultConfigured(),socialVaultConfigured:socialVaultConfigured(),metaOAuthConfigured:metaOauth.configured(),driveConfigured:Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN),telegramConfigured:Boolean(process.env.TELEGRAM_BOT_TOKEN),timestamp:new Date().toISOString()})});
app.get('/media/:pieceId/:signature.png',async(req,res)=>{try{if(!databaseReady)return res.status(503).send('Base de datos no disponible');if(!socialVaultConfigured()||!verifyMediaId(req.params.pieceId,req.params.signature))return res.status(403).send('Firma no válida');const piece=await prisma.contentPiece.findUnique({where:{id:req.params.pieceId},select:{imageUrl:true}});if(!piece?.imageUrl)return res.status(404).send('Imagen no disponible');const value=piece.imageUrl;if(value.startsWith('data:image/')){const match=value.match(/^data:([^;]+);base64,(.+)$/s);if(!match)return res.status(422).send('Formato no válido');const buffer=Buffer.from(match[2],'base64');res.setHeader('Content-Type',match[1]);res.setHeader('Content-Length',String(buffer.length));res.setHeader('Cache-Control','public,max-age=3600');return res.end(buffer)}if(/^https?:\/\//i.test(value))return res.redirect(302,value);return res.status(422).send('Formato no compatible')}catch(e){console.error(e);res.status(500).send('Error interno')}});
app.get('/api/meta/oauth/start',metaOauth.start);
app.get('/api/meta/oauth/callback',metaOauth.callback);
app.get('/api/meta/oauth/result',metaOauth.result);
app.use('/api',dbGuard);

app.get('/api/bootstrap',async(req,res)=>{try{const state=req.query.state||'NL';const [dashboard,identities,topics,profiles,watches,sources,activity]=await Promise.all([getDashboard(state),prisma.mediaIdentity.findMany({where:stateWhere(state),include:{mediaDNA:true,visualDNA:true,templates:{select:templateSelect},socialAccounts:{select:socialAccountSelect},stateBrain:true},orderBy:{name:'asc'}}),prisma.topic.findMany({where:stateWhere(state),include:{_count:{select:{storyLinks:true}}},orderBy:[{priority:'desc'},{name:'asc'}]}),prisma.profile.findMany({where:stateWhere(state),include:{_count:{select:{storyLinks:true}}},orderBy:{name:'asc'}}),prisma.watch.findMany({where:stateWhere(state),orderBy:[{isActive:'desc'},{priority:'desc'}]}),prisma.source.findMany({where:stateWhere(state),orderBy:[{isActive:'desc'},{name:'asc'}]}),prisma.activityEvent.findMany({orderBy:{createdAt:'desc'},take:20})]);res.json({ok:true,data:{dashboard,identities,topics,profiles,watches,sources,activity}})}catch(e){fail(res,e)}});

async function getDashboard(stateCode='NL'){
  const state=await prisma.stateBrain.findFirst({where:{stateCode}});if(!state)throw new Error('STATE_NOT_FOUND');const since=new Date(Date.now()-86400000);
  const [stateBrains,identities,sources,watches,stories24h,publications24h,topics,profiles,pendingCandidates,piecesReview,runs,stories]=await Promise.all([
    prisma.stateBrain.count(),prisma.mediaIdentity.count(),prisma.source.count({where:{isActive:true}}),prisma.watch.count({where:{isActive:true}}),prisma.story.count({where:{stateBrainId:state.id,detectedAt:{gte:since}}}),prisma.publication.count({where:{publishedAt:{gte:since}}}),prisma.topic.count({where:{stateBrainId:state.id}}),prisma.profile.count({where:{stateBrainId:state.id}}),prisma.discoveryCandidate.count({where:{discoveryRun:{stateBrainId:state.id},status:'CANDIDATE'}}),prisma.contentPiece.count({where:{story:{stateBrainId:state.id},status:{in:['GENERATED','REVIEW']}}}),prisma.discoveryRun.findMany({where:{stateBrainId:state.id},orderBy:{createdAt:'desc'},take:5}),prisma.story.findMany({where:{stateBrainId:state.id},orderBy:{detectedAt:'desc'},take:10,include:{_count:{select:{sources:true,contentPieces:true}},contentPieces:{take:1,include:{mediaIdentity:true}}}})
  ]);
  return{state,kpis:{stateBrains,identities,sources,watches,stories24h,publications24h,topics,profiles,pendingCandidates,piecesReview},runs,stories:stories.map(s=>({publicId:s.publicId,title:s.title,status:s.status,priority:s.priority,confidence:s.confidence,detectedAt:s.detectedAt,sourceCount:s._count.sources,pieceCount:s._count.contentPieces,identity:s.contentPieces[0]?.mediaIdentity?.name||null}))};
}
app.get('/api/dashboard',async(req,res)=>{try{res.json({ok:true,...await getDashboard(req.query.state||'NL')})}catch(e){fail(res,e)}});

app.get('/api/states/catalog',async(_req,res)=>{try{res.json({ok:true,data:STATES.map(([slug,name,stateCode])=>({slug,name,stateCode}))})}catch(e){fail(res,e)}});
app.get('/api/states',async(_req,res)=>{try{res.json({ok:true,data:await prisma.stateBrain.findMany({include:{_count:{select:{identities:true,sources:true,topics:true,profiles:true,stories:true}}},orderBy:{name:'asc'}})})}catch(e){fail(res,e)}});
app.post('/api/states',async(req,res)=>{try{
  const item=getState(req.body?.stateCode);
  if(!item)return res.status(400).json({ok:false,error:'INVALID_STATE_CODE',message:'Selecciona una entidad del catálogo nacional.'});
  const existing=await prisma.stateBrain.findFirst({where:{OR:[{slug:item.slug},{stateCode:item.stateCode}]}});
  if(existing)return res.status(409).json({ok:false,error:'STATE_ALREADY_EXISTS',message:'El cerebro estatal ya está registrado.'});
  const country=await prisma.country.upsert({where:{code:'MX'},update:{},create:{code:'MX',name:'México',isActive:true}});
  const row=await prisma.stateBrain.create({data:{countryId:country.id,slug:item.slug,name:item.name,stateCode:item.stateCode,status:'DRAFT',description:'Cerebro estatal en configuración; sin fuentes ni identidades asignadas.'}});
  res.status(201).json({ok:true,data:row});
}catch(e){if(e.code==='P2002')return res.status(409).json({ok:false,error:'STATE_ALREADY_EXISTS',message:'El cerebro estatal ya está registrado.'});fail(res,e)}});
app.patch('/api/states/:id',async(req,res)=>{try{
  const row=await prisma.stateBrain.findUnique({where:{id:req.params.id},include:{_count:{select:{identities:true,sources:true}}}});
  if(!row)return res.status(404).json({ok:false,error:'STATE_NOT_FOUND',message:'Estado no encontrado.'});
  const body=req.body||{},data={};
  if(Object.hasOwn(body,'status')){
    if(!['DRAFT','ACTIVE','PAUSED'].includes(body.status))return res.status(400).json({ok:false,error:'INVALID_STATUS',message:'Estado operativo inválido.'});
    if(body.status==='ACTIVE'&&(!row._count.identities||!row._count.sources))return res.status(422).json({ok:false,error:'STATE_NOT_READY',message:'Antes de activar, registra al menos una identidad y una fuente.'});
    data.status=body.status;
  }
  if(Object.hasOwn(body,'description')){
    if(typeof body.description!=='string'||body.description.length>1000)return res.status(400).json({ok:false,error:'INVALID_DESCRIPTION',message:'Descripción inválida.'});
    data.description=body.description;
  }
  if(!Object.keys(data).length)return res.status(400).json({ok:false,error:'NO_VALID_FIELDS',message:'Sin campos válidos para actualizar.'});
  res.json({ok:true,data:await prisma.stateBrain.update({where:{id:row.id},data})});
}catch(e){fail(res,e)}});

app.get('/api/identity-studio/accounts',async(_req,res)=>{try{
  const [accounts,identities,states]=await Promise.all([
    prisma.socialAccount.findMany({where:{platform:'FACEBOOK',connectionStatus:'CONNECTED',isActive:true},select:socialAccountWithIdentitySelect,orderBy:{name:'asc'}}),
    prisma.mediaIdentity.findMany({select:{id:true,name:true,slug:true,status:true,stateBrain:{select:{stateCode:true,name:true}},mediaDNA:{select:{id:true}},visualDNA:{select:{id:true}}},orderBy:{name:'asc'}}),
    prisma.stateBrain.findMany({select:{stateCode:true,name:true},orderBy:{name:'asc'}})
  ]);
  res.json({ok:true,data:{accounts,identities,states}});
}catch(e){fail(res,e)}});
app.post('/api/identity-studio/propose',async(req,res)=>{try{
  const b=req.body||{},account=await prisma.socialAccount.findUnique({where:{id:b.accountId},select:{id:true,name:true,platform:true,connectionStatus:true,isActive:true}});
  if(!account||account.platform!=='FACEBOOK'||account.connectionStatus!=='CONNECTED'||!account.isActive)return fail(res,new Error('CONNECTED_FACEBOOK_ACCOUNT_REQUIRED'),400);
  const state=await prisma.stateBrain.findFirst({where:{stateCode:b.stateCode||'NL'}});
  if(!state)return fail(res,new Error('STATE_NOT_FOUND'),404);
  const name=String(b.name||account.name).trim().slice(0,120);
  if(!name)return fail(res,new Error('NAME_REQUIRED'),400);
  const proposal=await proposeIdentity({name,stateName:state.name,focus:String(b.focus||'').slice(0,150)});
  res.json({ok:true,data:{...proposal,name,stateCode:state.stateCode,accountId:account.id}});
}catch(e){fail(res,e,400)}});
app.post('/api/identity-studio/apply',async(req,res)=>{try{
  const b=req.body||{};
  if(b.confirm!==true)return fail(res,new Error('CONFIRMATION_REQUIRED'),400);
  const account=await prisma.socialAccount.findUnique({where:{id:b.accountId},include:{mediaIdentity:true}});
  if(!account||account.platform!=='FACEBOOK'||account.connectionStatus!=='CONNECTED'||!account.isActive)return fail(res,new Error('CONNECTED_FACEBOOK_ACCOUNT_REQUIRED'),400);
  const destination=await prisma.stateBrain.findFirst({where:{stateCode:b.stateCode||'NL'}});
  if(!destination)return fail(res,new Error('STATE_NOT_FOUND'),404);
  const name=String(b.name||'').trim().slice(0,120);
  if(!name)return fail(res,new Error('NAME_REQUIRED'),400);
  if(!b.editorial||!b.visual||!b.description)return fail(res,new Error('PROPOSAL_REQUIRED'),400);
  const allowedEditorial=['tone','editorialStyle','geographicFocus','headlineStyle','politicalTone','language','audience','promptInstructions','avoidRules'];
  const allowedVisual=['palette','typography','layoutStyle','photoTreatment','overlayStyle','logoPlacement','formatRules','promptInstructions'];
  const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,obj[k]]));
  // Avoid overwriting editorial/visual DNA of an existing identity.
  // A Facebook page already linked to another identity requires explicit transfer confirmation.
  if(account.mediaIdentity?.name===name && account.mediaIdentity.stateBrainId===destination.id){
    if(b.updateExisting!==true)return res.json({ok:true,data:{identityId:account.mediaIdentity.id,reused:true,connected:true,message:'Identidad existente conservada sin cambios.'}});
    const existingId=account.mediaIdentity.id;
    await prisma.$transaction(async tx=>{
      await tx.mediaDNA.upsert({where:{mediaIdentityId:existingId},create:{mediaIdentityId:existingId,...pick(b.editorial,allowedEditorial)},update:pick(b.editorial,allowedEditorial)});
      await tx.visualDNA.upsert({where:{mediaIdentityId:existingId},create:{mediaIdentityId:existingId,...pick(b.visual,allowedVisual)},update:pick(b.visual,allowedVisual)});
      await tx.mediaIdentity.update({where:{id:existingId},data:{description:String(b.description).slice(0,750)}});
      await tx.activityEvent.create({data:{type:'IDENTITY_UPDATED',entityType:'MEDIA_IDENTITY',entityId:existingId,title:'ADN actualizado desde Identity Studio',detail:name}});
    });
    return res.json({ok:true,data:{identityId:existingId,reused:true,connected:true,updated:true}});
  }
  if(!b.transferAccount)return fail(res,new Error('TRANSFER_CONFIRMATION_REQUIRED'),409);
  const slugBase=slugify(name),suffix=String(account.externalAccountId||account.id).replace(/[^a-z0-9]/gi,'').slice(-10).toLowerCase();
  const slug=(slugBase+'-'+suffix).slice(0,85);
  const existing=await prisma.mediaIdentity.findUnique({where:{slug}});
  if(existing)return fail(res,new Error('IDENTITY_ALREADY_EXISTS'),409);
  const result=await prisma.$transaction(async tx=>{
    const fresh=await tx.socialAccount.findUnique({where:{id:account.id}});
    if(!fresh||fresh.mediaIdentityId!==account.mediaIdentityId)throw new Error('ACCOUNT_CHANGED_RETRY');
    const identity=await tx.mediaIdentity.create({data:{stateBrainId:destination.id,slug,name,status:'DRAFT',description:String(b.description).slice(0,750)}});
    await tx.mediaDNA.create({data:{mediaIdentityId:identity.id,...pick(b.editorial,allowedEditorial)}});
    await tx.visualDNA.create({data:{mediaIdentityId:identity.id,...pick(b.visual,allowedVisual)}});
    await tx.socialAccount.update({where:{id:account.id},data:{mediaIdentityId:identity.id}});
    await tx.activityEvent.create({data:{type:'IDENTITY_CREATED',entityType:'MEDIA_IDENTITY',entityId:identity.id,title:'Identidad creada desde Facebook',detail:name,metadata:{accountId:account.id,oldIdentityId:account.mediaIdentityId,source:'IDENTITY_STUDIO'}}});
    return identity;
  });
  res.status(201).json({ok:true,data:{identityId:result.id,reused:false,connected:true,status:'DRAFT'}});
}catch(e){fail(res,e,e.message==='ACCOUNT_CHANGED_RETRY'?409:400)}});
app.get('/api/identities',async(req,res)=>{try{res.json({ok:true,data:await prisma.mediaIdentity.findMany({where:stateWhere(req.query.state),include:{stateBrain:true,mediaDNA:true,visualDNA:true,templates:{select:templateSelect},socialAccounts:{select:socialAccountSelect}},orderBy:{name:'asc'}})})}catch(e){fail(res,e)}});
app.post('/api/identities',async(req,res)=>{try{const state=await prisma.stateBrain.findFirst({where:{stateCode:req.body.stateCode||'NL'}});if(!state)return fail(res,new Error('STATE_NOT_FOUND'),404);const d=req.body;const row=await prisma.mediaIdentity.create({data:{stateBrainId:state.id,slug:d.slug,name:d.name,code:d.code||null,status:d.status||'DRAFT',description:d.description||null}});res.status(201).json({ok:true,data:row})}catch(e){fail(res,e)}});
app.patch('/api/identities/:id',async(req,res)=>{try{const {name,status,description,logoUrl,websiteUrl}=req.body;res.json({ok:true,data:await prisma.mediaIdentity.update({where:{id:req.params.id},data:{name,status,description,logoUrl,websiteUrl}})})}catch(e){fail(res,e)}});
app.put('/api/identities/:id/dna',async(req,res)=>{try{const d=req.body;res.json({ok:true,data:await prisma.mediaDNA.upsert({where:{mediaIdentityId:req.params.id},update:d,create:{mediaIdentityId:req.params.id,...d}})})}catch(e){fail(res,e)}});
app.put('/api/identities/:id/visual-dna',async(req,res)=>{try{const d=req.body;res.json({ok:true,data:await prisma.visualDNA.upsert({where:{mediaIdentityId:req.params.id},update:d,create:{mediaIdentityId:req.params.id,...d}})})}catch(e){fail(res,e)}});
app.post('/api/identities/:id/brand/propose',async(req,res)=>{try{
 const identity=await prisma.mediaIdentity.findUnique({where:{id:req.params.id},include:{visualDNA:true}});
 if(!identity)return fail(res,new Error('IDENTITY_NOT_FOUND'),404);
 const proposal=await designBrand({name:identity.name,focus:String(req.body?.focus||'').slice(0,160),existingPalette:identity.visualDNA?.palette||{}});
 const preview=await brandImage({...proposal,logo:identity.brandLogoData?Buffer.from(identity.brandLogoData):null},'profile');
 res.json({ok:true,data:{...proposal,preview:'data:image/png;base64,'+preview.toString('base64'),existingTemplates:await prisma.mediaTemplate.count({where:{mediaIdentityId:identity.id,isActive:true}})}});
}catch(e){fail(res,e,400)}});
app.get('/api/identities/:id/brand/:asset',async(req,res)=>{try{
 if(!['profile.png','cover.png'].includes(req.params.asset))return res.status(404).end();
 const identity=await prisma.mediaIdentity.findUnique({where:{id:req.params.id},include:{visualDNA:true}});
 if(!identity)return res.status(404).end();
 const buffer=await brandImage({name:identity.name,palette:paletteFor(identity.visualDNA?.palette||{}),logo:identity.brandLogoData?Buffer.from(identity.brandLogoData):null},req.params.asset==='profile.png'?'profile':'cover');
 res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','public,max-age=300');res.end(buffer);
}catch(e){fail(res,e)}});
app.post('/api/identities/:id/brand/preview',async(req,res)=>{try{
 const identity=await prisma.mediaIdentity.findUnique({where:{id:req.params.id}});
 if(!identity)return fail(res,new Error('IDENTITY_NOT_FOUND'),404);
 const palette=paletteFor(req.body?.palette||{});
 const logo=req.body?.logoData?await normalizeLogo(req.body.logoData):(identity.brandLogoData?Buffer.from(identity.brandLogoData):null);
 const templates=await buildTemplates({identityId:identity.id,name:identity.name,palette,revision:1,logo});
 const results=[];
 for(const template of templates){
   const preview=await renderTemplatePreview(template,{headline:'Autoridades presentan nuevas medidas para mejorar los servicios públicos de la región',summary:'Información verificada y contextualizada con la fuente original de la noticia.',source:'Fuente de prueba'});
   const thumb=await require('sharp')(preview).resize({width:360,withoutEnlargement:true}).png().toBuffer();
   results.push({format:template.format,width:template.width,height:template.height,preview:'data:image/png;base64,'+thumb.toString('base64')});
 }
 res.setHeader('Cache-Control','no-store');
 res.json({ok:true,data:{formats:results,validated:true}});
}catch(e){fail(res,e,422)}});
app.post('/api/identities/:id/brand/activate',async(req,res)=>{try{
 const identity=await prisma.mediaIdentity.findUnique({where:{id:req.params.id},include:{visualDNA:true}});
 if(!identity)return fail(res,new Error('IDENTITY_NOT_FOUND'),404);
 if(req.body?.confirm!==true)return fail(res,new Error('BRAND_APPROVAL_REQUIRED'),400);
 const palette=paletteFor(req.body.palette||{});
 // Run all format previews before writing to PostgreSQL.
 const old=await prisma.mediaTemplate.findMany({where:{mediaIdentityId:identity.id,configuration:{path:['brandStudio'],equals:true}},select:{version:true}});
 const revision=Math.max(0,...old.map(t=>t.version||0))+1;
 const logo=req.body?.logoData?await normalizeLogo(req.body.logoData):(identity.brandLogoData?Buffer.from(identity.brandLogoData):null);
 const templates=await buildTemplates({identityId:identity.id,name:identity.name,palette,revision,logo});
 const previousVisual=identity.visualDNA||{};
 const visual={palette,layoutStyle:'AI Brand Studio · modular',photoTreatment:'Fotografías originales de fuentes periodísticas, no generadas por IA',overlayStyle:'Capas fijas validadas, texto ajustado sin cortar',logoPlacement:'Cabecera',formatRules:{...(previousVisual.formatRules&&typeof previousVisual.formatRules==='object'?previousVisual.formatRules:{}),brandStudio:true,brandRevision:revision,formats:templates.map(t=>({format:t.format,width:t.width,height:t.height}))},promptInstructions:'Usar exclusivamente plantillas aprobadas de este medio, fotografía real de la fuente y texto completo; rechazar cualquier composición que desborde.'};
 const rows=await prisma.$transaction(async tx=>{
   const created=[];
   for(const def of templates)created.push(await tx.mediaTemplate.create({data:def}));
   const formats=templates.map(x=>x.format);
   await tx.mediaTemplate.updateMany({where:{mediaIdentityId:identity.id,format:{in:formats},id:{notIn:created.map(x=>x.id)}},data:{isActive:false}});
   await tx.mediaTemplate.updateMany({where:{id:{in:created.map(x=>x.id)}},data:{isActive:true}});
   await tx.visualDNA.upsert({where:{mediaIdentityId:identity.id},create:{mediaIdentityId:identity.id,...visual},update:visual});
   await tx.mediaIdentity.update({where:{id:identity.id},data:{logoUrl:`/api/identities/${identity.id}/brand/profile.png`,brandLogoData:logo,brandLogoMimeType:logo?'image/png':null}});
   await tx.activityEvent.create({data:{type:'BRAND_ACTIVATED',entityType:'MEDIA_IDENTITY',entityId:identity.id,title:'Identidad gráfica activada',detail:identity.name,metadata:{revision,formats}}});
   return created;
 });
 res.status(201).json({ok:true,data:{version:revision,templates:rows.map(x=>({id:x.id,code:x.code,format:x.format,width:x.width,height:x.height})),profileUrl:`/api/identities/${identity.id}/brand/profile.png`,coverUrl:`/api/identities/${identity.id}/brand/cover.png`}});
}catch(e){fail(res,e,400)}});
app.get('/api/identities/:id/templates',async(req,res)=>{try{const rows=await prisma.mediaTemplate.findMany({where:{mediaIdentityId:req.params.id},select:{...templateSelect,masterFileData:true,baseImageData:true,baseImageMimeType:true},orderBy:[{isActive:'desc'},{name:'asc'}]});res.json({ok:true,data:rows.map(safeTemplate)})}catch(e){fail(res,e)}});
app.post('/api/identities/:id/templates/upload',async(req,res)=>{try{const identity=await prisma.mediaIdentity.findUnique({where:{id:req.params.id}});if(!identity)return fail(res,new Error('IDENTITY_NOT_FOUND'),404);const b=req.body||{};if(!b.masterDataBase64||!b.masterFileName)return fail(res,new Error('PSD_MASTER_REQUIRED'),400);if(!/\.psd$/i.test(b.masterFileName))return fail(res,new Error('PSD_MASTER_REQUIRED'),400);const master=Buffer.from(b.masterDataBase64,'base64');if(master.length>30*1024*1024)return fail(res,new Error('PSD_TOO_LARGE'),413);let inspected;try{inspected=inspectPsd(master)}catch(e){return fail(res,new Error('PSD_PARSE_FAILED: '+e.message),422)}const base=b.baseImageBase64?Buffer.from(b.baseImageBase64,'base64'):null;const code=(b.code||`${identity.code||identity.slug}_TEMPLATE_${Date.now()}`).toUpperCase().replace(/[^A-Z0-9_]+/g,'_');const layerMap=inspected.layerMap||{};const status=statusFor({baseImageData:base,layerMap});const row=await prisma.mediaTemplate.create({data:{mediaIdentityId:identity.id,code,name:b.name||b.masterFileName.replace(/\.psd$/i,''),format:b.format||'INSTAGRAM_POST',renderer:'GENERIC_LAYERED',sourceType:'PSD',status,width:Number(b.width||inspected.width||1080),height:Number(b.height||inspected.height||1350),version:Number(b.version||1),isActive:status==='READY',masterFileName:b.masterFileName,masterMimeType:b.masterMimeType||'image/vnd.adobe.photoshop',masterFileSize:master.length,masterFileData:master,baseImageMimeType:b.baseImageMimeType||null,baseImageData:base,detectedLayers:inspected.layers,layerMap,configuration:{compatibleFormats:[b.format||'INSTAGRAM_POST'],dynamicFields:inspected.dynamicFields,uploaded:true}}});res.status(201).json({ok:true,data:safeTemplate({...row,masterFileData:master,baseImageData:base})})}catch(e){fail(res,e)}});
app.put('/api/templates/:id/mapping',async(req,res)=>{try{const current=await prisma.mediaTemplate.findUnique({where:{id:req.params.id},select:{baseImageData:true}});if(!current)return fail(res,new Error('TEMPLATE_NOT_FOUND'),404);const layerMap=req.body.layerMap||{};const status=statusFor({baseImageData:current.baseImageData,layerMap});const row=await prisma.mediaTemplate.update({where:{id:req.params.id},data:{layerMap,compiledDefinition:req.body.compiledDefinition||null,status,isActive:status==='READY'?req.body.isActive!==false:false}});res.json({ok:true,data:safeTemplate(row)})}catch(e){fail(res,e)}});
app.post('/api/templates/:id/activate',async(req,res)=>{try{const t=await prisma.mediaTemplate.findUnique({where:{id:req.params.id}});if(!t)return fail(res,new Error('TEMPLATE_NOT_FOUND'),404);if(t.status!=='READY')return fail(res,new Error('TEMPLATE_NOT_READY'),409);if(req.body.exclusive!==false)await prisma.mediaTemplate.updateMany({where:{mediaIdentityId:t.mediaIdentityId,format:t.format,id:{not:t.id}},data:{isActive:false}});res.json({ok:true,data:safeTemplate(await prisma.mediaTemplate.update({where:{id:t.id},data:{isActive:true}}))})}catch(e){fail(res,e)}});
app.patch('/api/templates/:id',async(req,res)=>{try{const b=req.body;res.json({ok:true,data:safeTemplate(await prisma.mediaTemplate.update({where:{id:req.params.id},data:{name:b.name,format:b.format,isActive:b.isActive,referenceImageUrl:b.referenceImageUrl,configuration:b.configuration}}))})}catch(e){fail(res,e)}});
app.get('/api/templates/:id/master',async(req,res)=>{try{const t=await prisma.mediaTemplate.findUnique({where:{id:req.params.id},select:{masterFileData:true,masterFileName:true,masterMimeType:true}});if(!t?.masterFileData)return res.status(404).send('Archivo maestro no disponible');res.setHeader('Content-Type',t.masterMimeType||'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename=\"${String(t.masterFileName||'template.psd').replace(/\"/g,'')}\"`);res.end(Buffer.from(t.masterFileData))}catch(e){fail(res,e)}});
app.get('/api/templates/:id/base-image',async(req,res)=>{try{const t=await prisma.mediaTemplate.findUnique({where:{id:req.params.id},select:{baseImageData:true,baseImageMimeType:true}});if(!t?.baseImageData)return res.status(404).send('Base renderizable no disponible');res.setHeader('Content-Type',t.baseImageMimeType||'image/png');res.setHeader('Cache-Control','private,max-age=3600');res.end(Buffer.from(t.baseImageData))}catch(e){fail(res,e)}});
app.get('/api/templates/:id/preview',async(req,res)=>{try{const t=await prisma.mediaTemplate.findUnique({where:{id:req.params.id},include:{mediaIdentity:true}});if(!t)return res.status(404).send('Plantilla no encontrada');const diagnostics=diagnosticsFor(t);if(!diagnostics.canPreview)return res.status(409).json({ok:false,error:'TEMPLATE_NOT_PREVIEWABLE',message:'La plantilla necesita base renderizable y mapeo de PHOTO/HEADLINE antes de generar una vista previa.',diagnostics});const buffer=await renderTemplatePreview(t);res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Disposition',`inline; filename="preview-${String(t.code||t.id).replace(/[^A-Za-z0-9_-]/g,'_')}.png"`);res.end(buffer)}catch(e){fail(res,e)}});
app.get('/api/templates/:id/diagnostics',async(req,res)=>{try{const t=await prisma.mediaTemplate.findUnique({where:{id:req.params.id},select:{...templateSelect,baseImageData:true,masterFileData:true}});if(!t)return fail(res,new Error('TEMPLATE_NOT_FOUND'),404);res.json({ok:true,data:diagnosticsFor(t)})}catch(e){fail(res,e)}});

function crudRoutes(name,model,createData,updateData){
  app.get(`/api/${name}`,async(req,res)=>{try{res.json({ok:true,data:await prisma[model].findMany({where:stateWhere(req.query.state),orderBy:{createdAt:'desc'}})})}catch(e){fail(res,e)}});
  app.post(`/api/${name}`,async(req,res)=>{try{const state=await prisma.stateBrain.findFirst({where:{stateCode:req.body.stateCode||'NL'}});if(!state)return fail(res,new Error('STATE_NOT_FOUND'),404);res.status(201).json({ok:true,data:await prisma[model].create({data:createData(req.body,state)})})}catch(e){fail(res,e)}});
  app.patch(`/api/${name}/:id`,async(req,res)=>{try{res.json({ok:true,data:await prisma[model].update({where:{id:req.params.id},data:updateData(req.body)})})}catch(e){fail(res,e)}});
  app.delete(`/api/${name}/:id`,async(req,res)=>{try{await prisma[model].delete({where:{id:req.params.id}});res.json({ok:true})}catch(e){fail(res,e)}});
}
crudRoutes('topics','topic',(b,s)=>({stateBrainId:s.id,slug:b.slug,name:b.name,description:b.description||null,status:b.status||'ACTIVE',priority:b.priority||'NORMAL',keywords:b.keywords||[]}),(b)=>({name:b.name,description:b.description,status:b.status,priority:b.priority,keywords:b.keywords}));
crudRoutes('profiles','profile',(b,s)=>({stateBrainId:s.id,slug:b.slug,name:b.name,type:b.type||null,description:b.description||null,aliases:b.aliases||[],metadata:b.metadata||{}}),(b)=>({name:b.name,type:b.type,description:b.description,aliases:b.aliases,metadata:b.metadata}));
crudRoutes('watches','watch',(b,s)=>({stateBrainId:s.id,name:b.name,type:b.type||'KEYWORD',query:b.query||null,isActive:b.isActive!==false,priority:b.priority||'NORMAL',configuration:b.configuration||{}}),(b)=>({name:b.name,type:b.type,query:b.query,isActive:b.isActive,priority:b.priority,configuration:b.configuration}));
crudRoutes('sources','source',(b,s)=>({stateBrainId:s.id,name:b.name,type:b.type||'WEBSITE',url:b.url||null,domain:b.domain||null,isActive:b.isActive!==false,trustScore:b.trustScore??null,configuration:b.configuration||{}}),(b)=>({name:b.name,type:b.type,url:b.url,domain:b.domain,isActive:b.isActive,trustScore:b.trustScore,configuration:b.configuration}));

// Importación optativa: nunca sustituye fuentes existentes ni habilita una URL sin revisión.
app.get('/api/sources/recommendations',async(req,res)=>{try{
  const code=String(req.query.state||'').toUpperCase();
  const state=await prisma.stateBrain.findFirst({where:{stateCode:code}});
  if(!state)return res.status(404).json({ok:false,error:'STATE_NOT_FOUND',message:'Estado no registrado.'});
  const existing=await prisma.source.findMany({where:{stateBrainId:state.id},select:{name:true,url:true,domain:true}});
  const items=previewSources(code,existing);
  res.json({ok:true,data:{stateCode:code,available:items.filter(i=>i.status==='AVAILABLE').length,existing:items.filter(i=>i.status==='EXISTING').length,items}});
}catch(e){fail(res,e)}});
app.post('/api/sources/import-recommended',async(req,res)=>{try{
  const code=String(req.body?.stateCode||'').toUpperCase();
  if(!RECOMMENDATIONS[code])return res.status(400).json({ok:false,error:'NO_SOURCE_CATALOG',message:'Aún no hay fuentes recomendadas para esta entidad.'});
  const state=await prisma.stateBrain.findFirst({where:{stateCode:code}});
  if(!state)return res.status(404).json({ok:false,error:'STATE_NOT_FOUND',message:'Estado no registrado.'});
  const result=await prisma.$transaction(async tx=>{
    const existing=await tx.source.findMany({where:{stateBrainId:state.id},select:{url:true,domain:true}});
    const seen=new Set(existing.map(sourceKey).filter(Boolean));
    const added=[];let skipped=0;
    for(const item of RECOMMENDATIONS[code]){
      const host=sourceKey(item);
      if(seen.has(host)){skipped++;continue}
      const created=await tx.source.create({data:{stateBrainId:state.id,name:item.name,url:item.url,domain:host,type:item.type,isActive:false,trustScore:null,configuration:{origin:'RECOMMENDED_CATALOG',region:item.region,verification:'PENDING',importedAt:new Date().toISOString()}}});
      added.push({id:created.id,name:created.name});seen.add(host);
    }
    return {stateCode:code,added,addedCount:added.length,skippedCount:skipped};
  });
  res.json({ok:true,data:result});
}catch(e){fail(res,e)}});

const autoSourceRuns=new Map();
app.post('/api/sources/auto-discover',async(req,res)=>{try{
 const code=String(req.body?.stateCode||'').toUpperCase();
 if(!getState(code))return res.status(400).json({ok:false,error:'INVALID_STATE',message:'Entidad federativa no válida.'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({ok:false,error:'AI_NOT_CONFIGURED',message:'Configura OPENAI_API_KEY para investigar fuentes con búsqueda web.'});
 const last=autoSourceRuns.get(code)||0;
 if(Date.now()-last<3600000)return res.status(429).json({ok:false,error:'SOURCE_DISCOVERY_COOLDOWN',message:'Se permite una búsqueda por estado cada hora.'});
 const day=new Date().toISOString().slice(0,10);
 const todays=[...autoSourceRuns.values()].filter(x=>new Date(x).toISOString().slice(0,10)===day).length;
 if(todays>=6)return res.status(429).json({ok:false,error:'SOURCE_DISCOVERY_DAILY_LIMIT',message:'Límite de 6 búsquedas por día alcanzado.'});
 autoSourceRuns.set(code,Date.now());
 const result=await discoverStateSources(prisma,code);
 res.json({ok:true,data:result});
}catch(e){fail(res,e)}});

app.get('/api/radar',async(req,res)=>{try{const stateCode=req.query.state||'NL',since=new Date(Date.now()-24*3600000);const topics=await prisma.topic.findMany({where:{stateBrain:{stateCode}},include:{storyLinks:{where:{story:{detectedAt:{gte:since}}},include:{story:true}}}});const watches=await prisma.watch.findMany({where:{stateBrain:{stateCode},isActive:true}});const candidates=await prisma.discoveryCandidate.findMany({where:{discoveryRun:{stateBrain:{stateCode}},createdAt:{gte:since},status:{in:['CANDIDATE','PROMOTED']}},take:200});res.json({ok:true,data:{topics:topics.map(t=>({id:t.id,name:t.name,priority:t.priority,stories24h:t.storyLinks.length})).sort((a,b)=>b.stories24h-a.stories24h),watches,candidateSignals:candidates.slice(0,20)}})}catch(e){fail(res,e)}});

app.get('/api/news',async(req,res)=>{try{
 const stateCode=String(req.query.state||'NL');const hours=Math.min(168,Math.max(1,Number(req.query.hours||24)));
 const state=await prisma.stateBrain.findFirst({where:{stateCode}});if(!state)return fail(res,new Error('STATE_NOT_FOUND'),404);
 const since=new Date(Date.now()-hours*3600000);
 const items=await prisma.discoveryCandidate.findMany({where:{discoveryRun:{stateBrainId:state.id},status:{in:['CANDIDATE','LOW_RELEVANCE']},OR:[{publishedAt:{gte:since}},{publishedAt:null,createdAt:{gte:since}}]},include:{source:true},orderBy:[{publishedAt:'desc'},{createdAt:'desc'}],take:250});
 res.json({ok:true,data:items});
}catch(e){fail(res,e)}});
app.post('/api/discovery/run',async(req,res)=>{try{res.status(201).json({ok:true,data:await runDiscovery(prisma,req.body?.stateCode||'NL',{hours:req.body?.hours,threshold:req.body?.threshold})})}catch(e){fail(res,e)}});
app.post('/api/discovery/specialized',async(req,res)=>{try{
 const input=req.body||{};
 const result=await specializedSearch(prisma,input);
 const code=result.scope==='MX'?String(input.homeStateCode||'').toUpperCase():result.scope;
 const brain=await prisma.stateBrain.findFirst({where:{stateCode:code}});
 if(!brain)return res.status(400).json({ok:false,error:'HOME_STATE_REQUIRED',message:'Selecciona el estado donde se guardará esta investigación nacional.'});
 const run=await prisma.discoveryRun.create({data:{stateBrainId:brain.id,status:result.webError?'PARTIAL':'COMPLETED',startedAt:new Date(),finishedAt:new Date(),itemsScanned:result.results.length,candidatesFound:result.webCount,summary:{kind:'SPECIALIZED',query:result.query,type:result.type,scope:result.scope,hours:result.hours,webError:result.webError||null}}});
 const stored=[];
 for(const item of result.results.filter(x=>x.origin==='WEB_UNVERIFIED')){
  const existing=await prisma.discoveryCandidate.findFirst({where:{discoveryRun:{stateBrainId:brain.id},canonicalUrl:item.url},select:{id:true}});
  if(existing){stored.push({...item,savedId:existing.id,alreadySaved:true});continue}
  const date=item.publishedAt&& !Number.isNaN(Date.parse(item.publishedAt))?new Date(item.publishedAt):null;
  const saved=await prisma.discoveryCandidate.create({data:{discoveryRunId:run.id,url:item.url,canonicalUrl:item.url,title:item.title,excerpt:item.excerpt,publishedAt:date,relevanceScore:0,status:'REVIEW_REQUIRED',metadata:{origin:'SPECIALIZED_WEB',query:result.query,searchType:result.type,sourceName:item.sourceName,scope:result.scope,verification:'PENDING'}}});
  stored.push({...item,savedId:saved.id,alreadySaved:false});
 }
 result.results=result.results.map(x=>x.origin==='WEB_UNVERIFIED'?stored.find(y=>y.url===x.url)||x:{...x,savedId:x.id});
 res.json({ok:true,data:{...result,investigationId:run.id,storedCount:stored.length}});
}catch(e){fail(res,e,e.status||500)}});
app.get('/api/discovery/specialized/saved',async(req,res)=>{try{
 const code=String(req.query.state||'NL').toUpperCase();
 const brain=await prisma.stateBrain.findFirst({where:{stateCode:code}});
 if(!brain)return res.status(404).json({ok:false,error:'STATE_NOT_FOUND',message:'Estado no encontrado.'});
 const runs=await prisma.discoveryRun.findMany({where:{stateBrainId:brain.id,summary:{path:['kind'],equals:'SPECIALIZED'}},include:{candidates:{orderBy:{createdAt:'desc'},include:{story:true}}},orderBy:{createdAt:'desc'},take:30});
 res.json({ok:true,data:runs});
}catch(e){fail(res,e)}});
app.post('/api/discovery/specialized/:id/review',async(req,res)=>{try{
 const candidate=await prisma.discoveryCandidate.findUnique({where:{id:req.params.id},include:{discoveryRun:{include:{stateBrain:true}}}});
 if(!candidate||candidate.metadata?.origin!=='SPECIALIZED_WEB')return res.status(404).json({ok:false,message:'Hallazgo especializado no encontrado.'});
 if(candidate.status!=='REVIEW_REQUIRED')return res.status(409).json({ok:false,message:'El hallazgo ya fue revisado.'});
 const decision=req.body?.decision;
 if(!['APPROVE','DISCARD'].includes(decision))return res.status(400).json({ok:false,message:'Decisión inválida.'});
 if(decision==='APPROVE'&&req.body?.confirmed!==true)return res.status(400).json({ok:false,message:'Confirma que revisaste la noticia y su fuente original.'});
 const row=await prisma.discoveryCandidate.update({where:{id:candidate.id},data:{status:decision==='APPROVE'?'CANDIDATE':'DISCARDED',decisionReason:decision==='APPROVE'?'Revisado y aprobado por operador':'Descartado por operador',metadata:{...candidate.metadata,verification:decision==='APPROVE'?'OPERATOR_REVIEWED':'DISCARDED'}}});
 res.json({ok:true,data:row});
}catch(e){fail(res,e)}});

app.get('/api/discovery/candidates',async(req,res)=>{try{const where={discoveryRun:{stateBrain:{stateCode:req.query.state||'NL'}}};if(req.query.status)where.status=req.query.status;res.json({ok:true,data:await prisma.discoveryCandidate.findMany({where,include:{source:true,discoveryRun:true,story:true},orderBy:[{relevanceScore:'desc'},{createdAt:'desc'}],take:250})})}catch(e){fail(res,e)}});
app.post('/api/discovery/candidates/:id/promote',async(req,res)=>{try{res.status(201).json({ok:true,data:await candidateToStory(prisma,req.params.id)})}catch(e){fail(res,e)}});
app.post('/api/discovery/candidates/:id/discard',async(req,res)=>{try{const c=await prisma.discoveryCandidate.update({where:{id:req.params.id},data:{status:'DISCARDED',decisionReason:req.body?.reason||'Descartado por operador'}});await prisma.activityEvent.create({data:{type:'CANDIDATE_DISCARDED',entityType:'DISCOVERY_CANDIDATE',entityId:c.id,title:'Candidato descartado',detail:c.title}});res.json({ok:true,data:c})}catch(e){fail(res,e)}});

app.get('/api/stories',async(req,res)=>{try{const where={};if(req.query.state)where.stateBrain={stateCode:req.query.state};if(req.query.status)where.status=req.query.status;res.json({ok:true,data:await prisma.story.findMany({where,orderBy:{detectedAt:'desc'},take:200,include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}},contentPieces:{include:{mediaIdentity:true,publications:true}}}})})}catch(e){fail(res,e)}});
app.get('/api/stories/:publicId',async(req,res)=>{try{const id=Number(req.params.publicId);const row=await prisma.story.findUnique({where:{publicId:id},include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}},contentPieces:{include:{mediaIdentity:{include:{mediaDNA:true}},publications:{include:{socialAccount:{select:socialAccountSelect}}}}}}});if(!row)return fail(res,new Error('STORY_NOT_FOUND'),404);res.json({ok:true,data:row})}catch(e){fail(res,e)}});
app.post('/api/stories',async(req,res)=>{try{const s=await prisma.stateBrain.findFirst({where:{stateCode:req.body.stateCode||'NL'}});if(!s)return fail(res,new Error('STATE_NOT_FOUND'),404);const row=await prisma.story.create({data:{stateBrainId:s.id,title:req.body.title,summary:req.body.summary||null,priority:req.body.priority||'NORMAL',status:req.body.status||'DISCOVERED',confidence:req.body.confidence||null}});res.status(201).json({ok:true,data:row})}catch(e){fail(res,e)}});
app.patch('/api/stories/:publicId',async(req,res)=>{try{const id=Number(req.params.publicId);const d=req.body;res.json({ok:true,data:await prisma.story.update({where:{publicId:id},data:{title:d.title,summary:d.summary,context:d.context,keyFacts:d.keyFacts,actors:d.actors,timeline:d.timeline,contradictions:d.contradictions,editorialRisks:d.editorialRisks,priority:d.priority,confidence:d.confidence}})})}catch(e){fail(res,e)}});
app.patch('/api/stories/:publicId/status',async(req,res)=>{try{const status=req.body.status;const allowed=['DISCOVERED','ANALYZING','READY','GENERATING','CONTENT_READY','APPROVED','PUBLISHED','REJECTED','ARCHIVED'];if(!allowed.includes(status))return fail(res,new Error('INVALID_STATUS'),400);res.json({ok:true,data:await prisma.story.update({where:{publicId:Number(req.params.publicId)},data:{status,readyAt:status==='READY'?new Date():undefined,publishedAt:status==='PUBLISHED'?new Date():undefined}})})}catch(e){fail(res,e)}});
app.post('/api/stories/:publicId/analyze',async(req,res)=>{try{res.json({ok:true,data:await analyzeStory(prisma,Number(req.params.publicId))})}catch(e){fail(res,e)}});

app.get('/api/content-pieces',async(req,res)=>{try{const where={};if(req.query.state)where.story={stateBrain:{stateCode:req.query.state}};if(req.query.status)where.status=req.query.status;const rows=await prisma.contentPiece.findMany({where,include:{story:true,mediaIdentity:true,publications:{include:{socialAccount:{select:socialAccountSelect}}}},orderBy:{createdAt:'desc'},take:250});res.json({ok:true,data:rows.map(r=>({...r,hasImage:Boolean(r.imageUrl),imageUrl:r.imageUrl&&/^https?:\/\//i.test(r.imageUrl)?r.imageUrl:null}))})}catch(e){fail(res,e)}});
app.post('/api/stories/:publicId/generate',async(req,res)=>{try{const {identityId,types}=req.body;if(!identityId||!Array.isArray(types)||!types.length)return fail(res,new Error('IDENTITY_AND_TYPES_REQUIRED'),400);res.status(201).json({ok:true,data:await generatePieces(prisma,{publicId:Number(req.params.publicId),identityId,types})})}catch(e){fail(res,e)}});
app.patch('/api/content-pieces/:id',async(req,res)=>{try{const {headline,copy,body,imageUrl,videoUrl,status}=req.body;res.json({ok:true,data:await prisma.contentPiece.update({where:{id:req.params.id},data:{headline,copy,body,imageUrl,videoUrl,status}})})}catch(e){fail(res,e)}});
app.post('/api/content-pieces/:id/approve',async(req,res)=>{try{const check=await prisma.contentPiece.findUnique({where:{id:req.params.id},include:{story:{include:{stateBrain:true,sources:{include:{source:true}}}}}});if(!check)return fail(res,new Error('CONTENT_PIECE_NOT_FOUND'),404);if(VISUAL_TYPES.has(check.type)){assertEditorialQuality({title:check.story.title,summary:check.story.summary,stateCode:check.story.stateBrain?.stateCode});const m=check.metadata||{};validateVisual({caption:m.visualCaption||safeCaption(check.headline),summary:m.visualSummary||context(check.story,check.copy),source:check.story.sources?.[0]?.source?.name,imageUrl:check.imageUrl,metadata:m});}const row=await prisma.contentPiece.update({where:{id:req.params.id},data:{status:'APPROVED',approvedAt:new Date()}});await prisma.activityEvent.create({data:{type:'CONTENT_APPROVED',entityType:'CONTENT_PIECE',entityId:row.id,title:'Pieza aprobada',detail:row.headline}});res.json({ok:true,data:row})}catch(e){fail(res,e)}});
app.post('/api/content-pieces/:id/image',async(req,res)=>{try{res.json({ok:true,data:await generatePieceImage(prisma,req.params.id)})}catch(e){fail(res,e)}});
app.get('/api/content-pieces/:id/image-file',async(req,res)=>{try{const piece=await prisma.contentPiece.findUnique({where:{id:req.params.id},select:{imageUrl:true}});if(!piece?.imageUrl)return res.status(404).send('Imagen no disponible');const value=piece.imageUrl;if(value.startsWith('data:image/')){const match=value.match(/^data:([^;]+);base64,(.+)$/s);if(!match)return res.status(422).send('Formato de imagen no válido');const mime=match[1];const buffer=Buffer.from(match[2],'base64');res.setHeader('Content-Type',mime);res.setHeader('Content-Length',String(buffer.length));res.setHeader('Cache-Control','private, max-age=3600');res.setHeader('Content-Disposition',`inline; filename="pieza-${req.params.id}.png"`);return res.end(buffer)}if(/^https?:\/\//i.test(value))return res.redirect(302,value);return res.status(422).send('Formato de imagen no compatible')}catch(e){fail(res,e)}});
app.post('/api/content-pieces/:id/drive',async(req,res)=>{try{res.json({ok:true,data:await savePieceToDrive(prisma,req.params.id)})}catch(e){fail(res,e)}});

app.get('/api/channels',async(req,res)=>{try{res.json({ok:true,data:await prisma.socialAccount.findMany({where:req.query.state?{mediaIdentity:{stateBrain:{stateCode:req.query.state}}}:{},select:socialAccountWithIdentitySelect,orderBy:{createdAt:'asc'}})})}catch(e){fail(res,e)}});
app.post('/api/channels',async(req,res)=>{try{res.status(201).json({ok:true,data:await prisma.socialAccount.create({data:{mediaIdentityId:req.body.mediaIdentityId,platform:req.body.platform,name:req.body.name,externalAccountId:req.body.externalAccountId||null,username:req.body.username||null,isActive:req.body.isActive!==false,connectionStatus:req.body.connectionStatus||'PENDING',configuration:req.body.configuration||{}},select:socialAccountSelect})})}catch(e){fail(res,e)}});
app.patch('/api/channels/:id',async(req,res)=>{try{const b=req.body;res.json({ok:true,data:await prisma.socialAccount.update({where:{id:req.params.id},data:{name:b.name,externalAccountId:b.externalAccountId,username:b.username,isActive:b.isActive,connectionStatus:b.connectionStatus,configuration:b.configuration},select:socialAccountSelect})})}catch(e){fail(res,e)}});
app.post('/api/meta/discover',async(req,res)=>{try{if(!socialVaultConfigured())return fail(res,new Error('SOCIAL_CREDENTIALS_KEY_NOT_CONFIGURED'),503);const data=await discoverMetaPages(req.body?.accessToken);res.json({ok:true,data})}catch(e){fail(res,e,400)}});
app.post('/api/meta/connect-page-token',async(req,res)=>{try{
  if(!socialVaultConfigured())return fail(res,new Error('SOCIAL_CREDENTIALS_KEY_NOT_CONFIGURED'),503);
  const b=req.body||{};if(!b.mediaIdentityId||!b.pageAccessToken)return fail(res,new Error('IDENTITY_AND_PAGE_TOKEN_REQUIRED'),400);
  const identity=await prisma.mediaIdentity.findUnique({where:{id:b.mediaIdentityId}});if(!identity)return fail(res,new Error('IDENTITY_NOT_FOUND'),404);
  const inspected=await inspectPageAccessToken(b.pageAccessToken);const page=inspected.page;const secret=encryptSecret(b.pageAccessToken);
  const common={mediaIdentityId:identity.id,isActive:true,connectionStatus:'CONNECTED',credentialsRef:'VAULT',credentialCiphertext:secret.ciphertext,credentialIv:secret.iv,credentialTag:secret.tag,permissions:inspected.permissions||{},lastCheckedAt:new Date(),lastError:null};
  let fb=await prisma.socialAccount.findFirst({where:{mediaIdentityId:identity.id,platform:'FACEBOOK',OR:[{externalAccountId:page.id},{externalAccountId:null}]},orderBy:{updatedAt:'desc'}});
  const fbData={...common,name:page.name||fb?.name||'Facebook',externalAccountId:page.id,username:page.username||null,configuration:{pageId:page.id,source:'PAGE_ACCESS_TOKEN'}};
  fb=fb?await prisma.socialAccount.update({where:{id:fb.id},data:fbData}):await prisma.socialAccount.create({data:{...fbData,platform:'FACEBOOK'}});
  let ig=null;if(b.connectInstagram&&page.instagram?.id){
    ig=await prisma.socialAccount.findFirst({where:{mediaIdentityId:identity.id,platform:'INSTAGRAM',OR:[{externalAccountId:page.instagram.id},{externalAccountId:null}]},orderBy:{updatedAt:'desc'}});
    const igData={...common,name:page.instagram.name||page.instagram.username||`${page.name} Instagram`,externalAccountId:page.instagram.id,username:page.instagram.username||null,configuration:{pageId:page.id,instagramAccountId:page.instagram.id,source:'PAGE_ACCESS_TOKEN'}};
    ig=ig?await prisma.socialAccount.update({where:{id:ig.id},data:igData}):await prisma.socialAccount.create({data:{...igData,platform:'INSTAGRAM'}});
  }
  await prisma.activityEvent.create({data:{type:'SOCIAL_ACCOUNT_CONNECTED',entityType:'MEDIA_IDENTITY',entityId:identity.id,title:`Meta conectado · ${page.name}`,detail:identity.name,metadata:{facebookPageId:page.id,instagramId:page.instagram?.id||null,source:'PAGE_ACCESS_TOKEN'}}});
  const clean=x=>x?Object.fromEntries(Object.entries(x).filter(([k])=>!['credentialCiphertext','credentialIv','credentialTag'].includes(k))):null;
  res.status(201).json({ok:true,data:{facebook:clean(fb),instagram:clean(ig),page}});
}catch(e){fail(res,e,400)}});
app.post('/api/meta/connect',async(req,res)=>{try{if(!socialVaultConfigured())return fail(res,new Error('SOCIAL_CREDENTIALS_KEY_NOT_CONFIGURED'),503);const b=req.body||{};const identity=await prisma.mediaIdentity.findUnique({where:{id:b.mediaIdentityId}});if(!identity)return fail(res,new Error('IDENTITY_NOT_FOUND'),404);const ticket=decryptTicket(b.ticket);if(!ticket?.pageAccessToken||!ticket?.pageId)return fail(res,new Error('META_CONNECTION_TICKET_INVALID'),400);const secret=encryptSecret(ticket.pageAccessToken);const common={mediaIdentityId:identity.id,isActive:true,connectionStatus:'CONNECTED',credentialsRef:'VAULT',credentialCiphertext:secret.ciphertext,credentialIv:secret.iv,credentialTag:secret.tag,permissions:ticket.permissions||{},lastCheckedAt:new Date(),lastError:null};let fb=await prisma.socialAccount.findFirst({where:{mediaIdentityId:identity.id,platform:'FACEBOOK',externalAccountId:ticket.pageId}});if(fb)fb=await prisma.socialAccount.update({where:{id:fb.id},data:{...common,name:ticket.pageName||fb.name,configuration:{pageId:ticket.pageId,tasks:ticket.tasks||[],source:'META_DISCOVERY'}}});else fb=await prisma.socialAccount.create({data:{...common,platform:'FACEBOOK',name:ticket.pageName||'Facebook',externalAccountId:ticket.pageId,configuration:{pageId:ticket.pageId,tasks:ticket.tasks||[],source:'META_DISCOVERY'}}});let ig=null;if(b.connectInstagram&&ticket.instagram?.id){ig=await prisma.socialAccount.findFirst({where:{mediaIdentityId:identity.id,platform:'INSTAGRAM',externalAccountId:ticket.instagram.id}});const igData={...common,name:ticket.instagram.name||ticket.instagram.username||`${ticket.pageName} Instagram`,externalAccountId:ticket.instagram.id,username:ticket.instagram.username||null,configuration:{pageId:ticket.pageId,instagramAccountId:ticket.instagram.id,source:'META_DISCOVERY'}};ig=ig?await prisma.socialAccount.update({where:{id:ig.id},data:igData}):await prisma.socialAccount.create({data:{...igData,platform:'INSTAGRAM'}})}await prisma.activityEvent.create({data:{type:'SOCIAL_ACCOUNT_CONNECTED',entityType:'MEDIA_IDENTITY',entityId:identity.id,title:`Meta conectado · ${ticket.pageName}`,detail:identity.name,metadata:{facebookPageId:ticket.pageId,instagramId:ticket.instagram?.id||null}}});res.status(201).json({ok:true,data:{facebook:Object.fromEntries(Object.entries(fb).filter(([k])=>!['credentialCiphertext','credentialIv','credentialTag'].includes(k))),instagram:ig?Object.fromEntries(Object.entries(ig).filter(([k])=>!['credentialCiphertext','credentialIv','credentialTag'].includes(k))):null}})}catch(e){fail(res,e,400)}});
app.post('/api/channels/:id/test',async(req,res)=>{try{const account=await prisma.socialAccount.findUnique({where:{id:req.params.id}});if(!account)return fail(res,new Error('SOCIAL_ACCOUNT_NOT_FOUND'),404);if(!['FACEBOOK','INSTAGRAM'].includes(account.platform))return fail(res,new Error('CHANNEL_TEST_NOT_SUPPORTED'),400);const result=await validateMetaAccount(account);const updated=await prisma.socialAccount.update({where:{id:account.id},data:{connectionStatus:'CONNECTED',lastCheckedAt:new Date(),lastError:null},select:socialAccountSelect});res.json({ok:true,data:{account:updated,remote:result.account}})}catch(e){await prisma.socialAccount.update({where:{id:req.params.id},data:{connectionStatus:'ERROR',lastCheckedAt:new Date(),lastError:e.message}}).catch(()=>{});fail(res,e,400)}});
app.post('/api/channels/:id/disconnect',async(req,res)=>{try{const row=await prisma.socialAccount.update({where:{id:req.params.id},data:{isActive:false,connectionStatus:'DISCONNECTED',credentialCiphertext:null,credentialIv:null,credentialTag:null,credentialsRef:null,lastCheckedAt:new Date()},select:socialAccountSelect});await prisma.activityEvent.create({data:{type:'SOCIAL_ACCOUNT_DISCONNECTED',entityType:'SOCIAL_ACCOUNT',entityId:row.id,title:`Canal desconectado · ${row.name}`,detail:row.platform}});res.json({ok:true,data:row})}catch(e){fail(res,e)}});
app.post('/api/content-pieces/:id/publish',async(req,res)=>{try{res.status(201).json({ok:true,data:await publishPiece(prisma,{pieceId:req.params.id,accountId:req.body.accountId})})}catch(e){fail(res,e)}});
app.post('/api/content-pieces/:id/schedule',async(req,res)=>{try{res.status(201).json({ok:true,data:await schedulePiece(prisma,{pieceId:req.params.id,accountId:req.body.accountId,scheduledAt:req.body.scheduledAt})})}catch(e){fail(res,e)}});
app.get('/api/publications',async(req,res)=>{try{const where=req.query.state?{contentPiece:{story:{stateBrain:{stateCode:req.query.state}}}}:{};res.json({ok:true,data:await prisma.publication.findMany({where,include:{contentPiece:{include:{story:true,mediaIdentity:true}},socialAccount:{select:socialAccountSelect}},orderBy:{createdAt:'desc'},take:250})})}catch(e){fail(res,e)}});

app.get('/api/runs',async(req,res)=>{try{res.json({ok:true,data:await prisma.discoveryRun.findMany({where:req.query.state?{stateBrain:{stateCode:req.query.state}}:{},include:{stateBrain:true},orderBy:{createdAt:'desc'},take:100})})}catch(e){fail(res,e)}});
app.get('/api/activity',async(_req,res)=>{try{res.json({ok:true,data:await prisma.activityEvent.findMany({orderBy:{createdAt:'desc'},take:200})})}catch(e){fail(res,e)}});
app.get('/api/errors',async(req,res)=>{try{const where=req.query.resolved==='false'?{resolved:false}:req.query.resolved==='true'?{resolved:true}:{};res.json({ok:true,data:await prisma.systemError.findMany({where,orderBy:{createdAt:'desc'},take:200})})}catch(e){fail(res,e)}});
app.post('/api/errors/:id/resolve',async(req,res)=>{try{res.json({ok:true,data:await prisma.systemError.update({where:{id:req.params.id},data:{resolved:true,resolvedAt:new Date()}})})}catch(e){fail(res,e)}});
app.get('/api/integrations',async(_req,res)=>{try{res.json({ok:true,data:[{id:'openai',name:'OpenAI',configured:Boolean(process.env.OPENAI_API_KEY),purpose:'Análisis, generación e imagen'},{id:'meta',name:'Meta / Facebook e Instagram',configured:Boolean(process.env.META_ACCESS_TOKEN)||socialVaultConfigured(),purpose:socialVaultConfigured()?'Conexiones administradas desde la plataforma':'Configura SOCIAL_CREDENTIALS_KEY una sola vez para guardar conexiones de forma segura'},{id:'drive',name:'Google Drive',configured:Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN),purpose:'Exportación de piezas'},{id:'telegram',name:'Telegram',configured:Boolean(process.env.TELEGRAM_BOT_TOKEN),purpose:'Operador y distribución'},{id:'postgres',name:'PostgreSQL',configured:databaseReady,purpose:'Persistencia'}]})}catch(e){fail(res,e)}});
app.get('/api/settings',async(_req,res)=>{try{res.json({ok:true,data:await prisma.appSetting.findMany({orderBy:{key:'asc'}})})}catch(e){fail(res,e)}});
app.post('/api/telegram/webhook/:secret',async(req,res)=>{try{if(!process.env.TELEGRAM_WEBHOOK_SECRET||req.params.secret!==process.env.TELEGRAM_WEBHOOK_SECRET)return res.status(403).json({ok:false});await handleTelegramUpdate(prisma,req.body);res.json({ok:true})}catch(e){fail(res,e)}});
app.put('/api/settings/:key',async(req,res)=>{try{res.json({ok:true,data:await prisma.appSetting.upsert({where:{key:req.params.key},update:{value:req.body.value,description:req.body.description},create:{key:req.params.key,value:req.body.value,description:req.body.description}})})}catch(e){fail(res,e)}});

app.use(express.static(publicDir));
app.use((_req,res)=>res.sendFile(path.join(publicDir,'index.html')));
prepareDatabase().finally(()=>{
  app.listen(port,()=>console.log(`AI Media Network v1.6.9 en puerto ${port}`));
  setInterval(()=>{if(databaseReady)processScheduled(prisma).catch(e=>console.error('Scheduled worker',e.message))},60000);
  const every=Number(process.env.AUTO_DISCOVERY_INTERVAL_MINUTES||0);
  if(every>0)setInterval(()=>{if(databaseReady)runDiscovery(prisma,process.env.AUTO_DISCOVERY_STATE||'NL',{hours:Number(process.env.AUTO_DISCOVERY_HOURS||6)}).catch(e=>console.error('Auto discovery',e.message))},every*60000);
});
process.on('SIGTERM',async()=>{await prisma.$disconnect();process.exit(0)});process.on('SIGINT',async()=>{await prisma.$disconnect();process.exit(0)});
