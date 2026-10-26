const test=require('node:test');
const assert=require('node:assert/strict');
const {RECOMMENDATIONS,sourceKey,previewSources}=require('../services/source-recommendations');

test('Sonora catalog contains 12 sources and no duplicated hosts',()=>{
  assert.equal(RECOMMENDATIONS.SON.length,12);
  const hosts=RECOMMENDATIONS.SON.map(sourceKey);
  assert.equal(new Set(hosts).size,hosts.length);
});

test('recommended import preview does not duplicate manually entered domains',()=>{
  const items=previewSources('SON',[{name:'Mi captura manual',url:'https://www.proyectopuente.com.mx/noticias'},{domain:'tribuna.com.mx'}]);
  assert.equal(items.length,12);
  assert.equal(items.filter(x=>x.status==='EXISTING').length,2);
  assert.equal(items.find(x=>x.name==='Proyecto Puente').status,'EXISTING');
  assert.equal(items.find(x=>x.name==='Tribuna').status,'EXISTING');
});

test('unconfigured state has no recommendations',()=>{
  assert.deepEqual(previewSources('NL',[]),[]);
});
