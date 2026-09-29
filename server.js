const express = require('express');
const path = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const { seedDatabase } = require('./packages/database/prisma/seed');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const prisma = new PrismaClient();
const hasDatabase = Boolean(process.env.DATABASE_URL);
let databaseReady = false;

app.use(express.json({ limit: '2mb' }));

async function prepareDatabase() {
  if (!hasDatabase) {
    console.warn('DATABASE_URL no configurada. La interfaz seguirá disponible y la API reportará modo demostración.');
    return;
  }
  try {
    execSync('npx prisma db push --schema=packages/database/prisma/schema.prisma', { cwd: __dirname, stdio: 'inherit' });
    const count = await prisma.country.count();
    if (count === 0) await seedDatabase();
    databaseReady = true;
    console.log('PostgreSQL listo.');
  } catch (error) {
    console.error('No se pudo preparar PostgreSQL:', error.message);
  }
}

function apiError(res, error) {
  console.error(error);
  res.status(500).json({ ok:false, error:'INTERNAL_ERROR', message:'Error interno del servidor.' });
}

app.get('/api/health', async (_req,res) => {
  let db = false;
  if (databaseReady) {
    try { await prisma.$queryRaw`SELECT 1`; db = true; } catch {}
  }
  res.json({ ok:true, version:'0.2.0', databaseConfigured:hasDatabase, databaseReady:db, timestamp:new Date().toISOString() });
});

app.use('/api', (req,res,next) => {
  if (!databaseReady) return res.status(503).json({ ok:false, error:'DATABASE_NOT_READY', message:'Configura DATABASE_URL en Railway para activar los datos reales.' });
  next();
});

app.get('/api/dashboard', async (req,res) => {
  try {
    const stateCode = req.query.state || 'NL';
    const state = await prisma.stateBrain.findFirst({ where:{ stateCode }, include:{ identities:true } });
    if (!state) return res.status(404).json({ok:false,error:'STATE_NOT_FOUND'});
    const [stateBrains, identities, sources, watches, stories24h, publications24h, topics, profiles, runs] = await Promise.all([
      prisma.stateBrain.count(),
      prisma.mediaIdentity.count(),
      prisma.source.count({where:{isActive:true}}),
      prisma.watch.count({where:{isActive:true}}),
      prisma.story.count({where:{detectedAt:{gte:new Date(Date.now()-24*60*60*1000)}}}),
      prisma.publication.count({where:{publishedAt:{gte:new Date(Date.now()-24*60*60*1000)}}}),
      prisma.topic.count({where:{stateBrainId:state.id}}),
      prisma.profile.count({where:{stateBrainId:state.id}}),
      prisma.discoveryRun.findMany({where:{stateBrainId:state.id},orderBy:{createdAt:'desc'},take:3})
    ]);
    const stories = await prisma.story.findMany({
      where:{stateBrainId:state.id}, orderBy:[{priority:'desc'},{detectedAt:'desc'}], take:8,
      include:{ _count:{select:{sources:true}}, contentPieces:{take:1,include:{mediaIdentity:true}} }
    });
    res.json({
      ok:true,
      state:{id:state.id,name:state.name,stateCode:state.stateCode,status:state.status},
      kpis:{stateBrains,identities,sources,watches,stories24h,publications24h,topics,profiles},
      stories:stories.map(s=>({publicId:s.publicId,title:s.title,status:s.status,priority:s.priority,confidence:s.confidence,detectedAt:s.detectedAt,sourceCount:s._count.sources,identity:s.contentPieces[0]?.mediaIdentity?.name||null})),
      runs
    });
  } catch (e) { apiError(res,e); }
});

