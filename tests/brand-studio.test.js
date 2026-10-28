const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {buildTemplates,brandImage,paletteFor}=require('../services/brand-studio');
const {renderTemplatePreview,selectTemplate}=require('../services/template-engine');
test('AI Brand Studio prepares 5 templates with full-size render previews',async()=>{
 const palette=paletteFor({primary:'#142A50',secondary:'#136BDF',accent:'#38C6DE'});
 const templates=await buildTemplates({identityId:'testidentity123',name:'Medio de Prueba',palette,revision:1});
 assert.equal(templates.length,5);
 for(const t of templates){
   assert.equal(t.status,'READY');assert.equal(t.isActive,false);assert.ok(t.layerMap.PHOTO);assert.ok(t.layerMap.HEADLINE);
   const png=await renderTemplatePreview(t,{headline:'Gobierno presenta un nuevo programa de atención ciudadana en la región'});
   const metadata=await sharp(png).metadata();
   assert.equal(metadata.width,t.width);assert.equal(metadata.height,t.height);
   assert.equal(selectTemplate({},t.format,[{...t,isActive:true}]).code,t.code);
 }
 const avatar=await brandImage({name:'Medio de Prueba',palette},'profile');
 const cover=await brandImage({name:'Medio de Prueba',palette},'cover');
 assert.equal((await sharp(avatar).metadata()).width,1024);
 assert.equal((await sharp(cover).metadata()).width,1640);
});
test('Brand template rejects headline that cannot fit without truncation',async()=>{
 const [template]=await buildTemplates({identityId:'testidentity456',name:'Noticias del Día',palette:paletteFor(),revision:1});
 await assert.rejects(renderTemplatePreview(template,{headline:Array(100).fill('Una noticia extremadamente extensa').join(' ')}),/VISUAL_TEXT_OVERFLOW_HEADLINE/);
});
