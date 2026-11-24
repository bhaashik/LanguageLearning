import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {numbers,numberTargets,numberPlaylist,numberSettings,englishNumber} from '../numbers.js';
import {runNumberSequence,numberWav,numberProfile,NumbersAudio} from '../numbers-audio.js';
import {clipKey,exportAudio} from '../audio-store.js';
import {unpackZip} from '../zip.js';
import {handleSpeech} from '../scripts/speech.mjs';
import {readingInstructions} from '../speech-presets.js';

test('the complete 1–100 course has script, English, transcriptions and glosses',()=>{
  assert.equal(numbers.length,100);assert.equal(new Set(numbers.map(n=>n.ml)).size,100);
  assert.deepEqual(numbers.map(n=>n.value),Array.from({length:100},(_,i)=>i+1));
  for(const n of numbers){assert.match(n.ml,/^[\u0D00-\u0D7F]+$/);assert.match(n.ipa,/^\/.+\/$/);assert.ok(n.iast);assert.match(n.roman,/^[a-z]+$/);assert.ok(n.gloss.length);assert.equal(n.gloss.map(g=>g.iast).join(''),n.iast);assert.equal(n.gloss.map(g=>g.roman).join(''),n.roman);}
  const expected={1:'ഒന്ന്',9:'ഒമ്പത്',12:'പന്ത്രണ്ട്',19:'പത്തൊമ്പത്',21:'ഇരുപത്തിയൊന്ന്',25:'ഇരുപത്തിയഞ്ച്',29:'ഇരുപത്തിയൊമ്പത്',31:'മുപ്പത്തിയൊന്ന്',45:'നാല്പത്തിയഞ്ച്',58:'അമ്പത്തിയെട്ട്',66:'അറുപത്തിയാറ്',71:'എഴുപത്തിയൊന്ന്',88:'എൺപത്തിയെട്ട്',90:'തൊണ്ണൂറ്',91:'തൊണ്ണൂറ്റിയൊന്ന്',99:'തൊണ്ണൂറ്റിയൊമ്പത്',100:'നൂറ്'};
  for(const [n,ml] of Object.entries(expected))assert.equal(numbers[n-1].ml,ml,n);
  assert.equal(numbers[99].malayalamDigits,'൧൦൦');assert.equal(englishNumber(40),'forty');assert.equal(englishNumber(99),'ninety-nine');assert.equal(englishNumber(100),'one hundred');assert.throws(()=>englishNumber(0));
  assert.equal(Object.keys(numberTargets).length,200);assert.equal(numberTargets['number-en-21'].ml,'twenty-one');assert.equal(numberTargets['number-ml-21'].ml,expected[21]);
});
test('playlist waits in the requested language/voice order with longer gaps between numbers',async()=>{
  const plan=numberPlaylist(1,2),events=[];
  await runNumberSequence(plan,{play:async step=>events.push([step.value,step.target.language,step.gender]),wait:async seconds=>events.push(seconds)});
  assert.deepEqual(events,[[1,'ml','male'],.7,[1,'ml','female'],1,[1,'en','male'],.7,[1,'en','female'],2,[2,'ml','male'],.7,[2,'ml','female'],1,[2,'en','male'],.7,[2,'en','female']]);
  assert.throws(()=>numberPlaylist(100,1));assert.throws(()=>numberPlaylist(0,1));assert.throws(()=>numberPlaylist(1,1,{numberPause:.5,voicePause:.7}));assert.equal(numberSettings({numberPause:NaN}).numberPause,2);
});
test('stopping during a clip or a pause prevents later voices and numbers',async()=>{
  for(const during of ['play','wait']){
    const controller=new AbortController(),spoken=[];
    await assert.rejects(runNumberSequence(numberPlaylist(1,100),{signal:controller.signal,play:async step=>{spoken.push(step);if(during==='play')controller.abort();},wait:async()=>controller.abort()}),{name:'AbortError'});
    assert.equal(spoken.length,1);
  }
});
test('audio caching separates languages, gender voices and changed text; completed work resumes',async()=>{
  const base={kind:'service',provider:'gemini',model:'tts',endpoint:'https://speech.example/api/speech'},s=numberSettings(),plan=numberPlaylist(1,1),library=new NumbersAudio();
  const male=numberProfile(base,plan[0],s),female=numberProfile(base,plan[1],s);
  assert.notEqual(clipKey(plan[0].target,male),clipKey(plan[1].target,female));assert.notEqual(clipKey(plan[0].target,male),clipKey(plan[2].target,male));
  const blob=new Blob(['fixture'],{type:'audio/wav'});library.clips=[{key:clipKey(plan[0].target,male),text:plan[0].target.ml,blob}];
  assert.equal(await library.generate(plan[0],base,s),blob);assert.equal(library.cached({...plan[0],target:{...plan[0].target,ml:'changed'}},base,s),undefined);
  assert.throws(()=>numberProfile({kind:'device'},plan[0],s),/Connect a Gemini/);assert.throws(()=>numberProfile(base,plan[0],{...s,female:s.male}),/different/);
});
test('downloaded WAV contains real silence and correctly bounded PCM between clips',async()=>{
  const blob=numberWav([{samples:new Float32Array([1,-1]),pauseAfter:.5},{samples:new Float32Array([.5]),pauseAfter:0}],10),bytes=await blob.arrayBuffer(),v=new DataView(bytes);
  assert.equal(blob.type,'audio/wav');assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(v.getUint32(24,true),10);assert.equal(v.getUint32(40,true),16);
  assert.deepEqual(Array.from({length:8},(_,i)=>v.getInt16(44+i*2,true)),[32767,-32768,0,0,0,0,0,16384]);
});
test('English number exports use their own directory and retain language and voice metadata',async()=>{
  const zip=await exportAudio([{language:'en',section:'numbers',scope:'number',itemId:'number-en-1',text:'one',provider:'gemini',model:'tts',voice:'Charon',gender:'male',profileName:'Numbers male',mime:'audio/wav',blob:new Blob(['fixture'],{type:'audio/wav'})}]),files=await unpackZip(zip),manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  assert.match(manifest.clips[0].path,/^english\/numbers\//);assert.equal(manifest.clips[0].gender,'male');assert.equal(manifest.clips[0].language,'en');assert.equal(manifest.clips[0].text,'one');
});
test('Gemini gateway accepts English and sends an English reading prompt, not Malayalam',async()=>{
  const data={input:'ninety-nine',language:'en-US',provider:'gemini',model:'gemini-2.5-flash-preview-tts',voice:'Charon'},req=Readable.from([Buffer.from(JSON.stringify(data))]);req.method='POST';req.headers={'content-type':'application/json'};
  let status,body,upstream;const res={writeHead(code){status=code;return this;},end(value){body=value;}};
  await handleSpeech(req,res,new URL('http://localhost/api/speech'),{env:{BHAASA_TTS_PROVIDER:'gemini',BHAASA_TTS_API_KEY:'fixture-only'},fetcher:async(_url,options)=>{upstream=JSON.parse(options.body);return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:'AAAAAA=='}}]}}]}),{headers:{'Content-Type':'application/json'}});}});
  assert.equal(status,200);assert.equal(body.subarray(0,4).toString(),'RIFF');assert.match(upstream.contents[0].parts[0].text,/English/);assert.ok(!upstream.contents[0].parts[0].text.includes('Malayalam'));assert.equal(upstream.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Charon');
  assert.match(readingInstructions('en-US'),/English/);assert.match(readingInstructions('ml-IN'),/Malayalam/);assert.match(readingInstructions('fr-FR'),/French/);
});
