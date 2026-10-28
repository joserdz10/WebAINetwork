const sharp=require('sharp');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');

const BRAND_DIR=path.join(__dirname,'..','public','brand','norte-en-alerta');
const CREAM='#f4efe5', INK='#0c2928', GREEN='#0d4a46', TERRACOTTA='#b56b45';
// Sharp/libvips uses fontconfig to resolve SVG font families. Missing fonts
// silently render as tofu squares, so fail instead of producing a publishable PNG.
let fontsVerified=false;
function requireEditorialFonts(){
 if(fontsVerified)return;
 for(const family of ['DejaVu Sans','DejaVu Serif']){
  let match;
  try{match=execFileSync('fc-match',['-f','%{family}\n',family],{encoding:'utf8',timeout:4000}).trim().split('\n')[0]}
  catch{throw new Error('TEMPLATE_FONTS_UNAVAILABLE: fontconfig no está disponible en el servidor')}
  if(!match.toLowerCase().includes(family.toLowerCase()))throw new Error(`TEMPLATE_FONTS_UNAVAILABLE: falta ${family}; se canceló el render para evitar cuadros en el texto`);
 }
 fontsVerified=true;
}
function validateText(data){
 for(const key of ['headline','category','summary','source']){
  if(!String(data[key]||'').trim())throw new Error(`TEMPLATE_${key.toUpperCase()}_REQUIRED`);
 }
}


