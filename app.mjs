import { clamp, detectMoon, extractLight, phaseAt, recordingType, SHARE_TEXT, LINKS } from './core.mjs?v=calendar-nov-apr';
import { createScene, drawScene } from './render.mjs?v=calendar-nov-apr';
import { recordScene, saveFile } from './media.mjs';
import { TRACKS } from './tracks.mjs';
import { prepareMusic, availableTracks, chooseTrack, unlockMusic, suspendMusic } from './music.mjs';
import { COLLECTION } from './collection-config.mjs';
import { makeMaterialPackage, connectCollection } from './submission.mjs';
const $=id=>document.getElementById(id);
let photo=null,analysis=null,selection={x:.5,y:.5,radius:.12},light=null,scene=null,sample=false;
let videoBlob=null,videoURL=null,videoExt=null,animation=0,revision=0,loading=0,controller=null,recording=false;
let videoTrackId='';
let sourceFile=null,materialPackage=null,collection=null,collectionConfig=null,receipt=null;
if(COLLECTION.enabled && COLLECTION.endpoint){
  $('collection-note').textContent='写真の受付状況を確認しています。';
  try {
    collection=connectCollection(COLLECTION.endpoint);
    collection.config().then(config=>{
      collectionConfig=config;
      if(!config.enabled){$('collection-note').textContent='現在、写真の受付は停止しています。動画はこの端末で作れます。';return;}
      $('collection-consent').hidden=false;
      $('consent-contact').hidden=!config.operator&&!config.contact;
      $('consent-contact').textContent=[config.operator?`運営：${config.operator}`:'',config.contact?`取下げの連絡先：${config.contact}（受付番号をお知らせください）`:''].filter(Boolean).join(' ／ ');
      $('collection-note').textContent='';
      $('collection-note').hidden=true;
      document.querySelector('footer span:last-child').textContent='写真の利用条件をご確認のうえご参加ください。';
    }).catch(()=>{$('collection-note').textContent='写真の受付に接続できません。現在は端末内での動画生成のみです。';});
  }catch{$('collection-note').textContent='写真の受付は準備中です。動画はこの端末で作れます。';}
}
const preview=$('result-canvas'),editor=$('photo-canvas');
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
const selectedPhase=()=>phaseAt();
function clearVideo(){if(videoURL)URL.revokeObjectURL(videoURL);videoURL=null;videoBlob=null;videoTrackId='';$('video').pause();$('video').removeAttribute('src');$('video').load();$('video-result').hidden=true;$('recording-progress').textContent='';}
function revokeResults(){changeMusic();$('result-actions').hidden=true;}
function updateVideoButton(){
$('make-video').disabled=recording||!availableTracks(TRACKS).length;
$('format-note').textContent=recordingType(globalThis.MediaRecorder,{audio:true})?'':'このブラウザでは音楽付き動画を生成できません。別の対応ブラウザでお試しください。';
}
function changeMusic(){clearVideo();updateVideoButton();}
function invalidate(){revision++;cancelAnimationFrame(animation);revokeResults();scene=null;materialPackage=null;receipt=null;$('submission-status').textContent='';$('retry-submission').hidden=true;}
function editorRect(){const scale=Math.min(editor.width/photo.width,editor.height/photo.height);return {w:photo.width*scale,h:photo.height*scale,x:(editor.width-photo.width*scale)/2,y:(editor.height-photo.height*scale)/2};}
function drawEditor(){
  if(!photo)return;const c=editor.getContext('2d'),r=editorRect();c.fillStyle='#07101a';c.fillRect(0,0,editor.width,editor.height);c.drawImage(photo,r.x,r.y,r.w,r.h);
  const x=r.x+selection.x*r.w,y=r.y+selection.y*r.h,radius=selection.radius*Math.min(r.w,r.h);
  c.strokeStyle='#f2dfad';c.lineWidth=1.5;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.stroke();c.fillStyle='#f2dfad';c.fillRect(x-5,y-.5,10,1);c.fillRect(x-.5,y-5,1,10);
}
function syncSliders(){for(const [id,key] of [['moon-x','x'],['moon-y','y'],['moon-radius','radius']])$(id).value=selection[key]*100;}
function analyze(){
  invalidate();drawEditor();
  try{light=extractLight(analysis,selection);$('create').disabled=false;$('light-info').replaceChildren();const dot=document.createElement('span');dot.className='swatch';dot.style.backgroundColor=`rgb(${light.meanRGB.join(',')})`;$('light-info').append(dot,`抽出した光 · 明るさ ${Math.round(light.brightness*100)} / 100`);drawScene(preview,createScene(photo,light,selectedPhase(),sample),0);}
  catch(error){light=null;$('create').disabled=true;$('light-info').textContent=error.message;}
}
function setPhoto(source,isSample){
  photo=source;sample=isSample;const scaled=document.createElement('canvas'),ratio=Math.min(1,256/Math.max(photo.width,photo.height));scaled.width=Math.round(photo.width*ratio);scaled.height=Math.round(photo.height*ratio);const c=scaled.getContext('2d',{willReadFrequently:true});c.drawImage(photo,0,0,scaled.width,scaled.height);analysis=c.getImageData(0,0,scaled.width,scaled.height);selection=detectMoon(analysis);$('photo-editor').hidden=false;syncSliders();analyze();$('photo-label').textContent=isSample?'体験用サンプル / 月の位置を合わせる':'あなたの写真 / 月の位置を合わせる';if(!selection.found){$('photo-editor').open=true;message('写真の月をタップしてください。');}
}
$('photo-input').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;const ticket=++loading;
  if(!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp|avif)$/i.test(file.name)){message('画像ファイルを選んでください。',true);return;}
  if(file.size>20*1024*1024){message('20MB以下の写真を選んでください。',true);return;}
  const url=URL.createObjectURL(file),image=new Image();message('写真をこの端末で読み込んでいます…');
  try{image.src=url;await image.decode();if(ticket!==loading)return;if(recording){message('動画生成中のため写真を切り替えませんでした。生成後に写真を選び直してください。');return;}if(image.naturalWidth*image.naturalHeight>48_000_000)throw new Error('写真が大きすぎます。4800万画素以下に縮小してお試しください。');const ratio=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);setPhoto(canvas,false);sourceFile=file;if(light)void createResult();}
  catch(error){if(ticket===loading)message(error.message.includes('画素')?error.message:'この画像を読み込めませんでした。HEICなどが非対応の場合は、JPEG・PNGに変換して選び直してください。',true);}
  finally{URL.revokeObjectURL(url);}
};
for(const [id,key] of [['moon-x','x'],['moon-y','y'],['moon-radius','radius']])$(id).oninput=()=>{selection[key]=Number($(id).value)/100;analyze();};
editor.onpointerdown=event=>{if(!photo||recording)return;const box=editor.getBoundingClientRect(),px=(event.clientX-box.left)/box.width*editor.width,py=(event.clientY-box.top)/box.height*editor.height,r=editorRect();if(px<r.x||py<r.y||px>r.x+r.w||py>r.y+r.h)return;selection.x=clamp((px-r.x)/r.w);selection.y=clamp((py-r.y)/r.h);syncSliders();analyze();};
$('detect').onclick=()=>{selection=detectMoon(analysis);syncSliders();analyze();message('候補を選び直しました。月を囲んでいるか確認してください。');};

