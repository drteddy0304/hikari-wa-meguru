// Deploy the generated Code.gs with ../Bridge.html. Private settings live in Script Properties.
const DBX_SCOPES_='account_info.read files.metadata.read files.content.write';
const MATERIAL_NAMES_={'photo.jpg':'01_送ってもらった月の写真.jpg','moon.png':'02_抽出した月の光.png','preview.jpg':'03_確認用の小さな写真.jpg','light.json':'制作・管理データ/光の色と質感.json','consent.json':'制作・管理データ/送信時の記録.json','_complete.json':'制作・管理データ/保存完了.json'};
function headerJSON_(value){return JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>'\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4));}
function materialRoot_(testOnly){return testOnly?'/動作確認用（制作には使いません）':'/届いた写真と光素材';}
function moveMaterial_(from,to){
  const source=metadata_(from);if(!source)return;
  if(metadata_(to))throw Error('移動先が既に存在します。上書きせず停止しました。');
  const r=rpc_('files/move_v2',{from_path:from,to_path:to,autorename:false});
  if(r.status!==200)throw safeError_();
  const after=metadata_(to);
  if(!after||after['.tag']!==source['.tag']||(source.content_hash&&after.content_hash!==source.content_hash))throw safeError_();
}
function prepareMaterialRoot_(testOnly){
  const root=materialRoot_(testOnly),old=testOnly?'/connection-tests':'/submissions';
  if(!metadata_(root)){if(metadata_(old))moveMaterial_(old,root);else ensureFolder_(root);}
  return root;
}
function prepareMaterialBase_(root,id){
  const base=root+'/投稿_'+id;
  moveMaterial_(root+'/'+id,base);
  if(metadata_(base)){
    ensureFolder_(base+'/制作・管理データ');
    Object.keys(MATERIAL_NAMES_).forEach(name=>moveMaterial_(base+'/'+name,base+'/'+MATERIAL_NAMES_[name]));
  }
  return base;
}
// Uses the same lock as intake; safe to rerun after an interruption. Never overwrites or deletes.
function organizeDropboxMaterials(){ownerOnly_();return locked_(()=>{
  let count=0;
  for(const testOnly of [false,true]){
    const root=prepareMaterialRoot_(testOnly);let page=rpc_('files/list_folder',{path:root,limit:2000});
    const entries=[];
    while(true){if(page.status!==200)throw safeError_();entries.push(...page.data.entries);if(!page.data.has_more)break;page=rpc_('files/list_folder/continue',{cursor:page.data.cursor});}
    for(const entry of entries){const id=String(entry.name).replace(/^投稿_/,'');if(entry['.tag']==='folder'&&/^[a-f0-9-]{36}$/.test(id)){prepareMaterialBase_(root,id);count++;}}
  }
  console.log('日本語の名前に整理しました: '+count+'件');return {ok:true,count};
});}
// Uses deliberately invalid credentials; never reads or prints participant data or secrets.
function diagnoseDropboxTransport(){
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  ownerOnly_();
  const verifier='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  console.log('PKCE RFC7636 vector: '+(base64url_(sha_(verifier))==='E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));
  const payload={grant_type:'authorization_code',client_id:required_('DBX_APP_KEY'),code:'diagnostic-invalid-code',code_verifier:verifier,redirect_uri:required_('DBX_REDIRECT_URI')};
  for(const host of ['api.dropboxapi.com','api.dropbox.com']){
    try{
      const r=UrlFetchApp.fetch('https://'+host+'/oauth2/token',{method:'post',payload,muteHttpExceptions:true,followRedirects:false});
      let data={};try{data=JSON.parse(r.getContentText());}catch(_){}
      const category=['invalid_grant','invalid_client','invalid_request','unsupported_grant_type'].includes(data.error)?data.error:'unexpected_response';
      console.log(host+' HTTP '+r.getResponseCode()+' '+category);
    }catch(e){console.log(host+' transport exception: '+String(e.message).replace(/https?:\/\/\S+/g,'[endpoint]').slice(0,350));}
  }
}
function properties_(){return PropertiesService.getScriptProperties();}
function startCollection(){
  ownerOnly_();
  if(!accessConfirmed_())throw Error('保存先の設定が未完了です。');
  const account=rpc_('users/get_current_account');
  if(account.status!==200||account.data.account_id!==required_('DBX_ACCOUNT_ID')||String(account.data.email).toLowerCase()!==required_('EXPECTED_DROPBOX_EMAIL').toLowerCase())throw Error('保存先の照合に失敗しました。');
  properties_().setProperties({ENABLED:'true',TERMS_APPROVED:'true',OPERATOR:'',CONTACT:''});
  console.log('写真と光素材の受付を開始しました。運営名・連絡先は公開しません。');
}
function accessConfirmed_(){const p=properties_();return p.getProperty('DBX_ACCESS_MODE')==='app_folder'||p.getProperty('DEDICATED_FULL_DROPBOX_CONFIRMED')==='true';}
function locked_(fn){const l=LockService.getScriptLock();if(!l.tryLock(10000))throw Error('受付が混み合っています。時間をおいて再試行してください。');try{return fn();}finally{l.releaseLock();}}
function ownerOnly_(){const u=Session.getActiveUser().getEmail();if(!u||u!==Session.getEffectiveUser().getEmail())throw Error('運営者だけが実行できます。');}
function required_(key){const value=properties_().getProperty(key);if(!value)throw Error('運営側の接続設定が未完了です。');return value;}
function sha_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value);}
function hex_(bytes){return bytes.map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function base64url_(bytes){return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');}
function contentHash_(bytes){let blocks=[];for(let i=0;i<bytes.length;i+=4194304)blocks=blocks.concat(sha_(bytes.slice(i,i+4194304)));return hex_(sha_(blocks));}
function safeError_(){return Error('Dropboxへの保存を確認できませんでした。同じ写真で再試行してください。');}
function tokenRequest_(payload){
  const r=UrlFetchApp.fetch('https://api.dropboxapi.com/oauth2/token',{method:'post',payload,muteHttpExceptions:true,followRedirects:false});
  if(r.getResponseCode()!==200)throw Error('Dropbox連携の認証を確認してください。');
  const result=JSON.parse(r.getContentText());if(!result.access_token)throw Error('Dropbox連携の認証を確認してください。');return result;
}
function token_(){
  const cache=CacheService.getScriptCache();let token=cache.get('dbx-access');if(token)return token;
  const result=tokenRequest_({grant_type:'refresh_token',refresh_token:required_('DBX_REFRESH_TOKEN'),client_id:required_('DBX_APP_KEY')});
  cache.put('dbx-access',result.access_token,Math.max(1,Math.min(3600,(Number(result.expires_in)||300)-60)));return result.access_token;
}
function rpc_(route,arg,access){
  const r=UrlFetchApp.fetch('https://api.dropboxapi.com/2/'+route,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+(access||token_())},payload:JSON.stringify(arg===undefined?null:arg),muteHttpExceptions:true,followRedirects:false});
  const status=r.getResponseCode();let data;try{data=JSON.parse(r.getContentText());}catch(_){throw safeError_();}
  if(status===401)CacheService.getScriptCache().remove('dbx-access');
  return {status,data};
}
function metadata_(path){
  const r=rpc_('files/get_metadata',{path});
  if(r.status===200)return r.data;
  if(r.status===409&&r.data.error&&r.data.error['.tag']==='path'&&r.data.error.path['.tag']==='not_found')return null;
  throw safeError_();
}
function ensureFolder_(path){
  const existing=metadata_(path);
  if(existing){if(existing['.tag']!=='folder')throw safeError_();return;}
  const result=rpc_('files/create_folder_v2',{path,autorename:false});
  if(result.status!==200)throw safeError_();
}
function upload_(path,blob){
  const expected=contentHash_(blob.getBytes()),existing=metadata_(path);
  if(existing){if(existing['.tag']!=='file'||existing.content_hash!==expected)throw Error('同じ投稿番号の素材が異なります。運営にお問い合わせください。');return existing;}
  const arg={path,mode:'add',autorename:false,strict_conflict:true,mute:true,content_hash:expected};
  const r=UrlFetchApp.fetch('https://content.dropboxapi.com/2/files/upload',{method:'post',contentType:'application/octet-stream',headers:{Authorization:'Bearer '+token_(),'Dropbox-API-Arg':headerJSON_(arg)},payload:blob.getBytes(),muteHttpExceptions:true,followRedirects:false});
  if(r.getResponseCode()!==200)throw safeError_();
  const saved=JSON.parse(r.getContentText());if(saved.content_hash!==expected)throw safeError_();return saved;
}
function jsonBlob_(name,value){return Utilities.newBlob(JSON.stringify(value,null,2),'application/json',name);}

