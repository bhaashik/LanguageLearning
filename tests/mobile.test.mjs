import test from 'node:test';
import assert from 'node:assert/strict';
import {createBridge} from '../mobile/src/bridge.js';
import {defaultGateway,helpLinkAttributes,exportFile,randomId} from '../platform.js';
import {validateEndpoint} from '../audio-store.js';
import {originAllowed} from '../scripts/origins.mjs';

test('native gateway defaults are empty and phone-local or insecure endpoints are rejected',async()=>{
  assert.equal(defaultGateway('ocr'),'http://localhost:4173/api/ocr');
  assert.match(helpLinkAttributes(),/target/);
  let exported;
  globalThis.BhaasaNative={isNative:true,exportFile:async(blob,name)=>{exported={blob,name};}};
  try{
    assert.equal(defaultGateway('ocr'),'');assert.equal(defaultGateway('speech'),'');assert.equal(helpLinkAttributes(),'');
    for(const value of ['','/api/ocr','http://192.168.1.5:4173/api/ocr','https://localhost/api/ocr','http://127.0.0.1:4173/api/ocr','https://[::1]/api/ocr'])assert.throws(()=>validateEndpoint(value));
    assert.equal(validateEndpoint('https://private.example/api/ocr'),'https://private.example/api/ocr');
    assert.throws(()=>validateEndpoint('https://private.example/api/ocr?key=bad'));
    const blob=new Blob(['backup']);await exportFile(blob,'backup.json');assert.deepEqual(exported,{blob,name:'backup.json'});
  }finally{delete globalThis.BhaasaNative;}
  assert.equal(validateEndpoint('http://127.0.0.1:4173/api/ocr'),'http://127.0.0.1:4173/api/ocr');
});

test('native voices preserve the full platform index and refuse a non-Malayalam voice',async()=>{
  let spoken;
  const bridge=createBridge({Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'android'},TextToSpeech:{
    getSupportedVoices:async()=>({voices:[{name:'English',voiceURI:'en',lang:'en-US'},{name:'Malayalam',voiceURI:'ml',lang:'ml-IN'}]}),
    speak:async options=>{spoken=options;},stop:async()=>{}
  }});
  await bridge.getVoices();await bridge.speak({text:'ക',voice:'ml',lang:'ml-IN'});
  assert.equal(spoken.voice,1);assert.equal(spoken.lang,'ml-IN');assert.equal(spoken.text,'ക');
  await assert.rejects(bridge.speak({text:'ക',voice:'en',lang:'ml-IN'}),/Malayalam/);
  await assert.rejects(bridge.speak({text:'ക',voice:'missing',lang:'ml-IN'}),/Malayalam/);
});

test('native backup sharing writes bounded binary-safe chunks to private cache',async()=>{
  const writes=[];let shared;
  const fs={writeFile:async o=>writes.push(o),appendFile:async o=>writes.push(o),getUri:async o=>({uri:'file:///cache/'+o.path})};
  const bridge=createBridge({Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'ios'},Directory:{Cache:'CACHE'},Filesystem:fs,Share:{share:async o=>{shared=o;}}});
  const bytes=Uint8Array.from({length:1100003},(_,i)=>i%251);
  await bridge.exportFile(new Blob([bytes]),'../../backup.zip');
  assert.equal(writes.length,3);assert.ok(writes.every(o=>o.directory==='CACHE'&&o.path===writes[0].path&&Buffer.from(o.data,'base64').length<=512*1024));
  assert.equal(writes[0].recursive,true);assert.equal(writes[0].path.split('/').length,2);
  assert.deepEqual(Buffer.concat(writes.map(o=>Buffer.from(o.data,'base64'))),Buffer.from(bytes));
  assert.deepEqual(shared.files,['file:///cache/'+writes[0].path]);
  fs.writeFile=async()=>{throw Error('storage full');};
  await assert.rejects(bridge.exportFile(new Blob(['x']),'x.json'),/storage full/);
});

test('mobile gateway origins are an exact list, with no wildcard or opaque-origin bypass',()=>{
  const origins='https://localhost, capacitor://localhost, http://127.0.0.1:4173';
  for(const origin of ['https://localhost','capacitor://localhost','http://127.0.0.1:4173'])assert.equal(originAllowed(origin,origins,'http://server'),true);
  for(const origin of ['null','https://localhost.evil.example','https://evil.example','http://localhost'])assert.equal(originAllowed(origin,origins,'http://server'),false);
  assert.equal(originAllowed('https://evil.example','*','http://server'),false);
  assert.equal(originAllowed('http://server','','http://server'),true);
  assert.equal(originAllowed('','','http://server'),true,'non-browser clients retain existing behavior');
});

test('UUID fallback uses secure random bytes and correct version/variant bits',()=>{
  const source={getRandomValues:bytes=>{bytes.fill(255);return bytes;}};
  assert.equal(randomId(source),'ffffffff-ffff-4fff-bfff-ffffffffffff');
  assert.equal(randomId({randomUUID:()=>'native-uuid'}),'native-uuid');
});
