async function tg(method,payload){const t=process.env.TELEGRAM_BOT_TOKEN;if(!t)throw new Error('TELEGRAM_BOT_TOKEN_NOT_CONFIGURED');const r=await fetch(`https://api.telegram.org/bot${t}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw new Error(`TELEGRAM_${r.status}`);return r.json()}
async function handleTelegramUpdate(prisma,update){const msg=update.message;if(!msg?.text)return;const chatId=msg.chat.id;const text=msg.text.trim();
 // Opt-in editorial alerts are registered only when the operator explicitly starts notifications.
 if(text==='/avisos_on'){const old=await prisma.appSetting.findUnique({where:{key:'editorial.telegramChatIds'}});const ids=Array.isArray(old?.value)?old.value:[];const next=[...new Set([...ids.map(String),String(chatId)])].slice(-5);await prisma.appSetting.upsert({where:{key:'editorial.telegramChatIds'},create:{key:'editorial.telegramChatIds',value:next,description:'Telegram operator opt-in for editorial alerts'},update:{value:next}})}
 if(text==='/avisos_off'){const old=await prisma.appSetting.findUnique({where:{key:'editorial.telegramChatIds'}});const ids=Array.isArray(old?.value)?old.value:[];await prisma.appSetting.upsert({where:{key:'editorial.telegramChatIds'},create:{key:'editorial.telegramChatIds',value:[]},update:{value:ids.filter(v=>String(v)!==String(chatId))}})}const [cmd,...args]=text.split(/\s+/);let out='';
 if(cmd==='/avisos_on')out='Avisos de producción editorial activados en este chat. Las publicaciones seguirán requiriendo aprobación humana.';
 else if(cmd==='/avisos_off')out='Avisos de producción editorial desactivados en este chat.';
 else if(cmd==='/cola'){const jobs=await prisma.editorialJob.groupBy({by:['status'],_count:{_all:true}});out='Producción editorial: '+jobs.map(x=>x.status+' '+x._count._all).join(' · ')}
 else if(cmd==='/inbox'){const rows=await prisma.story.findMany({where:{status:'DISCOVERED'},orderBy:{detectedAt:'desc'},take:8});out=rows.length?rows.map(x=>`#${x.publicId} ${x.title}`).join('\n'):'No hay historias pendientes.'}
 else if(cmd==='/story'){const id=Number(args[0]?.replace('#',''));const s=await prisma.story.findUnique({where:{publicId:id},include:{sources:true}});out=s?`#${s.publicId} ${s.title}\nEstado: ${s.status}\nPrioridad: ${s.priority}\nFuentes: ${s.sources.length}\n\n${s.summary||''}`:'Historia no encontrada.'}
 else if(cmd==='/estado_actual'||cmd==='/whoami') out='Espacio predeterminado: México / Nuevo León (NL).';
 else if(cmd==='/ready'){const rows=await prisma.story.findMany({where:{status:{in:['READY','CONTENT_READY','APPROVED']}},orderBy:{updatedAt:'desc'},take:8});out=rows.length?rows.map(x=>`#${x.publicId} ${x.status} · ${x.title}`).join('\n'):'No hay historias listas.'}
 else if(cmd==='/ayuda'||cmd==='/start') out='AI Media Network Operator\n/inbox\n/story <id>\n/ready\n/estado_actual';
 else return;
 await tg('sendMessage',{chat_id:chatId,text:out.slice(0,4000),disable_web_page_preview:true});}
module.exports={handleTelegramUpdate};
