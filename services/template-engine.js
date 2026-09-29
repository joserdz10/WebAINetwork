const sharp=require('sharp');
const fs=require('fs');
const path=require('path');

const BRAND_DIR=path.join(__dirname,'..','public','brand','norte-en-alerta');
const CREAM='#f4efe5', INK='#0c2928', GREEN='#0d4a46', TERRACOTTA='#b56b45';

function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function words(text,max=90){const t=String(text||'').trim();return t.length<=max?t:t.slice(0,max-1).replace(/\s+\S*$/,'')+'…'}
function wrap(text,maxChars=28,maxLines=3){const ws=String(text||'').trim().split(/\s+/), lines=[];let line='';for(const w of ws){const next=(line+' '+w).trim();if(next.length>maxChars&&line){lines.push(line);line=w;if(lines.length===maxLines-1)break}else line=next}if(line&&lines.length<maxLines)lines.push(line);const consumed=lines.join(' ').split(/\s+/).length;if(consumed<ws.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.…]*$/,'')+'…';return lines}
function dataUriToBuffer(v){const m=String(v||'').match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s);return m?Buffer.from(m[1],'base64'):null}
async function sourceBuffer(value){const local=dataUriToBuffer(value);if(local)return local;if(/^https?:\/\//i.test(value||'')){const r=await fetch(value);if(!r.ok)throw new Error('SOURCE_IMAGE_DOWNLOAD_FAILED');return Buffer.from(await r.arrayBuffer())}throw new Error('SOURCE_IMAGE_INVALID')}
function neaOverlay({headline,category,summary,source}){
 const lines=wrap(headline,28,3);const tspans=lines.map((x,i)=>`<tspan x="70" dy="${i?58:0}">${esc(x)}</tspan>`).join('');
 return Buffer.from(`<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
 <rect width="1080" height="1350" fill="${CREAM}"/>
 <rect y="1232" width="1080" height="118" fill="${GREEN}"/>
 <text x="670" y="64" fill="${TERRACOTTA}" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="700" letter-spacing="1.2">NUEVO LEÓN, SIEMPRE DA TEMA.</text>
 <text x="70" y="725" fill="${INK}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" letter-spacing=".8">NUEVO LEÓN  |  ${esc(String(category||'ACTUALIDAD').toUpperCase())}</text>
 <text x="70" y="805" fill="${INK}" font-family="Georgia,Times New Roman,serif" font-size="56" font-weight="700">${tspans}</text>
 <text x="70" y="1175" fill="#394342" font-family="Arial,Helvetica,sans-serif" font-size="26">${esc(words(summary,78))}</text>
 <rect x="70" y="1195" width="54" height="5" fill="${TERRACOTTA}"/>
 <text x="70" y="1218" fill="#5b5b5b" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700">FUENTE: ${esc(words(source||'AI Media Network',70))}</text>
 <text x="320" y="1305" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" letter-spacing="1">SERIO  •  CONFIABLE  •  EDITORIAL  •  REGIONAL</text>
 </svg>`)
}
async function renderNorteEnAlertaFeed({photo,headline,category,summary,source}){
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
function selectTemplate(identity,type,templates=[]){
 const active=templates.filter(t=>t.isActive!==false);
 const exact=active.find(t=>t.format===type);if(exact)return exact;
 if(identity?.slug==='norte-en-alerta'&&['FACEBOOK_POST','INSTAGRAM_POST','EDITORIAL_GRAPHIC'].includes(type))return {code:'NEA_FEED_4X5_V1',renderer:'NEA_FEED_4X5',format:type,width:1080,height:1350};
 return null;
}
async function renderTemplate(template,data){if(template?.renderer==='NEA_FEED_4X5')return renderNorteEnAlertaFeed(data);throw new Error('TEMPLATE_RENDERER_NOT_SUPPORTED')}
module.exports={selectTemplate,renderTemplate};
