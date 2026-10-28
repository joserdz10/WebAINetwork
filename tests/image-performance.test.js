const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
test('Image previews are smaller and keep the intended aspect ratio',async()=>{
 const width=1080,height=1350;
 const original=await sharp({create:{width,height,channels:3,background:{r:20,g:80,b:160}}}).png().toBuffer();
 const preview=await sharp(original).resize({width:520,withoutEnlargement:true}).webp({quality:80,effort:3}).toBuffer();
 const m=await sharp(preview).metadata();
 assert.equal(m.format,'webp');
 assert.equal(m.width,520);
 assert.equal(m.height,650);
 assert.ok(preview.length<original.length);
 const sourceMetadata=await sharp(original).metadata();
 assert.equal(sourceMetadata.width,1080);
 assert.equal(sourceMetadata.height,1350);
});
