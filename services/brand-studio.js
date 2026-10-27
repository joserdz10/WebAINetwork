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
function escapeXml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function color(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toUpperCase():fallback}
function cleanName(name){const s=String(name||'').trim().replace(/\s+/g,' ');if(s.length<2||s.length>70)throw new Error('BRAND_NAME_LENGTH_INVALID');return s}
function initials(name){return cleanName(name).split(' ').filter(x=>!['DE','DEL','LA','EL','LOS','LAS','Y'].includes(x.toUpperCase())).slice(0,2).map(x=>x[0]).join('').toUpperCase().slice(0,2)}
function paletteFor(value={}){
 const p=value||{};
 return {primary:color(p.primary,'#13213B'),secondary:color(p.secondary,'#1672D3'),accent:color(p.accent,'#22B8CF'),background:color(p.background,'#F6F8FB'),text:color(p.text,'#13213B')};
}
function svg(width,height,content){return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`)}
function brandHeader({width,height,name,palette,kind}){
 const short=name.length>38?name.slice(0,38).trim()+'…':name;
 const font=Math.min(kind==='wide'?64:49,Math.max(28,Math.floor((width-215)/(short.length*.63))));
 return `<rect x="0" y="0" width="${width}" height="${kind==='wide'?140:150}" fill="${palette.primary}"/><rect x="0" y="${kind==='wide'?132:142}" width="${width}" height="8" fill="${palette.accent}"/>
 <rect x="55" y="36" rx="17" width="76" height="76" fill="${palette.accent}"/>
 <text x="93" y="90" font-family="DejaVu Sans" font-size="34" font-weight="700" fill="${palette.primary}" text-anchor="middle">${escapeXml(initials(name))}</text>
 <text x="160" y="91" font-family="DejaVu Sans" font-size="${font}" font-weight="700" fill="#ffffff">${escapeXml(short)}</text>`;
}
function layout(kind,width,height){
 const margin=60;
 if(kind==='story')return {photo:{x:0,y:150,width,height:1000},category:{x:margin,y:1190,width:width-120,height:40,fontSize:29},headline:{x:margin,y:1270,width:width-120,height:355,fontSize:61,maxLines:5},summary:{x:margin,y:1640,width:width-120,height:135,fontSize:26,maxLines:3},source:{x:margin,y:1814,width:width-120,height:48,fontSize:18,maxLines:1},footerY:1870};
 if(kind==='wide')return {photo:{x:0,y:140,width:960,height:940},category:{x:1010,y:225,width:850,height:48,fontSize:32},headline:{x:1010,y:320,width:850,height:410,fontSize:65,maxLines:5},summary:{x:1010,y:750,width:850,height:130,fontSize:26,maxLines:3},source:{x:1010,y:955,width:850,height:45,fontSize:18,maxLines:1},footerY:1035};
 return {photo:{x:0,y:150,width,height:590},category:{x:margin,y:775,width:width-120,height:45,fontSize:28},headline:{x:margin,y:842,width:width-120,height:285,fontSize:59,maxLines:4},summary:{x:margin,y:1142,width:width-120,height:105,fontSize:24,maxLines:2},source:{x:margin,y:1270,width:width-120,height:38,fontSize:17,maxLines:1},footerY:1322};
}
function layerMapFor(kind,width,height,palette){
 const p=layout(kind,width,height);
 const t=(field,box,colorValue)=>({x:box.x,y:box.y,width:box.width,height:box.height,fontSize:box.fontSize,fontWeight:field==='HEADLINE'?700:600,maxLines:box.maxLines||1,color:colorValue,fontFamily:'DejaVu Sans'});
 return {PHOTO:{left:p.photo.x,top:p.photo.y,width:p.photo.width,height:p.photo.height,fit:'cover'},
 CATEGORY:t('CATEGORY',p.category,palette.secondary),
 HEADLINE:t('HEADLINE',p.headline,palette.text),
 SUMMARY:t('SUMMARY',p.summary,palette.text),
 SOURCE:t('SOURCE',p.source,palette.text)};
}
async function backgroundFor({name,palette,kind,width,height}){
 const p=palette;
 const rects=`<rect width="${width}" height="${height}" fill="${p.background}"/>${kind==='wide'?'<rect x="960" y="140" width="960" height="940" fill="#ffffff"/>':''}<rect x="0" y="${height-28}" width="${width}" height="28" fill="${p.primary}"/><rect x="0" y="${height-33}" width="${width}" height="5" fill="${p.accent}"/>`;
 const buffer=svg(width,height,rects+brandHeader({name,width,height,palette,kind}));
 return sharp(buffer).png().toBuffer();
}
function brandImageSvg({name,palette,variant}){
 const p=palette,abbr=initials(name),label=name.length>42?name.slice(0,42)+'…':name;
 if(variant==='profile')return svg(1024,1024,`<rect width="1024" height="1024" rx="185" fill="${p.primary}"/><circle cx="512" cy="490" r="327" fill="${p.secondary}" opacity=".45"/><rect x="230" y="250" width="564" height="450" rx="95" fill="${p.accent}"/><text x="512" y="570" text-anchor="middle" fill="${p.primary}" font-family="DejaVu Sans" font-weight="700" font-size="${abbr.length===1?350:260}">${escapeXml(abbr)}</text><rect x="300" y="767" width="424" height="13" rx="6" fill="${p.accent}"/>`);
 return svg(1640,624,`<rect width="1640" height="624" fill="${p.primary}"/><rect x="0" y="570" width="1640" height="54" fill="${p.accent}"/><circle cx="255" cy="305" r="195" fill="${p.secondary}" opacity=".55"/><text x="255" y="375" text-anchor="middle" font-family="DejaVu Sans" fill="#ffffff" font-size="174" font-weight="700">${escapeXml(abbr)}</text><text x="505" y="305" font-family="DejaVu Sans" font-size="${Math.max(45,Math.floor(950/(label.length*.65)))}" font-weight="700" fill="#ffffff">${escapeXml(label)}</text><text x="510" y="389" font-family="DejaVu Sans" font-size="32" fill="${p.accent}">INFORMACIÓN VERIFICABLE</text>`);
}
async function brandImage(data,variant){return sharp(brandImageSvg({...data,variant})).png().toBuffer()}
async function design({name,existingPalette={},focus='' }){
 const cleaned=cleanName(name);const defaults=paletteFor(existingPalette);
 if(!hasAI())return{name:cleaned,palette:defaults,style:'Editorial contemporáneo',generatedBy:'BASE',notice:'Propuesta basada en colores actuales; IA no configurada.'};
 const response=await callAI({system:'Eres diseñador de identidad de un medio informativo. Propón colores únicos y legibles, sin afirmar que hayas inspeccionado una página o logo real. Política editorial neutral. Responde JSON estricto con HEX de seis dígitos.',input:JSON.stringify({name:cleaned,focus,existingPalette:defaults}),jsonSchema:{name:'brand_draft',schema:{type:'object',additionalProperties:false,required:['primary','secondary','accent','style'],properties:{primary:{type:'string'},secondary:{type:'string'},accent:{type:'string'},style:{type:'string'}}}}});
 return{name:cleaned,palette:paletteFor({...defaults,...response}),style:String(response.style).slice(0,160),generatedBy:'AI',notice:'Identidad gráfica propuesta; el logo tipográfico y los fondos se construyen de modo reproducible.'};
}
async function buildTemplates({identityId,name,palette,revision}){
 const definitions=[];
 for(const fmt of FORMATS){
  const code=`BRAND_${identityId.replace(/[^a-z0-9]/gi,'').slice(0,20).toUpperCase()}_${fmt.key}_V${revision}`;
  const base=await backgroundFor({...fmt,name,palette});
  const template={code,name:`${name} · ${fmt.label} · v${revision}`,mediaIdentityId:identityId,renderer:'GENERIC_LAYERED',sourceType:'BUILT_IN',format:fmt.key,status:'READY',isActive:false,width:fmt.width,height:fmt.height,version:revision,baseImageMimeType:'image/png',baseImageData:base,layerMap:layerMapFor(fmt.kind,fmt.width,fmt.height,palette),configuration:{brandStudio:true,revision,compatibleFormats:[fmt.key],requiresRealPhoto:true}};
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
module.exports={FORMATS,paletteFor,design,brandImage,buildTemplates};
