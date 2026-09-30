const DYNAMIC_FIELDS=['PHOTO','CATEGORY','HEADLINE','SUMMARY','SOURCE'];
const REQUIRED_FIELDS=['PHOTO','HEADLINE'];
function u16(b,o){return b.readUInt16BE(o)} function i16(b,o){return b.readInt16BE(o)} function u32(b,o){return b.readUInt32BE(o)} function i32(b,o){return b.readInt32BE(o)}
function normalizeField(name=''){
  const n=name.toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑ]+/g,'_').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const aliases={PHOTO:['PHOTO','IMAGE','FOTO','IMAGEN','HERO_IMAGE'],CATEGORY:['CATEGORY','CATEGORIA','SECCION','SECTION'],HEADLINE:['HEADLINE','TITLE','TITULAR','TITULO'],SUMMARY:['SUMMARY','SUBTITLE','BAJADA','RESUMEN','DECK'],SOURCE:['SOURCE','FUENTE']};
  for(const [field,keys] of Object.entries(aliases)) if(keys.some(k=>n===k||n.startsWith(k+'_'))) return field; return null;
}
function defaultTextStyle(field,b){return{x:b.left,y:b.top,width:b.width,height:b.height,color:'#102a29',fontFamily:field==='HEADLINE'?'Georgia, Times New Roman, serif':'Arial, Helvetica, sans-serif',fontSize:field==='HEADLINE'?Math.max(28,Math.min(64,Math.floor(b.height/2.2))):Math.max(14,Math.min(28,Math.floor(b.height/1.8))),fontWeight:field==='HEADLINE'?700:600,maxLines:field==='HEADLINE'?3:field==='SUMMARY'?2:1,align:'left'}}
function autoLayerMap(layers){const map={};for(const layer of layers){const field=normalizeField(layer.name);if(!field||map[field])continue;const b={left:layer.left,top:layer.top,width:layer.width,height:layer.height};map[field]=field==='PHOTO'?{...b,fit:'cover'}:defaultTextStyle(field,b)}return map}
function inspectPsd(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<30||buffer.toString('ascii',0,4)!=='8BPS')throw new Error('PSD_HEADER_INVALID');
  const version=u16(buffer,4); if(version!==1)throw new Error('PSB_NOT_SUPPORTED');
  const height=u32(buffer,14),width=u32(buffer,18); let o=26;
  const colorLen=u32(buffer,o);o+=4+colorLen; const resLen=u32(buffer,o);o+=4+resLen; const lmLen=u32(buffer,o);o+=4;
  const layers=[];
  try{
    if(lmLen>0&&o+4<=buffer.length){const layerInfoLen=u32(buffer,o);o+=4;const end=Math.min(buffer.length,o+layerInfoLen);if(layerInfoLen>2){let count=Math.abs(i16(buffer,o));o+=2;for(let idx=0;idx<count&&o<end;idx++){
      const top=i32(buffer,o),left=i32(buffer,o+4),bottom=i32(buffer,o+8),right=i32(buffer,o+12);o+=16;const channels=u16(buffer,o);o+=2+channels*6;o+=12;const extra=u32(buffer,o);o+=4;const extraEnd=Math.min(end,o+extra);const mask=u32(buffer,o);o+=4+mask;const blend=u32(buffer,o);o+=4+blend;let name='';if(o<extraEnd){const n=buffer[o];o+=1;name=buffer.toString('latin1',o,Math.min(o+n,extraEnd));o+=n;const used=1+n,pad=(4-(used%4))%4;o+=pad}o=extraEnd;layers.push({name,left,top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)})
    }}}
  }catch(e){/* keep dimensions even if layer metadata is unusual */}
  return{width,height,layers,layerMap:autoLayerMap(layers),dynamicFields:DYNAMIC_FIELDS};
}
function statusFor({baseImageData,layerMap,sourceType='PSD'}){
  if(sourceType==='BUILT_IN')return'READY';
  if(!baseImageData)return'NEEDS_BASE_IMAGE';
  if(!layerMap?.PHOTO||!layerMap?.HEADLINE)return'NEEDS_MAPPING';
  return'READY';
}
function diagnosticsFor(t){
  const builtIn=t.sourceType==='BUILT_IN';
  const map=t.layerMap||{};
  const mappedFields=builtIn?[...DYNAMIC_FIELDS]:DYNAMIC_FIELDS.filter(f=>Boolean(map[f]));
  const missingRequired=builtIn?[]:REQUIRED_FIELDS.filter(f=>!map[f]);
  const optionalMissing=builtIn?[]:DYNAMIC_FIELDS.filter(f=>!REQUIRED_FIELDS.includes(f)&&!map[f]);
  const hasBase=Boolean(t.baseImageData||t.hasBaseImage||builtIn);
  const canPreview=builtIn||(hasBase&&missingRequired.length===0);
  const canActivate=String(t.status||'')==='READY'&&canPreview;
  return{mappedFields,missingRequired,optionalMissing,hasBase,canPreview,canActivate,requiredFields:REQUIRED_FIELDS,dynamicFields:DYNAMIC_FIELDS};
}
function safeTemplate(t){
  const out={...t,masterFileData:undefined,baseImageData:undefined,hasMasterFile:Boolean(t.masterFileData||t.hasMasterFile),hasBaseImage:Boolean(t.baseImageData||t.hasBaseImage)};
  out.diagnostics=diagnosticsFor({...t,...out});
  return out;
}
module.exports={inspectPsd,statusFor,safeTemplate,diagnosticsFor,DYNAMIC_FIELDS,REQUIRED_FIELDS};
