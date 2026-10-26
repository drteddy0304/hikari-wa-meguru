import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const source=fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const terms='draft-2026-10-27',id='12345678-1234-4234-8234-123456789abc';
function payload(){const light={meanRGB:[220,210,160],brightness:.6,samples:Array(100).fill({})};return {schema:1,id,agreed:true,termsVersion:terms,files:[['photo.jpg',Buffer.from([255,216,255,1])],['moon.png',Buffer.from([137,80,78,71,13,10,26,10,1])],['preview.jpg',Buffer.from([255,216,255,2])],['light.json',Buffer.from(JSON.stringify({schema:1,id,light}))]].map(([name,bytes])=>({name,base64:bytes.toString('base64')}))};}
function environment({failAppend=false,failFlush=false,enabled=true,owner=false}={}){
  const props={ENABLED:String(enabled),TERMS_APPROVED:'true',OPERATOR:'test',CONTACT:'test@example.invalid',SHEET_ID:'sheet',INCOMING_ID:'inbox',MAX_BYTES:'1073741824',MAX_DAILY:'100'};
  const rows=[[]],folders=[];let releases=0;
  function blob(bytes,type,name){const buf=Buffer.from(bytes);return {getBytes:()=>Array.from(buf),getDataAsString:()=>buf.toString(),getName:()=>name};}
  const sheet={getDataRange:()=>({getValues:()=>rows}),appendRow:r=>{if(failAppend)throw Error('write failed');rows.push(r);}};
  const ctx=vm.createContext({console,Date,JSON,Number,Error,Array,String,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},Session:{getActiveUser:()=>({getEmail:()=>owner?'owner@example.invalid':''}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})},Utilities:{base64Decode:s=>Array.from(Buffer.from(s,'base64')),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),newBlob:blob,DigestAlgorithm:{SHA_256:1},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),formatDate:()=> '2026-11-01T12:00:00+09:00'},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>releases++})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{if(failFlush)throw Error('flush failed');}},DriveApp:{getStorageLimit:()=>15e9,getStorageUsed:()=>0,getFolderById:()=>({getFoldersByName:()=>({hasNext:()=>false}),createFolder:name=>{const f={name,trashed:false,files:[],createFile(b){this.files.push(b);return {getUrl:()=> 'private-preview'};},getUrl:()=> 'private-folder',getId:()=> 'folder',setTrashed(v){this.trashed=v;}};folders.push(f);return f;}})},MimeType:{PLAIN_TEXT:'text/plain'}});
  vm.runInContext(source,ctx);return {ctx,rows,folders,props,releases:()=>releases};
}
test('closed collection rejects without creating files',()=>{const e=environment({enabled:false});assert.throws(()=>e.ctx.submitPublic(payload()),/停止/);assert.equal(e.folders.length,0);});
test('consent and signatures checked before writes',()=>{const e=environment();let p=payload();p.agreed=false;assert.throws(()=>e.ctx.submitPublic(p),/許諾/);p=payload();p.files[0].base64='YQ==';assert.throws(()=>e.ctx.submitPublic(p),/JPEG/);assert.equal(e.folders.length,0);});
test('successful receipt has no private asset links, retry idempotent',()=>{const e=environment();const a=e.ctx.submitPublic(payload());assert.equal(a.ok,true);assert.deepEqual(Object.keys(a).sort(),['id','ok']);assert.equal(e.folders[0].files.length,5);assert.equal(e.rows.length,2);assert.equal(e.ctx.submitPublic(payload()).duplicate,true);assert.equal(e.folders.length,1);assert.equal(e.releases(),2);});
test('same ID with different contents rejected',()=>{const e=environment();e.ctx.submitPublic(payload());const p=payload();p.files[0].base64=Buffer.from([255,216,255,4]).toString('base64');assert.throws(()=>e.ctx.submitPublic(p),/異なります/);});
test('failed row append rolls back only newly created folder',()=>{const e=environment({failAppend:true});assert.throws(()=>e.ctx.submitPublic(payload()),/完了できません/);assert.equal(e.folders[0].trashed,true);assert.equal(e.rows.length,1);assert.equal(e.releases(),1);});
test('flush failure after row append preserves committed files',()=>{const e=environment({failFlush:true});assert.equal(e.ctx.submitPublic(payload()).ok,true);assert.equal(e.folders[0].trashed,false);});
test('capacity cap prevents files',()=>{const e=environment();e.props.MAX_BYTES='1';assert.throws(()=>e.ctx.submitPublic(payload()),/上限/);assert.equal(e.folders.length,0);});
test('anonymous caller cannot setup or export',()=>{const e=environment();assert.throws(()=>e.ctx.setup(),/運営者/);assert.throws(()=>e.ctx.exportApproved(),/運営者/);});
