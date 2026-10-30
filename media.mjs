import { DURATION, recordingType } from './core.mjs';
import { drawScene } from './render.mjs';
export function canvasBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像を生成できませんでした。')),'image/png'));
}
export async function recordScene(canvas, scene, { signal, onProgress=()=>{}, audio=null }={}) {
  const type=recordingType(globalThis.MediaRecorder,{audio:!!audio});
  if(!type)throw new Error(audio?'このブラウザは音楽付き動画の記録形式に対応していません。「音楽なし」か画像版をご利用ください。':'このブラウザは動画生成に対応していません。画像版を保存するか、別のブラウザでお試しください。');
  if(signal?.aborted)throw new DOMException('動画生成を中止しました。','AbortError');
  if(audio){
    if(!audio.context || !audio.buffer || audio.buffer.duration<DURATION-.05)throw new Error('動画に使う12秒の音源を準備できていません。');
    // Called directly from the record button gesture, after the clip was decoded.
    let timer;
    try{
      await Promise.race([
        audio.context.resume(),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('音声を開始できませんでした。もう一度動画生成ボタンを押してください。')),5000);}),
      ]);
    }finally{clearTimeout(timer);}
    if(signal?.aborted){void audio.context.suspend();throw new DOMException('動画生成を中止しました。','AbortError');}
    if(audio.context.state!=='running')throw new Error('音声を開始できませんでした。もう一度動画生成ボタンを押してください。');
  }
  return new Promise((resolve,reject)=>{
    let stream,recorder,frame,watchdog,ended=false,stopTimer,source,gain,audioDestination;const chunks=[];
    const cleanup=()=>{
      cancelAnimationFrame(frame);clearTimeout(watchdog);clearTimeout(stopTimer);
      if(source){try{source.stop();}catch{}source.disconnect();}
      gain?.disconnect();audioDestination?.disconnect();
      stream?.getTracks().forEach(t=>t.stop());
      if(audio)void audio.context.suspend().catch(()=>{});
      document.removeEventListener('visibilitychange',onVisibility);signal?.removeEventListener('abort',onAbort);
    };
    const fail=error=>{if(ended)return;ended=true;cleanup();if(recorder && recorder.state!=='inactive')try{recorder.stop();}catch{}reject(error);};
    const onVisibility=()=>{if(document.hidden)fail(new Error('画面が非表示になったため動画生成を中止しました。画面を開いたまま、もう一度お試しください。'));};
    const onAbort=()=>fail(new DOMException('動画生成を中止しました。','AbortError'));
    if(signal?.aborted){onAbort();return;}
    if(document.hidden){fail(new Error('画面を表示してから、もう一度動画を生成してください。'));return;}
    document.addEventListener('visibilitychange',onVisibility);signal?.addEventListener('abort',onAbort,{once:true});
    try{
      drawScene(canvas,scene,0);stream=canvas.captureStream(24);
      if(audio){
        source=audio.context.createBufferSource();source.buffer=audio.buffer;
        gain=audio.context.createGain();audioDestination=audio.context.createMediaStreamDestination();
        source.connect(gain);gain.connect(audioDestination);
        const tracks=audioDestination.stream.getAudioTracks();
        if(tracks.length!==1)throw new Error('音声トラックを準備できませんでした。');
        stream.addTrack(tracks[0]);
      }
      recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:5_000_000,...(audio?{audioBitsPerSecond:192_000}:{})});
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>fail(new Error('端末で動画を記録できませんでした。画像保存か、別の対応ブラウザをご利用ください。'));
      recorder.onstop=()=>{
        if(ended)return;ended=true;cleanup();
        const mime=recorder.mimeType || type,blob=new Blob(chunks,{type:mime});
        if(blob.size<1000){reject(new Error('動画データが不完全です。画像版を保存するか、再度お試しください。'));return;}
        resolve({blob,mime,extension:mime.includes('mp4')?'mp4':'webm',seconds:DURATION,music:audio?.track || null});
      };
      recorder.start(250);const start=performance.now();
      if(audio){
        const at=audio.context.currentTime;
        gain.gain.setValueAtTime(0,at);
        gain.gain.linearRampToValueAtTime(.85,at+.02);
        gain.gain.setValueAtTime(.85,at+DURATION-.3);
        gain.gain.linearRampToValueAtTime(0,at+DURATION);
        source.start(at,0,DURATION);
      }
      const tick=now=>{if(ended)return;const elapsed=Math.min(DURATION,(now-start)/1000);drawScene(canvas,scene,elapsed);onProgress(elapsed/DURATION);if(elapsed<DURATION)frame=requestAnimationFrame(tick);};
      frame=requestAnimationFrame(tick);
      stopTimer=setTimeout(()=>{if(!ended){drawScene(canvas,scene,DURATION);recorder.stop();}},DURATION*1000+100);
      watchdog=setTimeout(()=>fail(new Error('動画生成が時間内に完了しませんでした。画像版を保存してください。')),20_000);
    }catch(error){fail(error);}
  });
}
export function download(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
// Called from a fresh button gesture with a prepared Blob; do not encode before navigator.share().
export async function saveFile(blob,name) {
  const file=new File([blob],name,{type:blob.type.split(';')[0]});
  if(navigator.share && navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file],title:'山形りお「ひかりはめぐる」'});return 'shared';}
    catch(error){if(error.name==='AbortError')return 'cancelled';}
  }
  download(blob,name);return 'download';
}
