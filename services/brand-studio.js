const sharp=require('sharp');
const {callAI,hasAI}=require('./ai');
const {renderTemplatePreview}=require('./template-engine');
const FORMATS=[
 {key:'FACEBOOK_POST',label:'Facebook feed 4:5',width:1080,height:1350,kind:'feed'},
 {key:'INSTAGRAM_POST',label:'Instagram feed 4:5',width:1080,height:1350,kind:'feed'},
 {key:'FACEBOOK_STORY',label:'Facebook story 9:16',width:1080,height:1920,kind:'story'},
 {key:'INSTAGRAM_STORY',label:'Instagram story 9:16',width:1080,height:1920,kind:'story'},
 {key:'EDITORIAL_GRAPHIC',label:'Editorial horizontal 16:9',width:1920,height:1080,kind:'wide'}
];
const DESIGN_STYLES=[
 {id:'IMPACTO',name:'Impacto',description:'Fotografía protagonista, titular contundente y bloques diagonales'},
 {id:'REVISTA',name:'Revista',description:'Fotografía enmarcada, editorial elegante y numeración decorativa'},
 {id:'PULSO',name:'Pulso',description:'Diseño urbano con paneles asimétricos y acentos geométricos'}
];
function checkedStyle(id){return DESIGN_STYLES.some(x=>x.id===id)?id:'IMPACTO'}
function escapeXml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function color(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toUpperCase():fallback}
function cleanName(name){const s=String(name||'').trim().replace(/\s+/g,' ');if(s.length<2||s.length>70)throw new Error('BRAND_NAME_LENGTH_INVALID');return s}
function initials(name){return cleanName(name).split(' ').filter(x=>!['DE','DEL','LA','EL','LOS','LAS','Y'].includes(x.toUpperCase())).slice(0,2).map(x=>x[0]).join('').toUpperCase().slice(0,2)}
function paletteFor(value={}){
 const p=value||{};
 return {primary:color(p.primary,'#13213B'),secondary:color(p.secondary,'#1672D3'),accent:color(p.accent,'#22B8CF'),background:color(p.background,'#F6F8FB'),text:color(p.text,'#13213B')};
}
function luminance(hex){
 const rgb=[1,3,5].map(x=>parseInt(hex.slice(x,x+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function assertBrandContrast(p){
 if(contrast(p.text,p.background)<4.5)throw new Error('BRAND_CONTRAST_INVALID: texto y fondo requieren contraste de al menos 4.5:1');
 if(contrast('#FFFFFF',p.primary)<4.5)throw new Error('BRAND_CONTRAST_INVALID: el color principal debe contrastar con los textos blancos de la cabecera');
}
async function normalizeLogo(data){
 if(!data)return null;
 if(typeof data!=='string'||data.length>8*1024*1024)throw new Error('BRAND_LOGO_TOO_LARGE');
 const match=data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
 if(!match)throw new Error('BRAND_LOGO_FORMAT_INVALID: usa PNG, JPG o WebP');
 const input=Buffer.from(match[2],'base64');
 if(!input.length||input.length>4*1024*1024)throw new Error('BRAND_LOGO_TOO_LARGE: máximo 4 MB');
 const image=sharp(input,{limitInputPixels:16000000});
 const metadata=await image.metadata();
 if(!['png','jpeg','webp'].includes(metadata.format)||metadata.width<128||metadata.height<128||metadata.width>4096||metadata.height>4096)throw new Error('BRAND_LOGO_DIMENSIONS_INVALID');
 return image.rotate().ensureAlpha().resize(1024,1024,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
}
async function addLogo(base,logo,{x,y,width,height,padding=0}){
 if(!logo)return base;
 const mark=await sharp(logo).resize(Math.max(1,width-2*padding),Math.max(1,height-2*padding),{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
 const info=await sharp(mark).metadata();
 const left=Math.round(x+(width-info.width)/2),top=Math.round(y+(height-info.height)/2);
 return sharp(base).composite([{input:mark,left,top}]).png().toBuffer();
}
function svg(width,height,content){return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`)}
function brandLines(name,maxChars=31){
 const words=cleanName(name).split(' '),lines=[];let line='';
 for(const word of words){
  if(word.length>maxChars)throw new Error('BRAND_NAME_UNBROKEN_WORD_TOO_LONG');
  if((line?line.length+1:0)+word.length>maxChars){lines.push(line);line=word}
  else line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 if(lines.length>2)throw new Error('BRAND_NAME_TOO_LONG_FOR_HEADER');
 return lines;
}
function brandHeader({width,height,name,palette,kind}){
 const lines=brandLines(name,40),font=lines.length===1?36:29;
 const startY=lines.length===1?91:72;
 return `<rect x="0" y="0" width="${width}" height="${kind==='wide'?140:150}" fill="${palette.primary}"/><rect x="0" y="${kind==='wide'?132:142}" width="${width}" height="8" fill="${palette.accent}"/>
 <rect x="55" y="36" rx="17" width="76" height="76" fill="${palette.accent}"/>
 <text x="93" y="90" font-family="DejaVu Sans" font-size="34" font-weight="700" fill="${palette.primary}" text-anchor="middle">${escapeXml(initials(name))}</text>
 ${lines.map((line,i)=>`<text x="160" y="${startY+i*36}" font-family="DejaVu Sans" font-size="${font}" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`).join('')}`;
}
function layout(kind,width,height,style='IMPACTO'){
 const s=checkedStyle(style),m=60;
 const field=(x,y,w,h,fontSize,maxLines)=>({x,y,width:w,height:h,fontSize,maxLines});
 if(kind==='wide'){
  if(s==='REVISTA')return {photo:{x:80,y:200,width:910,height:750},category:field(1050,240,790,55,30,1),headline:field(1050,345,790,360,62,5),summary:field(1050,755,790,120,24,3),source:field(1050,970,790,35,17,1)};
  if(s==='PULSO')return {photo:{x:0,y:140,width:1100,height:940},category:field(1160,210,690,50,30,1),headline:field(1160,305,690,440,63,6),summary:field(1160,770,690,116,24,3),source:field(1160,970,690,38,17,1)};
  return {photo:{x:0,y:140,width:990,height:940},category:field(1050,220,800,50,30,1),headline:field(1050,320,800,390,65,5),summary:field(1050,760,800,115,24,3),source:field(1050,965,800,40,17,1)};
 }
 if(kind==='story'){
  if(s==='REVISTA')return {photo:{x:65,y:195,width:950,height:900},category:field(80,1160,920,45,28,1),headline:field(80,1250,920,360,61,5),summary:field(80,1640,920,118,24,3),source:field(80,1810,920,36,17,1)};
  if(s==='PULSO')return {photo:{x:0,y:150,width:1080,height:1040},category:field(70,1225,940,45,30,1),headline:field(70,1290,940,340,60,5),summary:field(70,1665,940,100,24,3),source:field(70,1822,940,36,17,1)};
  return {photo:{x:0,y:150,width:1080,height:1020},category:field(m,1210,960,40,29,1),headline:field(m,1280,960,335,61,5),summary:field(m,1650,960,115,25,3),source:field(m,1815,960,38,17,1)};
 }
 if(s==='REVISTA')return {photo:{x:65,y:210,width:950,height:535},category:field(80,792,920,45,27,1),headline:field(80,850,920,275,58,4),summary:field(80,1145,920,105,24,2),source:field(80,1278,920,36,17,1)};
 if(s==='PULSO')return {photo:{x:0,y:150,width:1080,height:625},category:field(70,799,940,45,27,1),headline:field(70,862,940,265,58,4),summary:field(70,1151,940,100,23,2),source:field(70,1275,940,35,17,1)};
 return {photo:{x:0,y:150,width:1080,height:590},category:field(m,780,960,43,28,1),headline:field(m,847,960,280,59,4),summary:field(m,1145,960,100,24,2),source:field(m,1275,960,34,17,1)};
}
function layerMapFor(kind,width,height,palette,style='IMPACTO'){
 const p=layout(kind,width,height,style);
 const t=(field,b,col)=>({x:b.x,y:b.y,width:b.width,height:b.height,fontSize:b.fontSize,fontWeight:field==='HEADLINE'?700:600,maxLines:b.maxLines||1,color:col,fontFamily:checkedStyle(style)==='REVISTA'&&field==='HEADLINE'?'DejaVu Serif':'DejaVu Sans'});
 return {PHOTO:{left:p.photo.x,top:p.photo.y,width:p.photo.width,height:p.photo.height,fit:'cover'},
 CATEGORY:t('CATEGORY',p.category,palette.secondary),HEADLINE:t('HEADLINE',p.headline,palette.text),
 SUMMARY:t('SUMMARY',p.summary,palette.text),SOURCE:t('SOURCE',p.source,palette.text)};
}
function decorations({width,height,kind,palette,style}){
 const p=palette,s=checkedStyle(style),l=layout(kind,width,height,s);
 const below=l.photo.y+l.photo.height;
 if(s==='REVISTA'){
  const corner=kind==='wide'?{x:70,y:188,w:930,h:775}:{x:l.photo.x-12,y:l.photo.y-12,w:l.photo.width+24,h:l.photo.height+24};
  return `<rect x="${corner.x}" y="${corner.y}" width="${corner.w}" height="${corner.h}" fill="none" stroke="${p.accent}" stroke-width="6"/>
  <rect x="${width-175}" y="${kind==='wide'?175:below+28}" width="110" height="17" fill="${p.accent}"/>
  <text x="${width-85}" y="${height-47}" fill="${p.secondary}" font-family="DejaVu Serif" font-size="40" font-weight="700" text-anchor="end">07</text>`;
 }
 if(s==='PULSO'){
  const y=kind==='wide'?height-110:below;
  return `<path d="M0 ${y} L${Math.round(width*.16)} ${y} L${Math.round(width*.2)} ${y+25} L${Math.round(width*.7)} ${y+25} L${Math.round(width*.75)} ${y} L${width} ${y}" fill="none" stroke="${p.accent}" stroke-width="13"/>
  <rect x="${width-40}" y="${kind==='wide'?180:below+58}" width="17" height="155" fill="${p.secondary}"/>
  <path d="M0 ${height-40} L${Math.round(width*.42)} ${height-40} L${Math.round(width*.45)} ${height-18} L0 ${height-18} Z" fill="${p.accent}"/>`;
 }
 return `<path d="M0 ${below} L${Math.round(width*.18)} ${below} L${Math.round(width*.22)} ${below+17} L${Math.round(width*.55)} ${below+17}" fill="none" stroke="${p.accent}" stroke-width="11"/>
 <rect x="${width-28}" y="${kind==='wide'?210:below+43}" width="13" height="145" fill="${p.accent}"/>`;
}

async function backgroundFor({name,palette,kind,width,height,logo,style='IMPACTO'}){
 const p=palette;
 const rects=`<rect width="${width}" height="${height}" fill="${p.background}"/>${kind==='wide'?'<rect x="960" y="140" width="960" height="940" fill="#ffffff"/>':''}<rect x="0" y="${height-28}" width="${width}" height="28" fill="${p.primary}"/><rect x="0" y="${height-33}" width="${width}" height="5" fill="${p.accent}"/>`;
 const buffer=svg(width,height,rects+decorations({width,height,kind,palette,style})+brandHeader({name,width,height,palette,kind}));
 const base=await sharp(buffer).png().toBuffer();
 if(!logo)return base;
 // Replace the monogram badge, without touching the editable photo and text regions.
 const patch=svg(width,height,`<rect x="43" y="25" rx="15" width="100" height="102" fill="${palette.primary}"/>`);
 const cleared=await sharp(base).composite([{input:patch,left:0,top:0}]).png().toBuffer();
 return addLogo(cleared,logo,{x:43,y:25,width:100,height:102,padding:5});
}
function brandImageSvg({name,palette,variant}){
 const p=palette,abbr=initials(name),lines=brandLines(name,40);
 if(variant==='profile')return svg(1024,1024,`<rect width="1024" height="1024" rx="185" fill="${p.primary}"/><circle cx="512" cy="490" r="327" fill="${p.secondary}" opacity=".45"/><rect x="230" y="250" width="564" height="450" rx="95" fill="${p.accent}"/><text x="512" y="570" text-anchor="middle" fill="${p.primary}" font-family="DejaVu Sans" font-weight="700" font-size="${abbr.length===1?350:260}">${escapeXml(abbr)}</text><rect x="300" y="767" width="424" height="13" rx="6" fill="${p.accent}"/>`);
 return svg(1640,624,`<rect width="1640" height="624" fill="${p.primary}"/><rect x="0" y="570" width="1640" height="54" fill="${p.accent}"/><circle cx="255" cy="305" r="195" fill="${p.secondary}" opacity=".55"/><text x="255" y="375" text-anchor="middle" font-family="DejaVu Sans" fill="#ffffff" font-size="174" font-weight="700">${escapeXml(abbr)}</text>${lines.map((line,i)=>`<text x="505" y="${lines.length===1?305:270+i*65}" font-family="DejaVu Sans" font-size="40" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`).join('')}<text x="510" y="435" font-family="DejaVu Sans" font-size="32" fill="${p.accent}">INFORMACIÓN VERIFICABLE</text>`);
}
async function brandImage(data,variant){
 const base=await sharp(brandImageSvg({...data,variant})).png().toBuffer();
 if(!data.logo)return base;
 // Opaque brand badge prevents the placeholder initials appearing behind a transparent uploaded logo.
 const badge=variant==='profile'?{x:230,y:250,width:564,height:450,padding:20}:{x:65,y:113,width:380,height:380,padding:20};
 const cover=Buffer.from(`<svg width="${variant==='profile'?1024:1640}" height="${variant==='profile'?1024:624}" xmlns="http://www.w3.org/2000/svg"><rect x="${badge.x}" y="${badge.y}" rx="40" width="${badge.width}" height="${badge.height}" fill="${data.palette.primary}"/></svg>`);
 const cleared=await sharp(base).composite([{input:cover,left:0,top:0}]).png().toBuffer();
 return addLogo(cleared,data.logo,badge);
}
async function design({name,existingPalette={},focus='' }){
 const cleaned=cleanName(name);const defaults=paletteFor(existingPalette);
 if(!hasAI())return{name:cleaned,palette:defaults,style:'Editorial contemporáneo',generatedBy:'BASE',notice:'Propuesta basada en colores actuales; IA no configurada.'};
 const response=await callAI({system:'Eres diseñador de identidad de un medio informativo. Propón colores únicos y legibles, sin afirmar que hayas inspeccionado una página o logo real. Política editorial neutral. Responde JSON estricto con HEX de seis dígitos.',input:JSON.stringify({name:cleaned,focus,existingPalette:defaults}),jsonSchema:{name:'brand_draft',schema:{type:'object',additionalProperties:false,required:['primary','secondary','accent','style'],properties:{primary:{type:'string'},secondary:{type:'string'},accent:{type:'string'},style:{type:'string'}}}}});
 return{name:cleaned,palette:paletteFor({...defaults,...response}),style:String(response.style).slice(0,160),generatedBy:'AI',notice:'Identidad gráfica propuesta; el logo tipográfico y los fondos se construyen de modo reproducible.'};
}
async function buildTemplates({identityId,name,palette,revision,logo=null,style='IMPACTO'}){
 // Validate contrast and both permanent brand assets before any template can become active.
 assertBrandContrast(palette);
 await brandImage({name,palette,logo},'profile');
 await brandImage({name,palette,logo},'cover');
 const definitions=[];
 for(const fmt of FORMATS){
  const code=`BRAND_${identityId.replace(/[^a-z0-9]/gi,'').slice(0,20).toUpperCase()}_${fmt.key}_V${revision}`;
  const base=await backgroundFor({...fmt,name,palette,logo,style});
  const template={code,name:`${name} · ${fmt.label} · v${revision}`,mediaIdentityId:identityId,renderer:'GENERIC_LAYERED',sourceType:'BUILT_IN',format:fmt.key,status:'READY',isActive:false,width:fmt.width,height:fmt.height,version:revision,baseImageMimeType:'image/png',baseImageData:base,layerMap:layerMapFor(fmt.kind,fmt.width,fmt.height,palette,style),configuration:{brandStudio:true,designStyle:checkedStyle(style),brandPalette:palette,revision,compatibleFormats:[fmt.key],requiresRealPhoto:true}};
  // Render full-size samples, using the same runtime code as the publishing pipeline.
  for(const text of ['Así se verá una noticia comprobada de la región','Autoridades informaron sobre medidas para mejorar los servicios públicos de la región durante esta semana']){
   const image=await renderTemplatePreview(template,{headline:text,summary:'Información verificada, con contexto y fuente consultable.',category:'ACTUALIDAD',source:'Medio de prueba'});
   const metadata=await sharp(image).metadata();
   if(metadata.width!==fmt.width||metadata.height!==fmt.height)throw new Error(`BRAND_PREVIEW_DIMENSIONS_INVALID_${fmt.key}`);
  }
  definitions.push(template);
 }
 return definitions;
}
module.exports={FORMATS,DESIGN_STYLES,checkedStyle,paletteFor,design,brandImage,buildTemplates,normalizeLogo};