function createResult(){
if(!light||recording)return;scene=createScene(photo,light,selectedPhase(),sample);$('result-actions').hidden=false;drawScene(preview,scene,0);message('写真を選びました。「光を送る」で動画が生まれます。');
}
$('create').onclick=createResult;
async function save(blob,ext,suffix=''){try{const result=await saveFile(blob,`ひかりは巡る-${light.seed.toString(16)}${suffix}.${ext}`);message(result==='cancelled'?'保存・共有をキャンセルしました。':result==='shared'?'共有画面を閉じました。選んだ保存先をご確認ください。':'ダウンロードを開始しました。端末のファイルをご確認ください。');}catch{message('保存を開始できませんでした。「動画を開く」から保存をお試しください。',true);}}

function lock(value){recording=value;for(const id of ['photo-input','detect','moon-x','moon-y','moon-radius','create'])$(id).disabled=value;$('cancel-video').hidden=!value;updateVideoButton();}
$('make-video').onclick=async()=>{
  if(!scene||recording)return;const withMusic=true;
  if(!recordingType(globalThis.MediaRecorder,{audio:withMusic})){message('このブラウザでは音楽付き動画を生成できません。別の対応ブラウザでお試しください。',true);return;}
  $('video').pause();cancelAnimationFrame(animation);lock(true);controller=new AbortController();const recordingCanvas=document.createElement('canvas');recordingCanvas.width=720;recordingCanvas.height=1280;$('recording-progress').textContent='動画を生成しています。画面を開いたままお待ちください。';
  try{
    let audio=null;
    if(withMusic){const track=chooseTrack(TRACKS);$('recording-progress').textContent=`「${track.title}」の音源を準備しています…`;[,audio]=await Promise.all([unlockMusic(),prepareMusic(track,{signal:controller.signal})]);}
    const result=await recordScene(recordingCanvas,scene,{audio,signal:controller.signal,onProgress:p=>{$('recording-progress').textContent=`動画を生成中… ${Math.round(p*100)}% / 12秒・${audio?audio.track.title:'音楽なし'}`;}});if(videoURL)URL.revokeObjectURL(videoURL);videoBlob=result.blob;videoExt=result.extension;videoTrackId=result.music?.id || '';videoURL=URL.createObjectURL(videoBlob);$('video').src=videoURL;$('open-video').href=videoURL;$('download-video').href=videoURL;$('download-video').download=`ひかりは巡る-${light.seed.toString(16)}${videoTrackId?'-'+videoTrackId:''}.${videoExt}`;$('video-result').hidden=false;$('recording-progress').textContent=`生成完了 · ${result.extension.toUpperCase()} · ${result.music?result.music.title+'／音楽付き':'音楽なし'} · 720 × 1280 · ${(videoBlob.size/1024/1024).toFixed(1)}MB`;
    message(result.extension==='webm'?'WebM動画を生成しました。投稿先がWebM非対応の場合は別の対応ブラウザでお試しください。':'MP4動画を生成しました。下のプレーヤーで再生してから保存してください。');
    if(collectionConfig?.enabled&&!receipt){
      try{
        $('cancel-video').hidden=true;$('retry-submission').hidden=true;
        $('submission-status').textContent='写真と光の素材を保存しています…';
        materialPackage ||= await makeMaterialPackage(sourceFile,light,{termsVersion:collectionConfig.termsVersion});
        receipt=await collection.send(materialPackage);
        $('submission-status').textContent=`光を受け取りました。受付番号：${receipt.id}（取下げ時にお知らせください）`;
      }catch(error){$('submission-status').textContent=`素材の保存は確認できませんでした。${error.message} 動画は保存できます。`;$('retry-submission').hidden=false;}
    }
  }catch(error){$('recording-progress').textContent='';message(error.name==='AbortError'?'動画生成を中止しました。もう一度生成できます。':error.message,error.name!=='AbortError');}
  finally{suspendMusic();lock(false);controller=null;drawScene(preview,scene,0);}
};
$('cancel-video').onclick=()=>controller?.abort();$('save-video').onclick=()=>{if(videoBlob)void save(videoBlob,videoExt,videoTrackId?'-'+videoTrackId:'');};
$('retry-submission').onclick=async()=>{
  if(recording||!collectionConfig?.enabled)return;
  lock(true);$('cancel-video').hidden=true;$('retry-submission').hidden=true;
  try{materialPackage ||= await makeMaterialPackage(sourceFile,light,{termsVersion:collectionConfig.termsVersion});receipt=await collection.send(materialPackage);$('submission-status').textContent=`光を受け取りました。受付番号：${receipt.id}`;}
  catch(error){$('submission-status').textContent=error.message;$('retry-submission').hidden=false;}
  finally{lock(false);}
};
$('video').onerror=()=>message('この端末で生成動画を再生できませんでした。別の対応ブラウザをご利用ください。',true);
const xWebURL='https://x.com/intent/tweet?text='+encodeURIComponent(SHARE_TEXT);
const mobileX=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
$('share-x').href=mobileX?'twitter://post?message='+encodeURIComponent(SHARE_TEXT):xWebURL;
$('share-x').textContent=mobileX?'Xアプリで投稿 ↗':'Xで投稿 ↗';
$('share-x-web').href=xWebURL;
$('share-text').value=SHARE_TEXT;
$('copy-text').onclick=async()=>{try{await navigator.clipboard.writeText(SHARE_TEXT);message('投稿文とハッシュタグをコピーしました。');}catch{$('share-text').hidden=false;$('share-text').focus();$('share-text').select();message('自動コピーを利用できません。選択された投稿文を手動でコピーしてください。');}};
for(const [container,keys] of [['artist-links',[['artist','山形りおの紹介'],['music','楽曲を聴く']]],['event-links',[['ticket','チケット購入'],['album','ミニアルバム情報']]]])for(const [key,label] of keys){if(!LINKS[key])continue;const el=document.createElement('a');el.textContent=LINKS[key]?`${label} ↗`:`${label} · 公式リンク準備中`;if(LINKS[key]){el.href=LINKS[key];el.target='_blank';el.rel='noopener noreferrer';}$(container).append(el);}
changeMusic();drawScene(preview,createScene(null,null,selectedPhase()));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(animation);controller?.abort();suspendMusic();if(videoURL)URL.revokeObjectURL(videoURL);});
