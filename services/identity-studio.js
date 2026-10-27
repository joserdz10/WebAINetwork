const {callAI,hasAI}=require('./ai');
function slugify(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'medio'}
function proposalBase({name,stateName,focus=''}){
  const geographicFocus=String(focus||stateName||'').trim();
  return{
    description:`Medio digital ${name} con cobertura de ${geographicFocus||'su ámbito editorial'}.`,
    editorial:{
      tone:'Informativo, claro y verificable',
      editorialStyle:'Periodismo digital responsable; distinguir hechos, opiniones y fuentes',
      geographicFocus,
      headlineStyle:'Titulares breves, precisos y sin sensacionalismo',
      politicalTone:'Neutral',
      language:'es-MX',
      audience:'Público general interesado en información verificable',
      promptInstructions:'Usar fuentes identificables y fotografías reales con derechos de uso adecuados. No inventar citas, cifras ni acontecimientos. Separar hechos de opiniones. Evitar afirmaciones no verificadas.',
      avoidRules:['Noticias sin fuente verificable','Fotografías sintéticas como evidencia de hechos reales','Contenido duplicado sin adaptación editorial']
    },
    visual:{
      palette:{primary:'#13213B',secondary:'#1672D3',accent:'#22B8CF',background:'#F6F8FB',text:'#13213B'},
      typography:{headlines:'Sans serif bold',body:'Sans serif legible'},
      layoutStyle:'Modular, claro y adaptable a formatos sociales',
      photoTreatment:'Fotografía real de la fuente, sin manipulación engañosa',
      overlayStyle:'Contraste suficiente; no cubrir hechos esenciales de la foto',
      logoPlacement:'Esquina superior',
      formatRules:{'1:1':'1080x1080','4:5':'1080x1350','9:16':'1080x1920','16:9':'1920x1080',caption:'Reducir o rechazar el texto cuando exceda la plantilla'},
      promptInstructions:'Aplicar colores y tipografía una vez revisada la marca existente. No inventar logotipos oficiales.'
    }
  };
}
async function propose({name,stateName,focus}){
  const base=proposalBase({name,stateName,focus});
  if(!hasAI())return{...base,generatedBy:'BASE',notice:'Propuesta básica editable; OPENAI_API_KEY no está configurada.'};
  const schema={name:'media_identity_proposal',schema:{type:'object',additionalProperties:false,required:['description','tone','editorialStyle','headlineStyle','audience','promptInstructions','primary','secondary','accent','layoutStyle','photoTreatment'],properties:{
    description:{type:'string'},tone:{type:'string'},editorialStyle:{type:'string'},headlineStyle:{type:'string'},audience:{type:'string'},promptInstructions:{type:'string'},primary:{type:'string'},secondary:{type:'string'},accent:{type:'string'},layoutStyle:{type:'string'},photoTreatment:{type:'string'}
  }}};
  const result=await callAI({system:'Eres consultor de medios. Propón una identidad editorial y visual prudente y diferenciada. No presupongas contenido real de la página ni inventes su historia. Todo es una propuesta sujeta a aprobación humana. Mantén neutralidad política, fuentes verificadas, texto que quepa en las plantillas y fotos documentales reales. Devuelve colores HEX válidos.',input:JSON.stringify({name,stateName,focus}),jsonSchema:schema});
  const hex=(v,f)=>/^#[0-9a-f]{6}$/i.test(String(v))?v:f;
  return{
    description:result.description.slice(0,500),
    editorial:{...base.editorial,tone:result.tone,editorialStyle:result.editorialStyle,headlineStyle:result.headlineStyle,audience:result.audience,promptInstructions:result.promptInstructions},
    visual:{...base.visual,palette:{...base.visual.palette,primary:hex(result.primary,base.visual.palette.primary),secondary:hex(result.secondary,base.visual.palette.secondary),accent:hex(result.accent,base.visual.palette.accent)},layoutStyle:result.layoutStyle,photoTreatment:result.photoTreatment},
    generatedBy:'AI',notice:'Propuesta editable. Revisa y aprueba antes de guardar; no se crea ningún contenido ni publicación.'
  };
}
module.exports={slugify,proposalBase,propose};
