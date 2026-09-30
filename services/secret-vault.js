const crypto=require('crypto');

function keyMaterial(){
  const raw=process.env.SOCIAL_CREDENTIALS_KEY;
  if(!raw) throw new Error('SOCIAL_CREDENTIALS_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(String(raw)).digest();
}
function configured(){return Boolean(process.env.SOCIAL_CREDENTIALS_KEY)}
function encryptSecret(value){
  if(value==null||value==='')return null;
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyMaterial(),iv);
  const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return{ciphertext:ciphertext.toString('base64'),iv:iv.toString('base64'),tag:tag.toString('base64')};
}
function decryptSecret(payload){
  if(!payload?.ciphertext||!payload?.iv||!payload?.tag)return null;
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyMaterial(),Buffer.from(payload.iv,'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext,'base64')),decipher.final()]).toString('utf8');
}
function encryptTicket(obj){return Buffer.from(JSON.stringify(encryptSecret(JSON.stringify(obj))),'utf8').toString('base64url')}
function decryptTicket(ticket){
  try{return JSON.parse(decryptSecret(JSON.parse(Buffer.from(String(ticket),'base64url').toString('utf8'))))}
  catch{throw new Error('META_CONNECTION_TICKET_INVALID')}
}
function signMediaId(id){return crypto.createHmac('sha256',keyMaterial()).update(String(id)).digest('hex').slice(0,32)}
function verifyMediaId(id,sig){const expected=signMediaId(id);try{return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(sig||'')))}catch{return false}}
module.exports={configured,encryptSecret,decryptSecret,encryptTicket,decryptTicket,signMediaId,verifyMediaId};
