const test=require('node:test');
const assert=require('node:assert/strict');
const {parseCandidates,privateIP,discoverStateSources}=require('../services/source-auto-discovery');
test('reject private network addresses',()=>{
 assert.equal(privateIP('127.0.0.1'),true);
 assert.equal(privateIP('10.1.2.3'),true);
 assert.equal(privateIP('192.168.1.1'),true);
 assert.equal(privateIP('8.8.8.8'),false);
});
test('parse source search results',()=>{
 const result=parseCandidates('{"sources":[{"name":"Medio","url":"https://medio.mx","region":"Hermosillo"}]}');
 assert.equal(result.length,1);
});
test('keep existing sources; stage new results inactive',async()=>{
 const saved=[];
 const prisma={
  stateBrain:{findFirst:async()=>({id:'son',name:'Sonora'})},
  source:{findMany:async()=>[{url:'https://www.expreso.com.mx/'}],create:async({data})=>{saved.push(data);return{id:'new',...data}}}
 };
 const report=await discoverStateSources(prisma,'SON',{
  search:async()=>[{name:'Expreso',url:'https://expreso.com.mx/'},{name:'Medio de prueba',url:'https://prueba.mx/'}],
  verify:async()=>({finalUrl:'https://prueba.mx/',rssUrl:null,title:'Medio de prueba'})
 });
 assert.equal(report.skipped.length,1);
 assert.equal(report.added.length,1);
 assert.equal(saved[0].isActive,false);
 assert.equal(saved[0].configuration.verification,'REVIEW_PENDING');
});
