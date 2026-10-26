// Standalone Apps Script. Never put account IDs or credentials in this file.
const TERMS_VERSION_ = 'draft-2026-10-27';
const TERMS_ = '自分で撮影した月の写真を提供します。写真および抽出した色・光・質感を、山形りお「ひかりは巡る」のCD盤面と本企画の告知物の制作・商用利用のために、運営と制作担当デザイナーが保存、加工、利用することに同意します。写真の採用や掲載は保証されません。位置情報は保存用画像から除去します。';
const HEADERS_ = ['投稿番号','受付日時','確認状況','素材フォルダ','プレビュー','色 RGB','明るさ','保存サイズ bytes','許諾版','メモ','フォルダID','内容ハッシュ'];

function ownerOnly_(){const user=Session.getActiveUser().getEmail();if(!user||user!==Session.getEffectiveUser().getEmail())throw Error('運営者だけが実行できます。');}
function setup(){ownerOnly_();setup_();}
function exportApproved(){ownerOnly_();exportApproved_();}

// Run only from the owner editor. Trailing underscore excludes RPC access.
function setup_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('SHEET_ID')) { console.log('設定済み: https://docs.google.com/spreadsheets/d/'+p.getProperty('SHEET_ID')); return; }
  const root = DriveApp.createFolder('ひかりは巡る・投稿素材（非公開）');
  const incoming = root.createFolder('投稿素材');
  const exports = root.createFolder('デザイナー用書き出し');
  const book = SpreadsheetApp.create('ひかりは巡る・投稿確認');
  DriveApp.getFileById(book.getId()).moveTo(root);
  const sheet = book.getSheets()[0].setName('投稿一覧');
  sheet.appendRow(HEADERS_); sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,HEADERS_.length).setBackground('#142333').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidth(1,290); sheet.setColumnWidth(2,180); sheet.setColumnWidths(3,3,150); sheet.setColumnWidth(10,280);
  sheet.getRange('C2:C10000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['未確認','採用','保留','不採用','取下げ'],true).setAllowInvalid(false).build());
  sheet.hideColumns(11,2);
  const guide = book.insertSheet('使い方');
  guide.getRange(1,1,8,2).setValues([
    ['ひかりは巡る｜素材管理','写真は公開しません'],
    ['確認','投稿一覧の素材フォルダを開き、確認状況を選択してください。'],
    ['書き出し','Apps Scriptで exportApproved を実行すると、採用のみをZIPにまとめます。'],
    ['保存内容','photo.jpg / moon.png / preview.jpg / light.json / consent.json'],
    ['photo.jpg','位置情報を除いた再エンコード画像。元ファイルそのものではありません。'],
    ['利用前の確認','月以外の写真、権利侵害、人物などが含まれないか人が確認してください。'],
    ['取下げ','確認状況を取下げに変更。過去のZIPや手渡し済み素材は別途回収が必要です。'],
    ['受付','初期状態は停止。運営者・連絡先・許諾内容を確定してから開始します。']
  ]); guide.setColumnWidth(1,170); guide.setColumnWidth(2,650); guide.getRange('A1:B8').setWrap(true);
  p.setProperties({ROOT_ID:root.getId(),INCOMING_ID:incoming.getId(),EXPORT_ID:exports.getId(),SHEET_ID:book.getId(),ENABLED:'false',OPERATOR:'',CONTACT:'',TERMS_APPROVED:'false',MAX_BYTES:String(1024*1024*1024),MAX_DAILY:'100'});
  console.log('投稿一覧: '+book.getUrl()); console.log('保存先: '+root.getUrl());
}

function publicConfig() {
  const p=PropertiesService.getScriptProperties();
  return {enabled:p.getProperty('ENABLED')==='true' && p.getProperty('TERMS_APPROVED')==='true' && !!p.getProperty('OPERATOR') && !!p.getProperty('CONTACT'),operator:p.getProperty('OPERATOR')||'',contact:p.getProperty('CONTACT')||'',terms:TERMS_,termsVersion:TERMS_VERSION_};
}

