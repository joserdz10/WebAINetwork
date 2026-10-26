const test=require('node:test');
const assert=require('node:assert/strict');
const {STATES,getState}=require('../services/state-catalog');

test('catalog includes 32 unique Mexican entities',()=>{
  assert.equal(STATES.length,32);
  assert.equal(new Set(STATES.map(row=>row[0])).size,32);
  assert.equal(new Set(STATES.map(row=>row[2])).size,32);
});

test('catalog resolves the current priority states',()=>{
  assert.equal(getState('NL').name,'Nuevo León');
  assert.equal(getState('HGO').name,'Hidalgo');
  assert.equal(getState('COL').name,'Colima');
  assert.equal(getState('son').name,'Sonora');
  assert.equal(getState('invalid'),null);
});
