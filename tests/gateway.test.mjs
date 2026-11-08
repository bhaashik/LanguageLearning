import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultGateway,isPagesApp,isMobileBrowser} from '../platform.js';
import {validateEndpoint} from '../audio-store.js';
import {gatewayJSON,restoreGateway,requestTimeout} from '../gateway.js';
import {loadOCRSettings} from '../ocr-settings.js';
import {loadASRSettings} from '../asr.js';
import {AudioLibrary} from '../audio.js';
import {audioPage} from '../audio-ui.js';
const location=globalThis.location,storage=globalThis.localStorage,navigatorState=Object.getOwnPropertyDescriptor(globalThis,'navigator');
function hosted(mobile=true){globalThis.location=new URL('https://bhaashik.github.io/LanguageLearning/');Object.defineProperty(globalThis,'navigator',{configurable:true,value:mobile?{userAgent:'iPad',platform:'MacIntel',maxTouchPoints:5}:{userAgent:'Desktop',platform:'Linux',maxTouchPoints:0}});}
function cleanup(){if(location===undefined)delete globalThis.location;else globalThis.location=location;if(storage===undefined)delete globalThis.localStorage;else globalThis.localStorage=storage;if(navigatorState)Object.defineProperty(globalThis,'navigator',navigatorState);else delete globalThis.navigator;}
test('Pages uses no pretend API; desktop and local web keep their working gateway defaults',()=>{
  try{
    hosted();assert.equal(isPagesApp(),true);for(const name of ['ocr','speech','transcribe'])assert.equal(defaultGateway(name),'');
    for(const endpoint of ['', 'http://127.0.0.1:4173/api/ocr','https://localhost/api/ocr','https://bhaashik.github.io/LanguageLearning/api/ocr','https://other.github.io/app/api/speech'])assert.throws(()=>validateEndpoint(endpoint));
    assert.equal(validateEndpoint('https://private.example/api/ocr'),'https://private.example/api/ocr');
    assert.equal(isMobileBrowser({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),true,'iPad Request Desktop Website mode');
    hosted(false);assert.equal(validateEndpoint('http://127.0.0.1:4173/api/ocr'),'http://127.0.0.1:4173/api/ocr','a desktop can explicitly connect to its own local server');
    globalThis.location=new URL('http://127.0.0.1:4174/');assert.equal(defaultGateway('ocr'),'http://127.0.0.1:4174/api/ocr');assert.equal(validateEndpoint('http://127.0.0.1:4174/api/ocr'),'http://127.0.0.1:4174/api/ocr');
  }finally{cleanup();}
});
test('old Pages API URLs migrate without losing selected providers, models, voices or profile identity',()=>{
  try{
    hosted();const values={
      'bhaasa.ocr.preferences.v1':{provider:'gemini',profiles:{gemini:{endpoint:'https://bhaashik.github.io/LanguageLearning/api/ocr',model:'vision-saved'}}},
      'bhaasa.asr.ml.v1':{provider:'openai',profiles:{openai:{endpoint:'https://bhaashik.github.io/LanguageLearning/api/transcribe',model:'asr-saved'}}},
      'bhaasa.voices.v1':{activeId:'saved',profiles:[{id:'saved',kind:'service',provider:'openai',model:'speech-saved',voice:'marin',name:'My voice',endpoint:'https://bhaashik.github.io/LanguageLearning/api/speech'}]}
    };globalThis.localStorage={getItem:key=>values[key]?JSON.stringify(values[key]):null};
    const ocr=loadOCRSettings();assert.equal(ocr.provider,'gemini');assert.deepEqual(ocr.profiles.gemini,{model:'vision-saved',endpoint:''});
    assert.deepEqual(loadASRSettings('ml').profiles.openai,{model:'asr-saved',endpoint:''});
    const audio=new AudioLibrary(()=>{});assert.equal(audio.active.id,'saved');assert.equal(audio.active.model,'speech-saved');assert.equal(audio.active.voice,'marin');assert.equal(audio.active.endpoint,'');
    assert.equal(audio.openaiPreset.model,'speech-saved');assert.equal(audio.openaiPreset.endpoint,'');
    audio.openaiPreset.voice='<img src=x onerror=alert(1)>';
    const markup=audioPage(audio,{example:{id:'example',kind:'letter',section:'script',ml:'ക',roman:'ka'}},'example');
    assert.ok(markup.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!markup.includes('<img src=x'));
    assert.equal(restoreGateway('https://private.example/api/speech','speech'),'https://private.example/api/speech');
  }finally{cleanup();}
});
test('discovery reports missing gateways and HTML responses clearly, with no generation request',async()=>{
  let calls=0;
  await assert.rejects(gatewayJSON('',{fetcher:()=>{calls++;}}),/gateway address/);assert.equal(calls,0);
  const result=await gatewayJSON('https://fixture.example/api/speech',{models:true,fetcher:async(url,options)=>{calls++;assert.equal(url,'https://fixture.example/api/speech/models');assert.equal(options.body,undefined);assert.equal(options.method,undefined);return Response.json({provider:'gemini',models:[{id:'speech-fixture'}]});}});
  assert.equal(result.models[0].id,'speech-fixture');
  await assert.rejects(gatewayJSON('https://fixture.example/api/ocr',{fetcher:async()=>new Response('<html>not an API</html>')}),/web page/);
  await assert.rejects(gatewayJSON('https://fixture.example/api/ocr',{fetcher:async()=>new Response('missing',{status:404})}),/HTTP 404/);
  await assert.rejects(gatewayJSON('https://fixture.example/api/ocr',{fetcher:async()=>{throw new TypeError('network');}}),/CORS/);
});
test('request cancellation and timeout work without AbortSignal.any or AbortSignal.timeout',async()=>{
  const any=AbortSignal.any,timeout=AbortSignal.timeout;
  try{
    AbortSignal.any=undefined;AbortSignal.timeout=undefined;
    const controller=new AbortController(),request=requestTimeout(controller.signal,1000);controller.abort();assert.equal(request.signal.aborted,true);assert.equal(request.expired(),false);request.cleanup();
    const expired=requestTimeout(undefined,10);await new Promise(resolve=>expired.signal.addEventListener('abort',resolve,{once:true}));assert.equal(expired.expired(),true);expired.cleanup();
    const result=await gatewayJSON('https://fixture.example/api/ocr',{fetcher:async()=>Response.json({providers:[]})});assert.deepEqual(result.providers,[]);
  }finally{AbortSignal.any=any;AbortSignal.timeout=timeout;}
});