function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function words(text,max=90){const t=String(text||'').trim();return t.length<=max?t:t.slice(0,max-1).replace(/\s+\S*$/,'')+'…'}
function wrap(text,maxChars=28,maxLines=3){const ws=String(text||'').trim().split(/\s+/), lines=[];let line='';for(const w of ws){const next=(line+' '+w).trim();if(next.length>maxChars&&line){lines.push(line);line=w;if(lines.length===maxLines-1)break}else line=next}if(line&&lines.length<maxLines)lines.push(line);const consumed=lines.join(' ').split(/\s+/).length;if(consumed<ws.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.…]*$/,'')+'…';return lines}
function fitCaption(text,{width=940,maxLines=4,maxFont=56,minFont=32}={}){
 const words=String(text||'').trim().split(/\s+/).filter(Boolean);
 for(let size=maxFont;size>=minFont;size-=2){
  const limit=Math.max(12,Math.floor(width/(size*.66)));
  const lines=[];let line='';let impossible=false;
  for(const word of words){if(word.length>limit){impossible=true;break}const next=line?line+' '+word:word;if(next.length>limit){lines.push(line);line=word}else line=next}
  if(line)lines.push(line);
  if(!impossible&&lines.length<=maxLines)return {lines,fontSize:size,lineHeight:Math.round(size*1.12)};
 }
 throw new Error('VISUAL_CAPTION_OVERFLOW: El caption completo no cabe en el template; necesita revisión editorial');
}
function dataUriToBuffer(v){const m=String(v||'').match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);return m?Buffer.from(m[1],'base64'):null}
async function sourceBuffer(value){const local=dataUriToBuffer(value);if(local)return local;if(/^https?:\/\//i.test(value||'')){const r=await fetch(value,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('SOURCE_IMAGE_DOWNLOAD_FAILED');return Buffer.from(await r.arrayBuffer())}throw new Error('SOURCE_IMAGE_INVALID')}
function neaOverlay({headline,category,summary,source}){
 const fitted=fitCaption(headline);const tspans=fitted.lines.map((x,i)=>`<tspan x="70" dy="${i?fitted.lineHeight:0}">${esc(x)}</tspan>`).join('');
 return Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
 <rect width="1080" height="1350" fill="${CREAM}"/>
 <rect y="1232" width="1080" height="118" fill="${GREEN}"/>
 <text x="670" y="64" fill="${TERRACOTTA}" font-family="DejaVu Sans" font-size="19" font-weight="700" letter-spacing="1.2">NUEVO LEÓN, SIEMPRE DA TEMA.</text>
 <text x="70" y="725" fill="${INK}" font-family="DejaVu Sans" font-size="22" font-weight="700" letter-spacing=".8">NUEVO LEÓN  |  ${esc(String(category||'ACTUALIDAD').toUpperCase())}</text>
 <text x="70" y="805" fill="${INK}" font-family="DejaVu Serif" font-size="${fitted.fontSize}" font-weight="700">${tspans}</text>
 <text x="70" y="1122" fill="#394342" font-family="DejaVu Sans" font-size="24">${wrap(summary,76,2).map((line,i)=>`<tspan x="70" dy="${i?32:0}">${esc(line)}</tspan>`).join('')}</text>
 <rect x="70" y="1195" width="54" height="5" fill="${TERRACOTTA}"/>
 <text x="70" y="1220" fill="#5b5b5b" font-family="DejaVu Sans" font-size="15" font-weight="700">FUENTE: ${esc(words(source||'AI Media Network',70))}</text>
 <text x="320" y="1305" fill="#fff" font-family="DejaVu Sans" font-size="16" font-weight="700" letter-spacing="1">SERIO  •  CONFIABLE  •  EDITORIAL  •  REGIONAL</text>
 </svg>`)
}
async function renderNorteEnAlertaFeed({photo,headline,category,summary,source}){
 if(!photo)throw new Error('TEMPLATE_REAL_PHOTO_REQUIRED');
 if(!String(headline||'').trim())throw new Error('TEMPLATE_HEADLINE_REQUIRED');
 if(!String(source||'').trim())throw new Error('TEMPLATE_SOURCE_REQUIRED');
 requireEditorialFonts();
 validateText({headline,category,summary,source});
 const photoBuf=await sourceBuffer(photo);
 const prepared=await sharp(photoBuf).resize(1080,500,{fit:'cover',position:'attention'}).png().toBuffer();
 const logo=fs.readFileSync(path.join(BRAND_DIR,'logo-header.png'));
 const mark=fs.readFileSync(path.join(BRAND_DIR,'mark-footer.png'));
 return sharp(neaOverlay({headline,category,summary,source})).composite([
   {input:prepared,left:0,top:170},
   {input:logo,left:55,top:20},
   {input:mark,left:65,top:1255}
 ]).png().toBuffer();
}

function fitTextBox(value,m,field){
 const full=String(value||'').replace(/\s+/g,' ').trim();
 const baseSize=Number(m.fontSize||24),maxLines=Number(m.maxLines||1),height=Number(m.height||baseSize*1.2);
 function layout(text){
  for(let size=baseSize;size>=Math.max(13,Math.round(baseSize*.52));size-=2){
   const limit=Math.max(8,Math.floor(Number(m.width||300)/(size*.59)));
   const lines=wrap(text,limit,maxLines);
   if(lines.some(x=>x.endsWith('…')))continue;
   const lineHeight=Math.round(size*1.15);
   if(lines.length*lineHeight<=height)return{lines,fontSize:size,lineHeight};
  }
  return null;
 }
 const exact=layout(full);
 if(exact)return{...exact,text:full,shortened:false};
 if(field!=='SUMMARY')throw new Error(`VISUAL_TEXT_OVERFLOW_${field}: el texto no cabe; requiere una redacción editorial más corta`);
 // Use only a complete sentence/clause already present in the verified summary.
 // Never synthesize a new fact or display a trailing ellipsis.
 const sentences=full.split(/(?<=[.!?])\s+/).filter(Boolean);
 const candidates=[];
 if(sentences.length>1)candidates.push(sentences[0]);
 const clauses=full.split(/[,;:]\s+/).filter(Boolean);
 if(clauses.length>1)candidates.push(clauses[0]);
 // Shortest meaningful prefix: preferably end at a word boundary and preserve useful context.
 const words=full.split(' ');
 for(let count=Math.min(words.length,30);count>=6;count--){
  const text=words.slice(0,count).join(' ').replace(/[,;:–-]\s*$/,'').trim();
  // A partial sentence can misleadingly change meaning. Do not silently show it.
  if(/[.!?]$/.test(text))candidates.push(text);
 }
 for(const candidate of [...new Set(candidates)]){
  if(candidate.split(/\s+/).length<5)continue;
  const ready=layout(candidate);
  if(ready)return{...ready,text:candidate,shortened:true};
 }
 // Explicit neutral placeholder, not a purported summary of the story.
 const placeholder='Más información en la publicación.';
 const fallback=layout(placeholder);
 if(fallback)return{...fallback,text:placeholder,shortened:true,placeholder:true};
 throw new Error('VISUAL_TEXT_OVERFLOW_SUMMARY: no se pudo ajustar la plantilla con seguridad');
}
function textSvg(width,height,layerMap,data){
  const chunks=[];
  const values={HEADLINE:data.headline,CATEGORY:data.category,SUMMARY:data.summary,SOURCE:data.source};
  for(const [field,value] of Object.entries(values)){
    const m=layerMap?.[field]; if(!m||!value) continue;
    const fitted=fitTextBox(value,m,field);
    const {lines,fontSize:size,lineHeight}=fitted;
    const x=Number(m.x??m.left??0), y=Number(m.y??m.top??0)+size;
    const anchor=m.align==='center'?'middle':m.align==='right'?'end':'start';
    const tx=m.align==='center'?x+Number(m.width||0)/2:m.align==='right'?x+Number(m.width||0):x;
    chunks.push(`<text x="${tx}" y="${y}" fill="${esc(m.color||'#111111')}" font-family="${esc(m.fontFamily||'DejaVu Sans, sans-serif')}" font-size="${size}" font-weight="${Number(m.fontWeight||600)}" text-anchor="${anchor}">${lines.map((line,i)=>`<tspan x="${tx}" dy="${i?lineHeight:0}">${esc(line)}</tspan>`).join('')}</text>`);
  }
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${chunks.join('')}</svg>`);
}

// Decorative overlays MUST be composited AFTER the photograph. The old renderer
// baked decorations into the base image, then covered them with the photo.
function brandPhotoOverlay(template){
 const style=template.configuration?.designStyle;
 if(!template.configuration?.brandStudio||!['IMPACTO','REVISTA','PULSO'].includes(style))return null;
 const {width:w,height:h}=template,p=template.layerMap?.PHOTO;
 if(!p)return null;
 const x=Number(p.left??p.x??0),y=Number(p.top??p.y??0),pw=Number(p.width),ph=Number(p.height);
 const accent=template.configuration?.brandPalette?.accent||'#22B8CF';
 const primary=template.configuration?.brandPalette?.primary||'#13213B';
 let art='';
 if(style==='IMPACTO'){
  art=`<path d="M${x} ${y+ph-75} L${x+Math.min(290,pw*.32)} ${y+ph-75} L${x+Math.min(360,pw*.4)} ${y+ph} L${x} ${y+ph}Z" fill="${accent}"/>
  <path d="M${x+pw-175} ${y} L${x+pw} ${y} L${x+pw} ${y+175}Z" fill="${primary}" opacity=".88"/>
  <path d="M${x+pw-95} ${y} L${x+pw} ${y} L${x+pw} ${y+95}Z" fill="${accent}"/> `;
 }else if(style==='REVISTA'){
  art=`<rect x="${x+10}" y="${y+10}" width="${pw-20}" height="${ph-20}" fill="none" stroke="#ffffff" stroke-width="12"/>
  <rect x="${x+24}" y="${y+24}" width="${Math.min(135,pw/5)}" height="44" fill="${accent}"/>
  <path d="M${x+pw-135} ${y+ph} L${x+pw} ${y+ph} L${x+pw} ${y+ph-135}Z" fill="${accent}"/>`;
 }else{
  art=`<rect x="${x}" y="${y+Math.round(ph*.72)}" width="${Math.min(30,pw*.05)}" height="${Math.round(ph*.28)}" fill="${accent}"/>
  <path d="M${x+pw-265} ${y} L${x+pw} ${y} L${x+pw} ${y+135} L${x+pw-175} ${y+135}Z" fill="${primary}" opacity=".94"/>
  <path d="M${x+pw-165} ${y} L${x+pw} ${y} L${x+pw} ${y+66} L${x+pw-115} ${y+66}Z" fill="${accent}"/>
  <rect x="${x+Math.round(pw*.12)}" y="${y+ph-22}" width="${Math.round(pw*.58)}" height="22" fill="${accent}"/>`;
 }
 return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${art}</svg>`);
}
async function renderGenericLayered(template,data){
  if(!template.baseImageData) throw new Error('TEMPLATE_BASE_IMAGE_REQUIRED');
  requireEditorialFonts();
 validateText(data);
 const width=template.width,height=template.height,map=template.layerMap||{};
  let base=Buffer.from(template.baseImageData);
  base=await sharp(base).resize(width,height,{fit:'fill'}).png().toBuffer();
  const composites=[];
  if(map.PHOTO){
    const p=map.PHOTO, photo=await sourceBuffer(data.photo);
    const prepared=await sharp(photo).resize(Math.max(1,Number(p.width||width)),Math.max(1,Number(p.height||height)),{fit:p.fit||'cover',position:'attention'}).png().toBuffer();
    composites.push({input:prepared,left:Number(p.left??p.x??0),top:Number(p.top??p.y??0)});
  }
  const overlay=brandPhotoOverlay(template);
  if(overlay)composites.push({input:overlay,left:0,top:0});
  composites.push({input:textSvg(width,height,map,data),left:0,top:0});
  return sharp(base).composite(composites).png().toBuffer();
}


function previewPhotoDataUri(width=1200,height=700){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#9fb6c2"/><stop offset="1" stop-color="#40545f"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect x="0" y="${Math.round(height*.62)}" width="100%" height="${Math.round(height*.38)}" fill="#263a42" opacity=".72"/>
    <circle cx="${Math.round(width*.72)}" cy="${Math.round(height*.28)}" r="${Math.round(Math.min(width,height)*.12)}" fill="#e7edf0" opacity=".55"/>
    <path d="M0 ${Math.round(height*.7)} L${Math.round(width*.18)} ${Math.round(height*.42)} L${Math.round(width*.33)} ${Math.round(height*.66)} L${Math.round(width*.5)} ${Math.round(height*.34)} L${Math.round(width*.7)} ${Math.round(height*.68)} L${width} ${Math.round(height*.46)} L${width} ${height} L0 ${height}Z" fill="#183239" opacity=".72"/>
    <text x="${Math.round(width/2)}" y="${Math.round(height/2)}" text-anchor="middle" fill="#ffffff" font-family="DejaVu Sans" font-size="${Math.max(28,Math.round(width*.035))}" font-weight="700">FOTO DE PRUEBA</text>
    <text x="${Math.round(width/2)}" y="${Math.round(height/2+48)}" text-anchor="middle" fill="#ffffff" opacity=".85" font-family="DejaVu Sans" font-size="${Math.max(16,Math.round(width*.018))}">Vista previa de plantilla</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function renderTemplatePreview(template,overrides={}){
  const data={
    photo:previewPhotoDataUri(Math.max(900,Number(template?.width||1080)),Math.max(600,Math.round(Number(template?.height||1350)*.52))),
    headline:'Así se verá el titular principal de una noticia',
    category:'ACTUALIDAD',
    summary:'Esta es una bajada de prueba para validar tamaño, jerarquía y composición antes de activar la plantilla.',
    source:'Fuente de prueba',
    ...overrides
  };
  return renderTemplate(template,data);
}

function selectTemplate(identity,type,templates=[]){
 const active=templates.filter(t=>t.isActive!==false&&t.status!=='DISABLED');
 const exact=active.find(t=>t.format===type&&t.status==='READY');if(exact)return exact;
 const compatible=active.find(t=>t.status==='READY'&&Array.isArray(t.configuration?.compatibleFormats)&&t.configuration.compatibleFormats.includes(type));if(compatible)return compatible;
 if(identity?.slug==='norte-en-alerta'&&['FACEBOOK_POST','INSTAGRAM_POST','EDITORIAL_GRAPHIC'].includes(type))return {code:'NEA_FEED_4X5_V1',renderer:'NEA_FEED_4X5',format:type,width:1080,height:1350,status:'READY'};
 return null;
}
async function renderTemplate(template,data){
 if(template?.renderer==='NEA_FEED_4X5')return renderNorteEnAlertaFeed(data);
 if(template?.renderer==='GENERIC_LAYERED')return renderGenericLayered(template,data);
 throw new Error('TEMPLATE_RENDERER_NOT_SUPPORTED');
}
module.exports={selectTemplate,renderTemplate,renderTemplatePreview,fitCaption,fitTextBox};
