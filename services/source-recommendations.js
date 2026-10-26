// Catálogo editorial sugerido. Las URLs son propuestas, no fuentes verificadas automáticamente.
const RECOMMENDATIONS = Object.freeze({
  SON: Object.freeze([
    ['El Imparcial','https://www.elimparcial.com','Estatal'],
    ['Expreso','https://www.expreso.com.mx','Hermosillo / estatal'],
    ['Proyecto Puente','https://proyectopuente.com.mx','Hermosillo / política'],
    ['El Sol de Hermosillo','https://www.elsoldehermosillo.com.mx','Hermosillo'],
    ['Tribuna','https://www.tribuna.com.mx','Cajeme / sur de Sonora'],
    ['Diario del Yaqui','https://diariodelyaqui.mx','Ciudad Obregón'],
    ['El Diario de Sonora','https://www.eldiariodesonora.com.mx','Nogales / frontera'],
    ['Dossier Político','https://dossierpolitico.com','Política estatal'],
    ['Uniradio Sonora','https://www.uniradiosonora.com','Estatal'],
    ['Crítica','https://critica.com.mx','Política estatal'],
    ['Entorno Informativo','https://entornoinformativo.com.mx','Hermosillo'],
    ['Kiosco Mayor','https://kioscomayor.com','Política estatal']
  ].map(([name,url,region])=>Object.freeze({name,url,region,type:'WEBSITE'})))
});
function sourceHost(value){
  if(!value||typeof value!=='string')return null;
  try{const u=new URL(value.includes('://')?value:'https://'+value);return u.hostname.toLowerCase().replace(/^www\./,'').replace(/\.$/,'')||null}catch{return null}
}
function sourceKey(source){return sourceHost(source.url)||sourceHost(source.domain)}
function previewSources(stateCode,existing=[]){
  const catalog=RECOMMENDATIONS[stateCode]||[];
  const existingHosts=new Set(existing.map(sourceKey).filter(Boolean));
  return catalog.map(entry=>({...entry,domain:sourceHost(entry.url),status:existingHosts.has(sourceHost(entry.url))?'EXISTING':'AVAILABLE'}));
}
module.exports={RECOMMENDATIONS,sourceHost,sourceKey,previewSources};
