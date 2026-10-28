const test=require('node:test');
const assert=require('node:assert/strict');
const {config,DEFAULTS,scheduleCycle,enqueue}=require('../services/editorial-automation');
test('automation defaults honor human approval and 30 minute cycles',()=>{
 const x=config({});
 assert.equal(x.enabled,true);
 assert.equal(x.intervalMinutes,30);
 assert.equal(x.maxPiecesPerIdentity,6);
 assert.equal(x.concurrency,2);
 assert.equal(x.notifyTelegram,true);
 assert.equal(x.requireApproval,true);
 assert.equal(DEFAULTS.requireApproval,true);
});
test('automation configuration clamps oversized worker and volume settings',()=>{
 const x=config({concurrency:500,globalCycleLimit:10000,maxPiecesPerIdentity:400,intervalMinutes:0,requireApproval:false});
 assert.equal(x.concurrency,4);
 assert.equal(x.globalCycleLimit,200);
 assert.equal(x.maxPiecesPerIdentity,20);
 assert.equal(x.intervalMinutes,5);
 assert.equal(x.requireApproval,true);
});
test('discovery jobs are unique per state and time window',async()=>{
 const scheduled=new Map();
 const prisma={
 stateBrain:{findMany:async()=>[{stateCode:'NL',id:'n'},{stateCode:'SON',id:'s'}]},
 editorialJob:{upsert:async({where,create})=>{
   if(!scheduled.has(where.dedupeKey))scheduled.set(where.dedupeKey,create);
   return scheduled.get(where.dedupeKey);
 }}
 };
 await scheduleCycle(prisma,config({}),new Date('2026-10-28T00:04:00Z'));
 await scheduleCycle(prisma,config({}),new Date('2026-10-28T00:19:00Z'));
 assert.equal(scheduled.size,2);
 await scheduleCycle(prisma,config({}),new Date('2026-10-28T00:31:00Z'));
 assert.equal(scheduled.size,4);
});
test('queue enqueue dedupe keys are unchanged when jobs already exist',async()=>{
 const jobs=new Map();const prisma={editorialJob:{upsert:async({where,create})=>{
 if(!jobs.has(where.dedupeKey))jobs.set(where.dedupeKey,create);return jobs.get(where.dedupeKey);
 }}};
 await enqueue(prisma,{key:'a',kind:'DISCOVERY',stateCode:'NL'});
 await enqueue(prisma,{key:'a',kind:'DISCOVERY',stateCode:'NL'});
 assert.equal(jobs.size,1);
});
