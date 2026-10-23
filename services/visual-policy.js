const {cleanEditorialText}=require('./editorial-clean');
const POLICY_VERSION='GLOBAL_EDITORIAL_VISUAL_V1';
const POLICY={maxWords:15,maxLines:3,requireContext:true,requirePhoto:true};
const VISUAL_TYPES=new Set(['FACEBOOK_POST','INSTAGRAM_POST','FACEBOOK_STORY','INSTAGRAM_STORY','EDITORIAL_GRAPHIC']);
function normalize(value){const t=cleanEditorialText(value||'');return /^(null|undefined|n\/a)$/i.test(t)?'':t}
function countWords(t){return normalize(t).split(/\s+/).filter(Boolean).length}
function validCaption(t){const v=normalize(t);return Boolean(v)&&countWords(v)<=POLICY.maxWords&&!/[.…]{2,}$/.test(v)&&!/[,:;¿¡-]$/.test(v)}
function safeCaption(text){let t=normalize(text).replace(/(?:\.{3,}|…).*$/,'').trim();if(countWords(t)<=POLICY.maxWords)return t;const parts=t.split(/\s+/);const first=parts.slice(0,POLICY.maxWords);const punctuation=Math.max(first.findLastIndex(w=>/[.!?;:]$/.test(w)), -1);return (punctuation>=5?first.slice(0,punctuation+1):first).join(' ').replace(/[,;:¿¡-]$/,'').trim()}
function context(story,copy){const candidates=[story?.summary,story?.context,...(Array.isArray(story?.keyFacts)?story.keyFacts:[]),copy];for(const candidate of candidates){const text=normalize(candidate);if(text&&text!==normalize(story?.title))return text.slice(0,320)}return ''}
function validateVisual({caption,summary,source,imageUrl,metadata,requireImage=true}){
 if(!validCaption(caption))throw new Error('VISUAL_CAPTION_INVALID: El caption debe ser breve, completo y sin puntos suspensivos');
 if(!normalize(summary))throw new Error('VISUAL_CONTEXT_REQUIRED: No hay bajada verificable');
 if(!normalize(source))throw new Error('VISUAL_SOURCE_REQUIRED');
 if(requireImage&&(!imageUrl||metadata?.imageStatus!=='SOURCE_IMAGE_RENDERED'||metadata?.syntheticImage!==false))throw new Error('VISUAL_REAL_PHOTO_REQUIRED');
 return true;
}
module.exports={POLICY_VERSION,POLICY,VISUAL_TYPES,normalize,countWords,validCaption,safeCaption,context,validateVisual};