// Editor-only entry: checks identity even though it is visible to google.script.run.
function prepareDropboxConnection(){
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  ownerOnly_();
  // Fail locally before asking the remote owner to authorize anything.
  const probe=UrlFetchApp.fetch('https://api.dropboxapi.com/oauth2/token',{method:'post',payload:{grant_type:'authorization_code',client_id:required_('DBX_APP_KEY'),code:'diagnostic-invalid-code',code_verifier:'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',redirect_uri:required_('DBX_REDIRECT_URI')},muteHttpExceptions:true,followRedirects:false});
  let probeData;try{probeData=JSON.parse(probe.getContentText());}catch(_){throw Error('通信の事前確認に失敗しました。リンクは発行していません。');}
  if(probe.getResponseCode()!==400||probeData.error!=='invalid_grant')throw Error('通信の事前確認に失敗しました。リンクは発行していません。');
  return locked_(()=>{
  const p=properties_();if(p.getProperty('ENABLED')==='true'||p.getProperty('DBX_REFRESH_TOKEN'))throw Error('既存の接続を自動で置き換えることはできません。');
  if(!accessConfirmed_())throw Error('Dropbox App Consoleのアクセス範囲を確認してください。');
  const key=required_('DBX_APP_KEY'),redirect=required_('DBX_REDIRECT_URI'),expected=required_('EXPECTED_DROPBOX_EMAIL');
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(redirect)||!expected.includes('@'))throw Error('接続設定を確認してください。');
  // UUIDs are generated by Apps Script, not Math.random; state/verifier never enter public source.
  const state=Utilities.getUuid()+Utilities.getUuid(),verifier=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
  p.setProperty('DBX_PENDING',JSON.stringify({stateHash:hex_(sha_(state)),verifier,expires:Date.now()+60*60*1000}));
  const params={client_id:key,response_type:'code',redirect_uri:redirect,token_access_type:'offline',scope:DBX_SCOPES_,state,code_challenge:base64url_(sha_(verifier)),code_challenge_method:'S256',force_reapprove:'true'};
  const url='https://www.dropbox.com/oauth2/authorize?'+Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
  console.log('保存先の所有者が開く連携URL（1時間・1回限り。公開しない）: '+url);
  return '連携URLを実行ログに表示しました。';
});}
function callback_(params){return locked_(()=>{
  const p=properties_();let pending,last;try{pending=JSON.parse(p.getProperty('DBX_PENDING')||'null');last=JSON.parse(p.getProperty('DBX_LAST_RESULT')||'null');}catch(_){}
  const hash=typeof params.state==='string'?hex_(sha_(params.state)):'';
  if(last&&last.stateHash===hash&&last.expires>Date.now())return last.message;
  if(!pending||pending.expires<Date.now()||typeof params.state!=='string'||hex_(sha_(params.state))!==pending.stateHash)throw Error('連携リンクの期限が切れたか、使用済みです。運営者に再発行を依頼してください。');
  let stage='認証応答';
  try{
  p.deleteProperty('DBX_PENDING');
  if(params.error||typeof params.code!=='string'||!params.code||params.code.length>2048)throw Error('連携は完了していません。');
  if(p.getProperty('DBX_REFRESH_TOKEN'))throw Error('接続済みです。');
  stage='認証コード交換';
  const result=tokenRequest_({grant_type:'authorization_code',code:params.code,code_verifier:pending.verifier,client_id:required_('DBX_APP_KEY'),redirect_uri:required_('DBX_REDIRECT_URI')});
  stage='専用アカウント照合';
  const account=rpc_('users/get_current_account',null,result.access_token);
  p.setProperty('DBX_ACCOUNT_DIAGNOSTIC',JSON.stringify({status:account.status,emailVerified:account.data.email_verified===true,emailMatches:String(account.data.email).toLowerCase()===required_('EXPECTED_DROPBOX_EMAIL').toLowerCase()}));
  if(account.status!==200||account.data.email_verified!==true||String(account.data.email).toLowerCase()!==required_('EXPECTED_DROPBOX_EMAIL').toLowerCase()){
    throw Error('指定された企画専用アカウントではありません。');
  }
  stage='連携権限確認';
  // Keep verified-account credentials separate from the active connection.
  // A validation failure must not silently revoke the owner's authorization.
  if(result.refresh_token)p.setProperty('DBX_RECOVERY',JSON.stringify({refreshToken:result.refresh_token,accountId:account.data.account_id,scope:typeof result.scope==='string'?result.scope:null,receivedAt:Date.now()}));
  const scopes=new Set(typeof result.scope==='string'?result.scope.trim().split(/\s+/).filter(Boolean):[]);
  const missing=DBX_SCOPES_.split(' ').filter(s=>!scopes.has(s));
  const extra=[...scopes].filter(s=>!DBX_SCOPES_.split(' ').includes(s));
  p.setProperty('DBX_SCOPE_DIAGNOSTIC',JSON.stringify({hasRefreshToken:!!result.refresh_token,scopeIsString:typeof result.scope==='string',missing,extra:extra.map(s=>/^[a-z_.]{1,80}$/.test(s)?s:'unrecognized'),at:Date.now()}));
  if(!result.refresh_token||missing.length||extra.length)throw Error('連携権限を確認してください。');
  stage='接続情報保存';
  p.setProperties({DBX_REFRESH_TOKEN:result.refresh_token,DBX_ACCOUNT_ID:account.data.account_id,ENABLED:'false'});
  p.deleteProperty('DBX_RECOVERY');
  CacheService.getScriptCache().remove('dbx-access');
  const message='Dropboxの連携が完了しました。写真の受付はまだ停止中です。この画面を閉じて運営者にお知らせください。';
  p.setProperty('DBX_LAST_RESULT',JSON.stringify({stateHash:hash,expires:Date.now()+3600000,message}));return message;
  }catch(error){
    // Do not persist raw provider errors, codes, tokens or personal information.
    const message='連携は完了していません（'+stage+'）。この表示を運営者にお知らせください。';
    p.setProperty('DBX_LAST_RESULT',JSON.stringify({stateHash:hash,expires:Date.now()+3600000,message}));
    throw Error(message);
  }
});}
function doGet(e){
  const params=e&&e.parameter||{};
  if(params.code||params.error||params.state){let text;try{text=callback_(params);}catch(error){text=error.message;}return HtmlService.createHtmlOutput('<meta name="referrer" content="no-referrer"><p>'+String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>').setTitle('ひかりは巡る・Dropbox連携');}
  const t=HtmlService.createTemplateFromFile('Bridge');t.nonce=/^[a-f0-9]{64}$/.test(params.nonce||'')?params.nonce:'';
  return t.evaluate().setTitle('ひかりは巡る・素材受付').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function publicConfig(){const p=properties_();return {enabled:p.getProperty('ENABLED')==='true'&&p.getProperty('TERMS_APPROVED')==='true'&&accessConfirmed_()&&!!p.getProperty('DBX_REFRESH_TOKEN'),provider:'dropbox',operator:p.getProperty('OPERATOR')||'',contact:p.getProperty('CONTACT')||'',terms:TERMS_,termsVersion:TERMS_VERSION_};}
function reserve_(bytes){
  const p=properties_(),day=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');
  const total=Number(p.getProperty('RESERVED_BYTES')||0),max=Number(p.getProperty('MAX_BYTES')||1073741824),count=p.getProperty('DAY')===day?Number(p.getProperty('DAILY_COUNT')||0):0,limit=Number(p.getProperty('MAX_DAILY')||100);
  if(![total,max,count,limit,bytes].every(Number.isFinite)||bytes<0||total+bytes>max||count>=limit)throw Error('本日の受付または保存容量の上限に達しました。');
  const space=rpc_('users/get_space_usage');if(space.status!==200)throw safeError_();
  const free=Number(space.data.allocation&&space.data.allocation.allocated)-Number(space.data.used);
  if(!Number.isFinite(free)||free<bytes+512*1024*1024)throw Error('保存先の空き容量が不足しています。');
  // Conservative reservations survive failures; retries may consume an additional reservation.
  p.setProperties({RESERVED_BYTES:String(total+bytes),DAY:day,DAILY_COUNT:String(count+1)});
}
function submitPublic(value){
  if(!publicConfig().enabled)throw Error('写真の受付は現在停止しています。');
  return saveSubmission_(value,false);
}
// Owner-only integration check uses the same validation/upload path while intake is closed.
function testDropboxSave(value){ownerOnly_();return saveSubmission_(value,true);}
function saveSubmission_(value,testOnly){
  const checked=validate_(value);
  return locked_(()=>{
    if(!testOnly&&!publicConfig().enabled)throw Error('写真の受付は現在停止しています。');
    if(testOnly)ownerOnly_();
    const root=prepareMaterialRoot_(testOnly);
    // google.script.run may reorder object properties between otherwise identical requests.
    const digest=hex_(sha_(JSON.stringify(checked.blobs.map(b=>[b.getName(),contentHash_(b.getBytes())])))),base=prepareMaterialBase_(root,value.id);
    const receipt=jsonBlob_('_complete.json',{schema:1,id:value.id,digest});
    const previous=metadata_(base+'/'+MATERIAL_NAMES_['_complete.json']);
    if(previous){if(previous.content_hash!==contentHash_(receipt.getBytes()))throw Error('同じ投稿番号の内容が異なります。');return {ok:true,id:value.id,duplicate:true};}
    reserve_(checked.total+16384);
    ensureFolder_(base);ensureFolder_(base+'/制作・管理データ');
    const first=upload_(base+'/'+MATERIAL_NAMES_['photo.jpg'],checked.blobs[0]);
    checked.blobs.slice(1).forEach(b=>upload_(base+'/'+MATERIAL_NAMES_[b.getName()],b));
    const config=publicConfig();
    // First file's immutable server timestamp makes interrupted uploads retryable.
    upload_(base+'/'+MATERIAL_NAMES_['consent.json'],jsonBlob_('consent.json',testOnly?{id:value.id,testOnly:true,synthetic:true,receivedAt:first.server_modified}:{id:value.id,receivedAt:first.server_modified,agreed:true,termsVersion:TERMS_VERSION_,terms:TERMS_,operator:config.operator,contact:config.contact}));
    upload_(base+'/'+MATERIAL_NAMES_['_complete.json'],receipt);
    return {ok:true,id:value.id};
  });
}