app.get('/api/states', async (_req,res) => {
  try { res.json({ok:true,data:await prisma.stateBrain.findMany({include:{_count:{select:{identities:true,sources:true,topics:true,stories:true}}},orderBy:{name:'asc'}})}); }
  catch(e){apiError(res,e)}
});
app.get('/api/identities', async (req,res) => {
  try {
    const where = req.query.state ? {stateBrain:{stateCode:req.query.state}} : {};
    res.json({ok:true,data:await prisma.mediaIdentity.findMany({where,include:{stateBrain:true,mediaDNA:true,socialAccounts:true},orderBy:{name:'asc'}})});
  } catch(e){apiError(res,e)}
});
app.get('/api/topics', async (req,res) => {
  try { const where=req.query.state?{stateBrain:{stateCode:req.query.state}}:{}; res.json({ok:true,data:await prisma.topic.findMany({where,include:{_count:{select:{storyLinks:true}}},orderBy:[{priority:'desc'},{name:'asc'}]})}); }
  catch(e){apiError(res,e)}
});
app.get('/api/profiles', async (req,res) => {
  try { const where=req.query.state?{stateBrain:{stateCode:req.query.state}}:{}; res.json({ok:true,data:await prisma.profile.findMany({where,include:{_count:{select:{storyLinks:true}}},orderBy:{name:'asc'}})}); }
  catch(e){apiError(res,e)}
});
app.get('/api/watches', async (req,res) => {
  try { const where=req.query.state?{stateBrain:{stateCode:req.query.state}}:{}; res.json({ok:true,data:await prisma.watch.findMany({where,orderBy:[{isActive:'desc'},{priority:'desc'}]})}); }
  catch(e){apiError(res,e)}
});
app.get('/api/sources', async (req,res) => {
  try { const where=req.query.state?{stateBrain:{stateCode:req.query.state}}:{}; res.json({ok:true,data:await prisma.source.findMany({where,orderBy:[{isActive:'desc'},{name:'asc'}]})}); }
  catch(e){apiError(res,e)}
});
app.get('/api/stories', async (req,res) => {
  try {
    const where = {};
    if (req.query.state) where.stateBrain = {stateCode:req.query.state};
    if (req.query.status) where.status = req.query.status;
    const data = await prisma.story.findMany({
      where,orderBy:{detectedAt:'desc'},take:100,
      include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}},contentPieces:{include:{mediaIdentity:true,publications:true}}}
    });
    res.json({ok:true,data});
  } catch(e){apiError(res,e)}
});
app.get('/api/stories/:publicId', async (req,res) => {
  try {
    const publicId = Number(req.params.publicId);
    if (!Number.isInteger(publicId)) return res.status(400).json({ok:false,error:'INVALID_STORY_ID'});
    const story = await prisma.story.findUnique({where:{publicId},include:{stateBrain:true,sources:{include:{source:true}},topics:{include:{topic:true}},profiles:{include:{profile:true}},contentPieces:{include:{mediaIdentity:true,publications:{include:{socialAccount:true}}}}}});
    if (!story) return res.status(404).json({ok:false,error:'STORY_NOT_FOUND'});
    res.json({ok:true,data:story});
  } catch(e){apiError(res,e)}
});
app.post('/api/stories', async (req,res) => {
  try {
    const { stateCode='NL', title, summary, priority='NORMAL', status='DISCOVERED', confidence } = req.body || {};
    if (!title || title.trim().length < 5) return res.status(400).json({ok:false,error:'TITLE_REQUIRED'});
    const state = await prisma.stateBrain.findFirst({where:{stateCode}});
    if (!state) return res.status(404).json({ok:false,error:'STATE_NOT_FOUND'});
    const story = await prisma.story.create({data:{stateBrainId:state.id,title:title.trim(),summary,priority,status,confidence}});
    res.status(201).json({ok:true,data:story});
  } catch(e){apiError(res,e)}
});
app.patch('/api/stories/:publicId/status', async (req,res) => {
  try {
    const publicId = Number(req.params.publicId);
    const status = req.body?.status;
    const valid = ['DISCOVERED','ANALYZING','READY','GENERATING','CONTENT_READY','APPROVED','PUBLISHED','REJECTED','ARCHIVED'];
    if (!valid.includes(status)) return res.status(400).json({ok:false,error:'INVALID_STATUS'});
    const story = await prisma.story.update({where:{publicId},data:{status,readyAt:status==='READY'?new Date():undefined,publishedAt:status==='PUBLISHED'?new Date():undefined}});
    res.json({ok:true,data:story});
  } catch(e){apiError(res,e)}
});
app.get('/api/publications', async (_req,res) => {
  try {res.json({ok:true,data:await prisma.publication.findMany({include:{contentPiece:{include:{story:true,mediaIdentity:true}},socialAccount:true},orderBy:{createdAt:'desc'},take:100})});}
  catch(e){apiError(res,e)}
});
app.get('/api/runs', async (req,res) => {
  try {const where=req.query.state?{stateBrain:{stateCode:req.query.state}}:{};res.json({ok:true,data:await prisma.discoveryRun.findMany({where,include:{stateBrain:true},orderBy:{createdAt:'desc'},take:100})});}
  catch(e){apiError(res,e)}
});

app.use(express.static(publicDir));
app.use((_req,res) => res.sendFile(path.join(publicDir,'index.html')));

prepareDatabase().finally(() => {
  app.listen(port, () => console.log(`AI Media Network v0.2.0 en puerto ${port}`));
});

process.on('SIGTERM', async()=>{ await prisma.$disconnect(); process.exit(0); });
process.on('SIGINT', async()=>{ await prisma.$disconnect(); process.exit(0); });
