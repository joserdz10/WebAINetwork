const assert=require('node:assert/strict');
const test=require('node:test');
const sharp=require('sharp');
const {renderTemplate}=require('../services/template-engine');

test('NEA 4:5 renders Spanish accents without silently missing fonts',async()=>{
 const photo=await sharp({create:{width:1080,height:600,channels:3,background:'#879a9b'}}).png().toBuffer();
 const data={photo:`data:image/png;base64,${photo.toString('base64')}`,headline:'Nuevo León: lluvias y movilidad en el área metropolitana',category:'INFORMACIÓN PÚBLICA',summary:'Autoridades informaron cambios en la circulación. Revisión y actualización de información.',source:'Fuente: Gobierno de Nuevo León'};
 const template={renderer:'NEA_FEED_4X5'};
 const png=await renderTemplate(template,data);
 const info=await sharp(png).metadata();
 assert.equal(info.width,1080);assert.equal(info.height,1350);assert.equal(info.format,'png');
 const other=await renderTemplate(template,{...data,headline:'Una noticia totalmente distinta'});
 assert.notDeepEqual(png,other,'headline should affect rendered image');
});
test('refuses empty editorial fields',async()=>{
 await assert.rejects(renderTemplate({renderer:'NEA_FEED_4X5'},{photo:'invalid',headline:'X',category:'Y',summary:'',source:'Z'}),/SUMMARY_REQUIRED/);
});