function doGet(e) {
  const t=HtmlService.createTemplateFromFile('Bridge');
  t.nonce=/^[a-f0-9]{64}$/.test(e && e.parameter.nonce || '')?e.parameter.nonce:'';
  return t.evaluate().setTitle('ひかりは巡る・素材受付').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function validate_(value) {
  if(!value || value.schema!==1 || !/^[a-f0-9-]{36}$/.test(value.id) || value.agreed!==true || value.termsVersion!==TERMS_VERSION_) throw Error('許諾内容または投稿番号を確認してください。');
  const names=['photo.jpg','moon.png','preview.jpg','light.json'];
  if(!Array.isArray(value.files)||value.files.length!==4) throw Error('素材が不足しています。');
  let total=0;
  const blobs=names.map(name=>{
    const f=value.files.find(x=>x.name===name);
    if(!f || typeof f.base64!=='string' || f.base64.length>11200000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64)) throw Error('素材の形式を確認してください。');
    const bytes=Utilities.base64Decode(f.base64); total+=bytes.length;
    const u=n=>bytes[n]&255;
    const type=name.endsWith('.jpg')?'image/jpeg':name.endsWith('.png')?'image/png':'application/json';
    if(type==='image/jpeg' && (u(0)!==255||u(1)!==216||u(2)!==255))throw Error('JPEGが不正です。');
    if(type==='image/png' && [137,80,78,71,13,10,26,10].some((x,i)=>u(i)!==x))throw Error('PNGが不正です。');
    if(!bytes.length)throw Error('空の素材です。');
    return Utilities.newBlob(bytes,type,name);
  });
  if(total>8*1024*1024)throw Error('素材の合計は8MBまでです。');
  const jsonBlob=blobs[3]; if(jsonBlob.getBytes().length>100000)throw Error('光データが大きすぎます。');
  let data; try {data=JSON.parse(jsonBlob.getDataAsString());}catch(_){throw Error('光データが不正です。');}
  const l=data.light;
  if(data.schema!==1||data.id!==value.id||!l||!Array.isArray(l.meanRGB)||l.meanRGB.length!==3||l.meanRGB.some(x=>!Number.isInteger(x)||x<0||x>255)||!Number.isFinite(l.brightness)||l.brightness<0||l.brightness>1||!Array.isArray(l.samples)||l.samples.length!==100)throw Error('光データの内容が不正です。');
  return {blobs,total,data};
}

