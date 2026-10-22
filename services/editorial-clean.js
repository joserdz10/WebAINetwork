function strip(text=''){return String(text).replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
// Remove navigation/category labels accidentally joined to article titles.
// Only strip known section labels when glued directly to an uppercase headline.
const SECTION_LABELS=['Global','Nacional','Internacional','Local','Monterrey','Nuevo León','Noticias','Actualidad','Política','Seguridad','Deportes','Espectáculos'];
function cleanEditorialText(value){
 let text=strip(value).replace(/\s+/g,' ').trim();
 for(const label of SECTION_LABELS){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const prefix=new RegExp('^'+escaped+'(?=[A-ZÁÉÍÓÚÑ])','u');
  if(prefix.test(text)){text=text.replace(prefix,'').trim();break}
 }
 return text;
}
module.exports={cleanEditorialText};
