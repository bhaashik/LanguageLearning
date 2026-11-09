import test from 'node:test';
import assert from 'node:assert/strict';
import {FirebaseClient,FIREBASE_PROJECT,loadFirebaseSettings,saveFirebaseSettings,clearFirebaseSettings,pcmToWav} from '../firebase-client.js';
import {loadOCRSettings} from '../ocr-settings.js';
import {loadASRSettings,transcribeAudio} from '../asr.js';
import {readFile} from 'node:fs/promises';
const config={apiKey:'AIzaPublicFirebaseWebKeyFixture',siteKey:'6PublicEnterpriseWebsiteKeyFixture'};
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
function fixture(){
  let response={candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"അ","legible":true}'}]}}]},error,tokenError;
  const calls=[];
  const sdk={initializeApp:(options,name)=>{calls.push(['app',options,name]);return {name};},ReCaptchaEnterpriseProvider:class{constructor(key){this.siteKey=key;}},initializeAppCheck:(app,options)=>{calls.push(['appCheck',options]);return {};},GoogleAIBackend:class{},getAI:(app,options)=>{calls.push(['ai',options]);return {};},getToken:async()=>{calls.push(['token']);if(tokenError)throw tokenError;return {token:'fixture-token'};},getGenerativeModel:(ai,options)=>{calls.push(['model',options]);return {generateContent:async(body,request)=>{calls.push(['request',body,request]);if(error)throw error;return {response};}};}};
  return {client:new FirebaseClient(async()=>sdk),calls,setResponse:r=>response=r,setError:e=>error=e,setTokenError:e=>tokenError=e};
}
test.beforeEach(()=>{storage.clear();saveFirebaseSettings(config);});
test('only the two public web configuration fields are saved locally; providers keep independent defaults',()=>{
  saveFirebaseSettings({...config,geminiApiKey:'must-not-be-saved'});assert.deepEqual(loadFirebaseSettings(),config);
  assert.ok(![...storage.values()].join('').includes('must-not-be-saved'));
  assert.throws(()=>saveFirebaseSettings({...config,siteKey:'wrong'}),/public reCAPTCHA/);
  assert.equal(loadOCRSettings().provider,'openai');assert.equal(loadOCRSettings().profiles.firebase.endpoint,'');
  assert.equal(loadASRSettings('fr').profiles.firebase.model,'gemini-2.5-flash');
  clearFirebaseSettings();assert.deepEqual(loadFirebaseSettings(),{apiKey:'',siteKey:''});
});
test('missing configuration fails before loading the SDK; App Check initializes before AI and is reused',async()=>{
  clearFirebaseSettings();let loads=0;await assert.rejects(new FirebaseClient(async()=>{loads++;}).check());assert.equal(loads,0);
  saveFirebaseSettings(config);const f=fixture();await f.client.check();await f.client.check();assert.deepEqual(f.calls.map(c=>c[0]),['app','appCheck','ai','token','token']);
  assert.deepEqual(f.calls[0][1],{...FIREBASE_PROJECT,apiKey:config.apiKey});assert.equal(f.calls[1][1].provider.siteKey,config.siteKey);assert.equal(f.calls[1][1].isTokenAutoRefreshEnabled,true);
});
test('OCR sends ink without any expected answer; complete valid Malayalam results retain Firebase identity',async()=>{
  const f=fixture(),image='data:image/png;base64,aW5r';assert.deepEqual(await f.client.ocr(image),{text:'അ',legible:true,provider:'firebase',model:'gemini-2.5-flash'});
  const body=f.calls.find(c=>c[0]==='request')[1];assert.deepEqual(body.contents[0].parts[1],{inlineData:{mimeType:'image/png',data:'aW5r'}});
  assert.deepEqual(Object.keys(body),['contents']);assert.ok(!JSON.stringify(body).includes('അ'));
  assert.equal(f.calls.find(c=>c[0]==='model')[1].generationConfig.thinkingConfig.thinkingBudget,0);
  for(const value of [{text:'answer',legible:true},{text:null,legible:true},{text:'അ'}]){f.setResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]});await assert.rejects(f.client.ocr(image),/invalid Malayalam/);}
  f.setResponse({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"text":"അ","legible":true}'}]}}]});await assert.rejects(f.client.ocr(image),/incomplete/);
});
test('ASR sends only audio, with language in instructions and no expected phrase; silence remains unscored',async()=>{
  const f=fixture();f.setResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"bonjour"}'}]}}]});
  const data=await f.client.transcribe(new Blob(['voice'],{type:'audio/webm;codecs=opus'}),{language:'fr'});assert.equal(data.text,'bonjour');
  assert.deepEqual(f.calls.find(c=>c[0]==='request')[1].contents[0].parts,[{inlineData:{mimeType:'audio/webm',data:btoa('voice')}}]);
  assert.match(f.calls.find(c=>c[0]==='model')[1].systemInstruction,/French/);
  f.setResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":""}'}]}}]});assert.equal((await f.client.transcribe(new Blob(['a'],{type:'audio/wav'}))).text,'');
  await assert.rejects(transcribeAudio(new Blob([],{type:'audio/webm'}),{provider:'firebase',model:'',endpoint:''},'ml'),/nonempty/);
});
test('Firebase speech requests audio and chosen voice, produces playable WAV and rejects incomplete or malformed audio',async()=>{
  const f=fixture();const parts=[{inlineData:{mimeType:'audio/L16;codec=pcm;rate=24000',data:'AQACAAMA'}}];f.setResponse({candidates:[{finishReason:'STOP',content:{parts}}]});
  const blob=await f.client.speech('bonjour',{voice:'Aoede',language:'fr-FR'}),bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(blob.type,'audio/wav');assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'RIFF');assert.equal(new DataView(bytes.buffer).getUint32(24,true),24000);assert.deepEqual([...bytes.subarray(44)],[1,0,2,0,3,0]);
  const model=f.calls.find(c=>c[0]==='model')[1];assert.deepEqual(model.generationConfig.responseModalities,['AUDIO']);assert.equal(model.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Aoede');
  assert.throws(()=>pcmToWav([]),/empty/);assert.throws(()=>pcmToWav([{inlineData:{mimeType:'audio/mpeg',data:'AQACAA=='}}]),/unsupported/);
  f.setResponse({promptFeedback:{blockReason:'SAFETY'}});await assert.rejects(f.client.speech('bonjour'),/incomplete/);
});
test('App Check failure prevents generation, cancellation prevents late results, and quota errors are sanitized without retries',async()=>{
  const f=fixture();f.setTokenError(Object.assign(Error('contains-private-details'),{code:'appCheck/fetch-status-error'}));await assert.rejects(f.client.speech('hello'),/App Check failed/);assert.ok(!f.calls.some(c=>c[0]==='request'));
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(f.client.check(cancelled.signal),{name:'AbortError'});
  const q=fixture();q.setError(Error('429 private upstream details'));await assert.rejects(q.client.speech('hello'),/quota/);assert.equal(q.calls.filter(c=>c[0]==='request').length,1);
});
test('static build includes the local SDK and license, and lazy client has no Gemini API endpoint or key',async()=>{
  const client=await readFile(new URL('../firebase-client.js',import.meta.url),'utf8'),bundle=await readFile(new URL('../vendor/firebase-ai.js',import.meta.url),'utf8');
  assert.match(client,/import\('\.\/vendor\/firebase-ai.js'\)/);assert.ok(!client.includes('generativelanguage.googleapis.com'));
  assert.match(bundle,/firebasevertexai.googleapis.com/);assert.match(bundle,/X-Firebase-AppCheck/);
  assert.ok((await readFile(new URL('../vendor/firebase-ai.js.LEGAL.txt',import.meta.url),'utf8')).includes('Apache'));
});
