// No photo leaves the device until send() is called after explicit consent.
export const MAX_PACKAGE_BYTES = 8 * 1024 * 1024;
const canvas = (w,h) => {const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const blob = (c,type,quality) => new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('保存用画像を作れませんでした。')),type,quality));
async function encode(name,b){
  const bytes=new Uint8Array(await b.arrayBuffer());let raw='';
  for(let i=0;i<bytes.length;i+=16384)raw+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {name,base64:btoa(raw)};
}

export async function makeMaterialPackage(file, light, {id=crypto.randomUUID(),termsVersion}={}) {
  if(!file||!light||!termsVersion)throw Error('写真と月の位置を確認してください。');
  const url=URL.createObjectURL(file), img=new Image();
  try {
    img.src=url;await img.decode();
    if(img.naturalWidth*img.naturalHeight>48e6)throw Error('4800万画素以下の写真を使用してください。');
    // Keep useful design resolution while bounding mobile memory and upload size.
    const scale=Math.min(1,4096/Math.max(img.naturalWidth,img.naturalHeight));
    const photo=canvas(Math.max(1,Math.round(img.naturalWidth*scale)),Math.max(1,Math.round(img.naturalHeight*scale)));
    photo.getContext('2d').drawImage(img,0,0,photo.width,photo.height);
    const {x,y,radius}=light.selection,r=radius*Math.min(photo.width,photo.height);
    const side=Math.max(1,Math.min(2048,Math.round(2*r))),moon=canvas(side,side),ctx=moon.getContext('2d');
    ctx.beginPath();ctx.arc(side/2,side/2,side/2,0,Math.PI*2);ctx.clip();
    ctx.drawImage(photo,x*photo.width-r,y*photo.height-r,2*r,2*r,0,0,side,side);
    const thumb=canvas(400,Math.max(1,Math.round(400*photo.height/photo.width)));thumb.getContext('2d').drawImage(photo,0,0,thumb.width,thumb.height);
    const details={schema:1,id,light,photo:{width:photo.width,height:photo.height,originalWidth:img.naturalWidth,originalHeight:img.naturalHeight,encoding:'JPEG re-encoded, EXIF/GPS removed',colorSpace:'browser sRGB'},moon:{width:side,height:side,transparent:true},purpose:'CD surface color and texture; human review required'};
    let photoBlob=await blob(photo,'image/jpeg',.94);
    const moonBlob=await blob(moon,'image/png'),previewBlob=await blob(thumb,'image/jpeg',.8),jsonBlob=new Blob([JSON.stringify(details,null,2)],{type:'application/json'});
    if(photoBlob.size+moonBlob.size+previewBlob.size+jsonBlob.size>MAX_PACKAGE_BYTES)photoBlob=await blob(photo,'image/jpeg',.82);
    if(photoBlob.size+moonBlob.size+previewBlob.size+jsonBlob.size>MAX_PACKAGE_BYTES)throw Error('素材が8MBを超えました。小さめの写真を選んでください。');
    return {schema:1,id,agreed:true,termsVersion,files:await Promise.all([encode('photo.jpg',photoBlob),encode('moon.png',moonBlob),encode('preview.jpg',previewBlob),encode('light.json',jsonBlob)])};
  } finally {URL.revokeObjectURL(url);}
}

export function connectCollection(endpoint,{timeout=45000}={}) {
  const url=new URL(endpoint);
  if(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname))throw Error('受付先の設定が不正です。');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  url.searchParams.set('nonce',nonce);
  const frame=document.createElement('iframe');frame.hidden=true;frame.title='写真の保存受付';frame.referrerPolicy='no-referrer';
  let remote=null,remoteOrigin=null,pending=null,cleanup=()=>{};
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(Error('保存先に接続できませんでした。写真は送信していません。'));},timeout);
    function receive(e){
      if(e.data?.channel!=='hikari-materials-v1'||e.data?.nonce!==nonce)return;
      // Apps Script nests its HTML-service document; the unpredictable nonce binds its ready message.
      if(!/^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(e.origin))return;
      if(!remote && e.data.type==='ready'){remote=e.source;remoteOrigin=e.origin;clearTimeout(timer);resolve();return;}
      if(e.source!==remote||e.origin!==remoteOrigin||!pending)return;
      if(e.data.type==='error'){pending.reject(Error(e.data.message||'保存できませんでした。'));pending=null;}
      else if(e.data.type===pending.type){pending.resolve(e.data);pending=null;}
    }
    window.addEventListener('message',receive);
    cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();};
  });
  frame.src=url.href;document.body.append(frame);
  async function request(type,payload){
    await ready;if(pending)throw Error('保存処理中です。');
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending=null;reject(Error('保存結果を確認できませんでした。同じ写真で再送すると重複を避けて確認できます。'));},timeout);
      pending={type:type==='submit'?'receipt':'config',resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}};
      remote.postMessage({channel:'hikari-materials-v1',nonce,type,payload},remoteOrigin);
    });
  }
  return {config:async()=> (await request('config')).config,send:async payload=>{
    const result=(await request('submit',payload)).receipt;
    if(!result?.ok||result.id!==payload.id)throw Error('受付番号を確認できませんでした。');return result;
  },close:()=>cleanup()};
}
