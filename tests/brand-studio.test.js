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

test('Manual PNG logo is preserved across all generated templates and rejects unsupported files',async()=>{
 const {normalizeLogo}=require('../services/brand-studio');
 const source=await sharp({create:{width:512,height:512,channels:4,background:{r:10,g:160,b:180,alpha:0}}}).composite([{input:Buffer.from('<svg width="512" height="512"><circle cx="256" cy="256" r="180" fill="#04CFEF"/></svg>'),left:0,top:0}]).png().toBuffer();
 const logo=await normalizeLogo('data:image/png;base64,'+source.toString('base64'));
 assert.equal((await sharp(logo).metadata()).format,'png');
 const palette=paletteFor({primary:'#142A50',secondary:'#136BDF',accent:'#38C6DE'});
 const {brandImage}=require('../services/brand-studio');
 const profile=await brandImage({name:'Prueba Visual',palette,logo},'profile');
 assert.equal((await sharp(profile).metadata()).width,1024);
 const templates=await buildTemplates({identityId:'logo-test-123',name:'Prueba Visual',palette,revision:2,logo});
 assert.equal(templates.length,5);
 for(const t of templates){
  const image=await renderTemplatePreview(t,{headline:'La comunidad presenta nuevas iniciativas para mejorar su entorno'});
  assert.equal((await sharp(image).metadata()).height,t.height);
 }
 await assert.rejects(normalizeLogo('data:image/svg+xml;base64,PHN2Zz4='),/BRAND_LOGO_FORMAT_INVALID/);
 await assert.rejects(normalizeLogo('data:image/png;base64,'+Buffer.alloc(5*1024*1024).toString('base64')),/BRAND_LOGO_TOO_LARGE/);
});

test('Transparent wide logo does not paint black padding onto brand banner',async()=>{
 const {brandImage}=require('../services/brand-studio');
 const wide=await sharp({create:{width:1000,height:200,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:Buffer.from('<svg width="1000" height="200"><rect x="150" y="50" width="700" height="100" fill="#ffffff"/></svg>'),left:0,top:0}]).png().toBuffer();
 const palette=paletteFor({primary:'#193B57',secondary:'#136BDF',accent:'#38C6DE'});
 const profile=await brandImage({name:'NotiSiete',palette,logo:wide},'profile');
 const raw=await sharp(profile).raw().toBuffer({resolveWithObject:true});
 const offset=(x,y)=>(y*raw.info.width+x)*raw.info.channels;
 // The upper part of the uploaded wide logo is transparent and must show the approved blue badge, not black.
 const i=offset(512,320);
 assert.deepEqual([...raw.data.subarray(i,i+3)],[25,59,87]);
});

test('Three compositions render consistently across all supported formats',async()=>{
 const {DESIGN_STYLES}=require('../services/brand-studio');
 const palette=paletteFor({primary:'#193B57',secondary:'#136BDF',accent:'#38C6DE'});
 const signatures=new Set();
 for(const style of DESIGN_STYLES){
  const templates=await buildTemplates({identityId:'test-style-'+style.id,name:'Noti Siete',palette,revision:1,style:style.id});
  assert.equal(templates.length,5);
  for(const t of templates){
   assert.equal(t.configuration.designStyle,style.id);
   const image=await renderTemplatePreview(t,{headline:'Se presentan nuevos proyectos de movilidad y servicios para la comunidad'});
   const m=await sharp(image).metadata();
   assert.equal(m.width,t.width);assert.equal(m.height,t.height);
  }
  signatures.add((await sharp(templates[0].baseImageData).resize(200,250).png().toBuffer()).toString('base64'));
 }
 assert.equal(signatures.size,3,'Las composiciones no deben ser solamente recoloreos');
});
