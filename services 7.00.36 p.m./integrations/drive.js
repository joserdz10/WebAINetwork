async function uploadTextToDrive(filename,text){
  const token=process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if(!token) throw new Error('GOOGLE_DRIVE_ACCESS_TOKEN_NOT_CONFIGURED');
  const metadata={name:filename,mimeType:'text/plain'};
  if(process.env.GOOGLE_DRIVE_FOLDER_ID) metadata.parents=[process.env.GOOGLE_DRIVE_FOLDER_ID];
  const boundary='amn_'+Date.now();
  const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
  const r=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body});
  if(!r.ok) throw new Error(`DRIVE_${r.status}: ${await r.text()}`);
  return r.json();
}
module.exports={uploadTextToDrive};