function submitPublic(value) {
  if(!publicConfig().enabled)throw Error('写真の受付は現在停止しています。');
  const checked=validate_(value);
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value.files));
  const hash=Utilities.base64EncodeWebSafe(digest);
  const lock=LockService.getScriptLock(); if(!lock.tryLock(10000))throw Error('受付が混み合っています。同じ写真で再送してください。');
  try {
    const p=PropertiesService.getScriptProperties(), sheet=SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getSheetByName('投稿一覧');
    const rows=sheet.getDataRange().getValues().slice(1);
    const previous=rows.find(r=>r[0]===value.id);
    if(previous){if(previous[11]!==hash)throw Error('同じ投稿番号の内容が異なります。');return {ok:true,id:value.id,duplicate:true};}
    const now=new Date(), day=Utilities.formatDate(now,'Asia/Tokyo','yyyy-MM-dd');
    const limit=Number(p.getProperty('MAX_BYTES')), daily=Number(p.getProperty('MAX_DAILY'));
    const used=rows.reduce((n,r)=>n+(Number(r[7])||0),0);
    if(!Number.isFinite(limit)||!Number.isFinite(daily)||used+checked.total>limit||rows.filter(r=>String(r[1]).startsWith(day)).length>=daily)throw Error('本日の受付または保存容量の上限に達しました。');
    const driveLimit=DriveApp.getStorageLimit();
    if(driveLimit>0 && driveLimit-DriveApp.getStorageUsed()<checked.total+512*1024*1024)throw Error('保存先の空き容量が不足しています。');
    const parent=DriveApp.getFolderById(p.getProperty('INCOMING_ID'));
    // Recover an interrupted write for this unguessable ID; only the configured inbox is touched.
    const stale=parent.getFoldersByName(value.id);while(stale.hasNext())stale.next().setTrashed(true);
    const folder=parent.createFolder(value.id); let committed=false;
    try {
      let preview=''; checked.blobs.forEach(b=>{const file=folder.createFile(b);if(b.getName()==='preview.jpg')preview=file.getUrl();});
      const config=publicConfig(), receivedAt=Utilities.formatDate(now,'Asia/Tokyo',"yyyy-MM-dd'T'HH:mm:ssXXX");
      folder.createFile('consent.json',JSON.stringify({id:value.id,receivedAt,agreed:true,termsVersion:TERMS_VERSION_,terms:TERMS_,operator:config.operator,contact:config.contact},null,2),MimeType.PLAIN_TEXT);
      sheet.appendRow([value.id,receivedAt,'未確認',folder.getUrl(),preview,checked.data.light.meanRGB.join(', '),checked.data.light.brightness,checked.total,TERMS_VERSION_,'',folder.getId(),hash]);
      SpreadsheetApp.flush(); committed=true;
      return {ok:true,id:value.id};
    } catch(error) {
      // Check actual sheet state before rollback if flush threw after append committed.
      const exists=sheet.getDataRange().getValues().some(r=>r[0]===value.id);
      if(!committed&&!exists)folder.setTrashed(true);
      if(exists)return {ok:true,id:value.id};
      throw Error('保存を完了できませんでした。同じ写真で再送してください。');
    }
  } finally {lock.releaseLock();}
}

function exportApproved_() {
  const p=PropertiesService.getScriptProperties(),book=SpreadsheetApp.openById(p.getProperty('SHEET_ID'));
  const rows=book.getSheetByName('投稿一覧').getDataRange().getValues().slice(1).filter(r=>r[2]==='採用');
  if(!rows.length)throw Error('採用の素材がありません。');
  // Small independent ZIPs avoid Apps Script memory/execution limits.
  const target=DriveApp.getFolderById(p.getProperty('EXPORT_ID')).createFolder(Utilities.formatDate(new Date(),'Asia/Tokyo','yyyyMMdd-HHmmss'));
  let blobs=[],bytes=0,part=1,manifest=[];
  function flush(){if(!blobs.length)return;blobs.push(Utilities.newBlob(JSON.stringify({schema:1,materials:manifest},null,2),'application/json','manifest.json'));target.createFile(Utilities.zip(blobs,'hikari-materials-'+(part++)+'.zip'));blobs=[];bytes=0;manifest=[];}
  rows.forEach(r=>{
    const folder=DriveApp.getFolderById(r[10]);
    const parents=folder.getParents();let valid=false;while(parents.hasNext())if(parents.next().getId()===p.getProperty('INCOMING_ID'))valid=true;
    if(!valid||folder.isTrashed()||folder.getName()!==r[0])throw Error('保存先の整合性を確認してください: '+r[0]);
    const files=folder.getFiles(),batch=[];let size=0;
    while(files.hasNext()){const f=files.next();if(['photo.jpg','moon.png','preview.jpg','light.json','consent.json'].indexOf(f.getName())<0)continue;size+=f.getSize();batch.push(f.getBlob().setName(r[0]+'/'+f.getName()));}
    if(batch.length!==5)throw Error('素材が不足しています: '+r[0]);
    if(bytes+size>20*1024*1024)flush();blobs=blobs.concat(batch);bytes+=size;manifest.push({id:r[0],termsVersion:r[8],status:'採用'});
  });flush();console.log('デザイナー用ZIP（非公開）: '+target.getUrl());
}
