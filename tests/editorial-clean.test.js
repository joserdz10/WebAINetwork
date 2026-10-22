const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cleanEditorialText}=require('../services/editorial-clean');
test('removes glued section labels',()=>{
 assert.equal(cleanEditorialText('GlobalDeclaran culpable a joven'),'Declaran culpable a joven');
 assert.equal(cleanEditorialText('NacionalAutoridades informan'),'Autoridades informan');
 assert.equal(cleanEditorialText('GlobalDeclaran culpable a joven al estrellar su auto'),'Declaran culpable a joven al estrellar su auto');
});
test('preserves legitimate headlines',()=>{
 assert.equal(cleanEditorialText('Globalización y economía en México'),'Globalización y economía en México');
 assert.equal(cleanEditorialText('Global anuncia nuevas medidas'),'Global anuncia nuevas medidas');
 assert.equal(cleanEditorialText('Declaran culpable a joven'),'Declaran culpable a joven');
});
