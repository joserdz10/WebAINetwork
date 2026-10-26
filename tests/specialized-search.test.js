const test=require('node:test');
const assert=require('node:assert/strict');
const {validateSearch,matchText,parseWebSources,specializedSearch}=require('../services/specialized-search');
test('validates search scope for any registered state and Mexico',()=>{
 assert.equal(validateSearch({query:'Alfonso Durazo',scope:'SON'}).hours,168);
 assert.equal(validateSearch({query:'Seguridad',scope:'MX',type:'TOPIC',hours:720}).scope,'MX');
 assert.throws(()=>validateSearch({query:'ab',scope:'SON'}));
 assert.throws(()=>validateSearch({query:'Seguridad',scope:'SON',hours:11}));
});
test('normalizes accents and matches all words',()=>{
 assert.equal(matchText({title:'Seguridad pública en Cajeme'},'seguridad publica'),true);
 assert.equal(matchText({title:'Economía en Sonora'},'seguridad publica'),false);
});
test('parses web citations only as reviewable results',()=>{
 assert.equal(parseWebSources('{"results":[{"title":"Una noticia verificable sobre seguridad","url":"https://medio.mx/nota"}]}').length,1);
});
test('search is isolated by state and does not call external web by default',async()=>{
 const calls=[];
 const prisma={
  stateBrain:{findFirst:async()=>({id:'son',name:'Sonora'})},
  discoveryCandidate:{findMany:async arg=>{calls.push(arg);return [{id:'a',title:'Seguridad pública en Cajeme',url:'https://medio.mx/seguridad',excerpt:'',status:'LOW_RELEVANCE',relevanceScore:.4,source:{name:'Medio'},discoveryRun:{stateBrain:{stateCode:'SON'}}}];}}
 };
 const result=await specializedSearch(prisma,{query:'Seguridad pública',scope:'SON',type:'TOPIC'},{
  searchWeb:async()=>{throw Error('Should not search web')}
 });
 assert.equal(result.localCount,1);
 assert.equal(result.results[0].status,'LOW_RELEVANCE');
 assert.equal(calls[0].where.discoveryRun.stateBrain.stateCode,'SON');
});
