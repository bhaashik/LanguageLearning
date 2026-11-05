import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {allItems,byId,conjuncts,syllableBases,syllablePatterns,syllableForms,syllables,writingItems} from '../content.js';
import {emptyProgress,updateWriting,recordTrace,recordHandwritingRecognition,validateProgress} from '../learning.js';
import {handleSpeech,speechConfig} from '../scripts/speech.mjs';

test('the builder covers every base/pattern once while retaining original card identities',()=>{
  assert.equal(conjuncts.length,32);assert.equal(syllableBases.length,68);assert.equal(syllablePatterns.length,14);
  assert.equal(syllableForms.length,952);assert.equal(syllables.length,871);assert.equal(writingItems.length,975);
  assert.equal(new Set(syllableForms.map(f=>f.baseId+'|'+f.patternId)).size,952);
  for(const f of syllableForms){const item=byId[f.itemId];assert.ok(item);assert.equal(item.section,'script');assert.ok(item.glossType.includes('sound unit'));assert.match(item.id,/^[a-z0-9-]+$/);}
  const form=(base,pattern)=>byId[syllableForms.find(f=>f.baseId===base&&f.patternId===pattern).itemId];
  assert.equal(form('vel-0','a').id,'vel-0');assert.equal(form('vel-0','aa').id,'sign-1');assert.equal(form('cj-0','a').id,'cj-0');
  assert.equal(form('cj-0','oo').ml,'ക്കോ');assert.equal(form('cj-0','oo').ipa,'kːoː');assert.equal(form('cj-0','oo').devanagari,'क्को');
  assert.equal(form('lab-0','ai').ml,'പൈ');assert.equal(form('lab-4','no-vowel').ml,'മ്');
  assert.equal(form('cj-12','ii').ml,'മ്മീ');
});

test('added conjuncts have real examples and constructed forms do not invent vocabulary',()=>{
  for(const item of conjuncts){assert.equal(item.example.type,'word');assert.ok(byId[item.example.itemId].ml.includes(item.ml));}
  for(const item of syllables){
    assert.equal(item.kind,'syllable');assert.match(item.note,/Constructed writing practice/);assert.ok(item.ipa&&item.devanagari&&item.gloss.length);
    if(item.example.type==='word')assert.ok(byId[item.example.itemId].ml.normalize('NFC').includes(item.ml));
    else assert.match(item.example.note,/not every constructed combination is common/);
  }
});

test('syllable drafts, OCR readings and builder selections survive a backup without merging with bare consonants',()=>{
  const id='syll-cj-0-oo';let p=updateWriting(emptyProgress(),id,{draft:[[{x:100,y:100},{x:220,y:200}]],draftId:'syllable-ink'});
  p=recordTrace(p,id,{assessable:true,fit:.9,smoothness:.95,strokeCount:2,passed:true,drawingId:'syllable-ink'});
  p=recordHandwritingRecognition(p,id,{text:'ക്കോ',matched:true,drawingId:'syllable-ink',provider:'gemini',model:'fixture',recognitionKey:'conjunct-reading'});
  p.ui={route:'script',activeScript:'Syllables',syllableBase:'cj-0',syllablePattern:'oo',studyIndex:0,wordGroup:'All words',search:'',quiz:null};
  const restored=validateProgress(JSON.parse(JSON.stringify(p)),new Set(allItems.map(i=>i.id)),new Set());
  assert.deepEqual(restored,p);assert.equal(restored.writing['cj-0'],undefined);assert.deepEqual(restored.items,{});
});

async function speak(body,fetcher){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method='POST';req.headers={origin:'http://localhost','content-type':'application/json'};
  const result={},res={writeHead(status,headers){Object.assign(result,{status,headers});return this;},end(body){result.body=body;return this;}};
  await handleSpeech(req,res,new URL('http://localhost/api/speech'),{env:{BHAASA_TTS_PROVIDER:'gemini',BHAASA_TTS_API_KEY:'gemini-speech-fixture'},fetcher});return result;
}
const speech={input:'നന്ദി',language:'ml-IN',provider:'gemini',model:'gemini-2.5-flash-preview-tts',voice:'Kore'};
const audioResponse=(pcm,extra={})=>({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'audio/L16;codec=pcm;rate=24000',data:pcm.toString('base64')}}]},...extra}]});
test('Gemini speech uses its own audio protocol and returns complete mono WAV without a transport dependency',async()=>{
  assert.equal(speechConfig({BHAASA_TTS_PROVIDER:'gemini',BHAASA_TTS_API_KEY:'fixture'}).voice,'Kore');
  const pcm=Buffer.alloc(96);pcm.writeInt16LE(120,0);let calls=0;
  const result=await speak(speech,async(url,options)=>{
    calls++;assert.equal(url.href,'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent');
    assert.equal(options.headers['x-goog-api-key'],'gemini-speech-fixture');assert.equal(options.headers.Authorization,undefined);
    const body=JSON.parse(options.body);assert.ok(body.contents[0].parts[0].text.includes('നന്ദി'));assert.deepEqual(body.generationConfig.responseModalities,['AUDIO']);
    assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,'Kore');
    return Response.json(audioResponse(pcm));
  });
  assert.equal(calls,1);assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'audio/wav');
  assert.equal(result.body.subarray(0,4).toString(),'RIFF');assert.equal(result.body.readUInt32LE(24),24000);assert.equal(result.body.readUInt16LE(22),1);assert.deepEqual(result.body.subarray(44),pcm);
});

test('incomplete, filtered or malformed Gemini audio cannot be saved as a successful clip',async()=>{
  const pcm=Buffer.alloc(48);
  for(const body of [audioResponse(pcm,{finishReason:'MAX_TOKENS'}),{promptFeedback:{blockReason:'SAFETY'}},audioResponse(Buffer.from([1])),{candidates:[{finishReason:'STOP',content:{parts:[{text:'private error details'}]}}]}]){
    const result=await speak(speech,async()=>Response.json(body));assert.equal(result.status,502);assert.ok(!String(result.body).includes('private'));
  }
  const never=()=>assert.fail('No generation for an unconfigured provider/model');
  assert.equal((await speak({...speech,model:'gemini-2.5-flash'},never)).status,400);
  assert.equal((await speak({...speech,provider:'openai'},never)).status,400);
});
