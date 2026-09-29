async function sendTelegram(piece,account){
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const chatId=account.externalAccountId||process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if(!token||!chatId) throw new Error('TELEGRAM_NOT_CONFIGURED');
  const text=[piece.headline,piece.copy,piece.body].filter(Boolean).join('\n\n').slice(0,4000);
  const method=piece.imageUrl?'sendPhoto':'sendMessage';
  const payload=piece.imageUrl?{chat_id:chatId,photo:piece.imageUrl,caption:text.slice(0,1000)}:{chat_id:chatId,text,disable_web_page_preview:false};
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!r.ok) throw new Error(`TELEGRAM_${r.status}: ${await r.text()}`);
  const d=await r.json();
  return {externalPostId:String(d.result?.message_id||''),externalUrl:null,raw:d};
}
module.exports={sendTelegram};
