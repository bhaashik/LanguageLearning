import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {allItems,byId,scriptItems,grammarItems,phoneticsItems} from '../content.js';
import {toDevanagari,broadIPA} from '../linguistics.js';
import {emptyProgress,recordAnswer,sectionScores,startSession,ensureSession,SESSION_GAP,validateProgress} from '../learning.js';
import {clipKey,validateEndpoint,exportAudio} from '../audio-store.js';
import {packZip,unpackZip} from '../zip.js';
import {handleSpeech} from '../scripts/speech.mjs';

test('every script symbol has an honest example and all study content has transcription and gloss',()=>{
  let teaching=0;
  for(const item of scriptItems){
    assert.ok(item.example,item.id);
    if(item.example.type==='word')assert.ok(byId[item.example.itemId].ml.includes(item.ml),`${item.ml} is missing from its example`);
    else {teaching++;assert.equal(item.example.type,'teaching');assert.match(item.example.meaning,/Rare/);}
  }
  assert.equal(teaching,4,'three rare vocalic vowels and rare chillu k are marked, not assigned fabricated everyday words');
  for(const item of allItems){assert.ok(item.ipa,item.id);assert.match(item.devanagari,/[\u0900-\u097f]/);assert.ok(item.gloss.length);for(const p of item.gloss)assert.ok(p.ml&&p.roman&&p.gloss);}
});
test('extended Devanagari preserves short/long e/o, the Malayalam rhotic, approximant, and chillus',()=>{
  assert.equal(toDevanagari('എ ഏ ഒ ഓ ഴ റ ൻ ൾ'),'ऎ ए ऒ ओ ऴ ऱ न् ळ्');
  assert.equal(toDevanagari('കി കാ കെ കോ'),'कि का कॆ को');
  assert.equal(broadIPA('veḷḷaṃ'),'ʋeɭːɐm');
  assert.notEqual(broadIPA('kaṭi'),broadIPA('kaṭṭi'));
});
test('grammar and phonetics ask actual questions with distinct, valid answer choices',()=>{
  assert.equal(grammarItems.length,6);assert.equal(phoneticsItems.length,6);
  for(const item of [...grammarItems,...phoneticsItems]){assert.ok(item.question);assert.equal(item.options.length,4);assert.equal(new Set(item.options).size,4);assert.ok(item.options.includes(item.answer));}
});
test('section scores retain overall counts across separately tracked sessions',()=>{
  let p=recordAnswer(emptyProgress(),'v-0',true,1000);
  p=recordAnswer(p,'sound-length',false,1100);
  p=recordAnswer(p,'grammar-0',true,1200);
  assert.deepEqual(p.session.sections.script,{correct:1,total:1});
  assert.deepEqual(p.session.sections.phonetics,{correct:0,total:1});
  assert.equal(sectionScores(p,byId).grammar.correct,1);
  const fresh=startSession(p,1300);
  assert.deepEqual(fresh.session.sections,{});
  assert.equal(sectionScores(fresh,byId).script.total,1);
  assert.equal(ensureSession(p,1200+SESSION_GAP).session.startedAt,1000);
  assert.equal(ensureSession(p,1201+SESSION_GAP).session.startedAt,1201+SESSION_GAP);
});
test('legacy progress migrates without losing answers or scores; resume data survives backups',()=>{
  const ids=new Set(allItems.map(i=>i.id)),lessons=new Set(['first-vowels']);
  const old={version:1,items:{'v-0':{attempts:2,correct:1,stage:0,due:100}},lessons:{'first-vowels':.5},activity:{'2026-11-03':2}};
  const migrated=validateProgress(old,ids,lessons);
  assert.equal(migrated.version,2);assert.deepEqual(migrated.items,old.items);assert.deepEqual(migrated.lessons,old.lessons);
  migrated.ui={route:'lesson/first-vowels',studyIndex:3,activeScript:'Vowels',wordGroup:'All words',search:'',quiz:null};
  assert.equal(validateProgress(migrated,ids,lessons).ui.studyIndex,3);
});
test('audio identity separates provider, model, voice, section, and level while permitting replacement',()=>{
  const t={id:'food-0',section:'words',kind:'word'},p={provider:'local',model:'v1',voice:'speaker'};
  const key=clipKey(t,p);
  assert.equal(key,clipKey(t,{...p,name:'a new display name'}));
  for(const change of [{provider:'other'},{model:'v2'},{voice:'other'}])assert.notEqual(key,clipKey(t,{...p,...change}));
  assert.notEqual(key,clipKey({...t,section:'phonetics'},p));assert.notEqual(key,clipKey({...t,kind:'lesson'},p));
});
test('speech endpoints allow HTTPS and loopback but reject embedded keys and cleartext remote services',()=>{
  assert.equal(validateEndpoint('https://speech.example/api/speech/'),'https://speech.example/api/speech');
  assert.ok(validateEndpoint('http://127.0.0.1:4173/api/speech'));
  for(const value of ['http://speech.example/tts','https://user:secret@speech.example/tts','https://speech.example/tts?key=secret','javascript:alert(1)'])assert.throws(()=>validateEndpoint(value));
});
test('structured audio exports preserve metadata, model-wise paths, bytes, and checksums',async()=>{
  const bytes=new Uint8Array([82,73,70,70,0,1,2]);
  const zip=await exportAudio([{key:'ignored',language:'ml',section:'words',scope:'word',itemId:'food-0',text:'വെള്ളം',provider:'local',model:'v1',voice:'speaker',profileName:'Test speaker',gender:'unspecified',origin:'file',mime:'audio/wav',blob:new Blob([bytes],{type:'audio/wav'}),revision:1,createdAt:1,updatedAt:1}]);
  const files=await unpackZip(zip),manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  assert.equal(manifest.format,'bhaasa-audio-v1');
  assert.match(manifest.clips[0].path,/malayalam\/words\/word\/food-0\/local\/v1\/speaker/);
  assert.deepEqual(files.get(manifest.clips[0].path),bytes);
  const bad=new Uint8Array(await zip.arrayBuffer());bad[80]^=1;
  await assert.rejects(()=>unpackZip(new Blob([bad])),/checksum/);
  await assert.rejects(()=>unpackZip(packZip([{name:'../outside',data:bytes}])),/path/);
});

async function speechRequest(body,{origin='http://localhost',env={},fetcher}={}){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';req.headers={'content-type':'application/json',origin};
  let status,headers,text;
  const res={writeHead(s,h){status=s;headers=h;return this;},end(value){text=value;return this;}};
  await handleSpeech(req,res,new URL('http://localhost/api/speech'),{env,fetcher});
  return {status,headers,text};
}
test('optional speech companion forwards only configured models, returns audio, and rejects cross-origin use',async()=>{
  const env={BHAASA_TTS_PROVIDER:'custom',BHAASA_TTS_URL:'http://localhost:9999/tts',BHAASA_TTS_MODELS:'fixture-model'};
  let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).input,'വെള്ളം');return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/wav'}});};
  const data={input:'വെള്ളം',language:'ml-IN',provider:'custom',model:'fixture-model',voice:'speaker'};
  const result=await speechRequest(data,{env,fetcher});assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'audio/wav');assert.equal(calls,1);
  assert.equal((await speechRequest({...data,model:'unconfigured'},{env,fetcher})).status,400);assert.equal(calls,1);
  assert.equal((await speechRequest(data,{env,fetcher,origin:'https://untrusted.example'})).status,403);assert.equal(calls,1);
  assert.equal((await speechRequest(data,{env:{},fetcher})).status,503);assert.equal(calls,1);
});
