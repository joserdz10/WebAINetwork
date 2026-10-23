const test=require('node:test');const assert=require('node:assert/strict');
const {fitCaption}=require('../services/template-engine');
test('caption largo se ajusta completo sin puntos suspensivos',()=>{
 const title='Ricardo Monreal fija postura sobre las nuevas discusiones legislativas y explica los cambios anunciados';
 const result=fitCaption(title);
 assert.equal(result.lines.join(' '),title);
 assert.ok(result.lines.length<=4);
 assert.ok(result.fontSize>=32);
});
test('caption imposible no se trunca',()=>{
 assert.throws(()=>fitCaption('palabra'.repeat(80)),/VISUAL_CAPTION_OVERFLOW/);
});
