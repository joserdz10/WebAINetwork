const {cleanEditorialText}=require('./editorial-clean');
const INVALID_CONTEXT=/^(?:null|undefined|n\/?a|historia detectada a partir de|requiere revisi[oó]n editorial|informaci[oó]n en desarrollo; consulta las fuentes)/i;
const STATES={NL:{name:'Nuevo León',local:/\b(nuevo le[oó]n|monterrey|san pedro garza garc[ií]a|san nicol[aá]s de los garza|guadalupe,?\s*nuevo le[oó]n|apodaca|escobedo,?\s*nuevo le[oó]n|santa catarina,?\s*nuevo le[oó]n|cadereyta jim[eé]nez|garc[ií]a,?\s*nuevo le[oó]n)\b/i},HG:{name:'Hidalgo',local:/\b(hidalgo|pachuca|tula de allende|tulancingo|mineral de la reforma)\b/i},CL:{name:'Colima',local:/\b(colima|manzanillo|tecom[aá]n|villa de [aá]lvarez)\b/i}};
const OTHER_PLACE=/\b(cabo san lucas|baja california sur|los cabos|ciudad de m[eé]xico|cdmx|sonora|chihuahua|yucat[aá]n|quer[eé]taro|oaxaca|sinaloa|coahuila|veracruz|tabasco|zacatecas|michoac[aá]n|jalisco|guanajuato|chiapas|puebla)\b/i;
function cleanTitle(input){let t=cleanEditorialText(input||'').replace(/^(?:global|nacional|internacional|actualidad|noticias|pol[ií]tica|seguridad)\s+(?=[¿¡A-ZÁÉÍÓÚÑ])/i,'').trim();return t.replace(/\s+/g,' ').trim()}
function validContext(text){const t=cleanEditorialText(text||'');return t.length>=35&&!INVALID_CONTEXT.test(t)&&!/^\s*(?:fuente|autor|redacci[oó]n)\s*:/i.test(t)}
function qualityCheck({title,summary,stateCode,articleTitle,articleContext}){
 const headline=cleanTitle(articleTitle||title),context=validContext(articleContext)?cleanEditorialText(articleContext):validContext(summary)?cleanEditorialText(summary):'';
 const policy=STATES[String(stateCode||'').toUpperCase()];
 const evidence=[headline,context].filter(Boolean).join(' ');
 const local=policy?policy.local.test(evidence):true;
 const foreign=policy?OTHER_PLACE.test(headline):false;
 const problems=[];
 if(!headline||headline.length<20||headline.length>210)problems.push('EDITORIAL_TITLE_REVIEW_REQUIRED');
 if(/\p{Ll}\p{Lu}/u.test(headline)||/\.{3}|…/.test(headline))problems.push('EDITORIAL_TITLE_CONTAMINATED');
 if(!context)problems.push('EDITORIAL_CONTEXT_REQUIRED');
 if(policy&&(!local||foreign&&!policy.local.test(headline)))problems.push('EDITORIAL_GEOGRAPHY_REVIEW_REQUIRED');
 return {ok:!problems.length,title:headline,summary:context,stateCode,problems,geoEvidence:local?'LOCAL_MENTION':'NO_LOCAL_MENTION'};
}
function assertEditorialQuality(input){const result=qualityCheck(input);if(!result.ok)throw new Error(`${result.problems[0]}: ${result.problems.includes('EDITORIAL_GEOGRAPHY_REVIEW_REQUIRED')?'La noticia no acredita pertinencia con el estado seleccionado. Revisa el origen antes de generar o publicar.':'La noticia necesita revisión y datos verificables antes de publicarse.'}`);return result}
module.exports={cleanTitle,validContext,qualityCheck,assertEditorialQuality};
