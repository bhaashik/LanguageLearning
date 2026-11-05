import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {asrConfigurations,decodeAudio,requestTranscription,handleTranscription} from '../scripts/transcribe.mjs';
const wav=Buffer.alloc(48);wav.write('RIFF');wav.writeUInt32LE(40,4);wav.write('WAVE',8);
const audio=`data:audio/wav;base64,${wav.toString('base64')}`;
const env={BHAASA_ASR_OPENAI_API_KEY:'openai-fixture',BHAASA_ASR_GEMINI_API_KEY:'gemini-fixture',BHAASA_ASR_GEMINI_MODEL:'gemini-audio-fixture',BHAASA_ASR_COMPATIBLE_URL:'http://127.0.0.1:8080/transcribe',BHAASA_ASR_COMPATIBLE_MODEL:'whisper-fixture',BHAASA_ASR_CUSTOM_URL:'http://127.0.0.1:8081/transcribe'};
async function request(data,{method='POST',headers={},environment=env,fetcher=async()=>Response.json({text:'Bonjour'})}={}){
  const req=Readable.from(method==='POST'?[JSON.stringify(data)]:[]);req.method=method;req.headers={'content-type':'application/json',...headers};
  const res={status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;return this;},end(value=''){this.body=String(value);}};
  await handleTranscription(req,res,new URL('http://127.0.0.1:4173/api/transcribe'),{env:environment,fetcher});return res;
}
test('ASR validates audio and provider credentials before a paid request',()=>{
  assert.equal(decodeAudio(audio).mime,'audio/wav');assert.throws(()=>decodeAudio('data:image/png;base64,AAAA'),/invalid_audio/);assert.throws(()=>decodeAudio('data:audio/wav;base64,'+Buffer.from('not really wave audio').toString('base64')),/invalid_audio/);
  assert.equal(asrConfigurations({BHAASA_TTS_PROVIDER:'gemini',BHAASA_TTS_API_KEY:'google-only'}).openai.configured,false);
  assert.equal(asrConfigurations({BHAASA_TTS_API_KEY:'openai-fixture'}).openai.configured,true);
  assert.equal(asrConfigurations({BHAASA_ASR_COMPATIBLE_URL:'http://remote.example/transcribe',BHAASA_ASR_COMPATIBLE_MODEL:'m'}).compatible.configured,false);
});
test('ASR status never exposes keys and rejects answer hints, foreign origins and unlisted models',async()=>{
  const status=await request(null,{method:'GET'});assert.equal(status.status,200);assert.ok(!status.body.includes('openai-fixture'));assert.equal(JSON.parse(status.body).expectedAnswerSent,false);
  let calls=0;const fetcher=async()=>{calls++;return Response.json({text:'Bonjour'});};
  for(const patch of [{expected:'Bonjour'},{target:'Bonjour'},{prompt:'Bonjour'},{language:'en'},{model:'unlisted'}])assert.equal((await request({audio,language:'fr',provider:'openai',...patch},{fetcher})).status,400);
  assert.equal((await request({audio,language:'fr',provider:'openai'},{headers:{origin:'https://foreign.example'},fetcher})).status,403);assert.equal(calls,0);
});
test('OpenAI/Whisper ASR receives only audio, language and model, never the expected words',async()=>{
  for(const provider of ['openai','compatible']){
    const res=await request({audio,language:'fr',provider},{fetcher:async(url,options)=>{
      assert.ok(String(url).endsWith(provider==='openai'?'/audio/transcriptions':'/transcribe'));
      assert.deepEqual([...options.body.keys()].sort(),['file','language','model','response_format']);assert.equal(options.body.get('language'),'fr');assert.equal(options.body.get('file').type,'audio/wav');return Response.json({text:'Je suis étudiant.'});
    }});assert.equal(res.status,200);assert.equal(JSON.parse(res.body).text,'Je suis étudiant.');
  }
});
test('Gemini gets audio and a language instruction, and custom adapters receive a blind audio payload',async()=>{
  const configs=asrConfigurations(env),decoded=decodeAudio(audio);
  const gemini=await requestTranscription(configs.gemini,decoded,'ml','gemini-audio-fixture',{fetcher:async(_url,options)=>{
    const data=JSON.parse(options.body);assert.deepEqual(Object.keys(data.contents[0].parts[0]),['inlineData']);assert.ok(!options.body.includes('എനിക്ക്'));
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'എനിക്ക് വെള്ളം വേണം.'})}]}}]});
  }});assert.equal(gemini.text,'എനിക്ക് വെള്ളം വേണം.');
  const custom=await requestTranscription(configs.custom,decoded,'fr','',{fetcher:async(_url,options)=>{assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(),['audio','language']);return Response.json({text:''});}});assert.equal(custom.text,'');
});
test('provider failures, incomplete results and silence stay distinct; no retry occurs',async()=>{
  for(const [status,code] of [[429,'asr_quota_exceeded'],[503,'asr_provider_unavailable'],[401,'asr_access_denied']]){
    let calls=0;const res=await request({audio,language:'fr',provider:'openai'},{fetcher:async()=>{calls++;return Response.json({error:{message:'private upstream detail'}},{status});}});assert.equal(res.status,status);assert.equal(JSON.parse(res.body).error,code);assert.ok(!res.body.includes('private upstream'));assert.equal(calls,1);
  }
  const empty=await request({audio,language:'fr',provider:'openai'},{fetcher:async()=>Response.json({text:''})});assert.equal(empty.status,200);assert.equal(JSON.parse(empty.body).text,'');
  const malformed=await request({audio,language:'fr',provider:'openai'},{fetcher:async()=>Response.json({answer:'not a transcript'})});assert.equal(JSON.parse(malformed.body).error,'asr_invalid_response');
  const incomplete=await request({audio,language:'fr',provider:'gemini'},{fetcher:async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS'}]})});assert.equal(JSON.parse(incomplete.body).error,'asr_incomplete_response');
});
