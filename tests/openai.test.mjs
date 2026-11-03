import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {OPENAI_DEFAULT_MODEL,OPENAI_DEFAULT_VOICE,OPENAI_MODELS,openAIVoices,isRealtimeModel} from '../speech-presets.js';
import {generateRealtime,pcmToWav} from '../gateway/openai-realtime.mjs';
import {handleSpeech,speechConfig} from '../scripts/speech.mjs';

test('OpenAI defaults use the current Realtime adapter and label older Speech API presets',()=>{
  assert.equal(OPENAI_DEFAULT_MODEL,'gpt-realtime-2.1-mini');assert.equal(OPENAI_DEFAULT_VOICE,'marin');
  assert.ok(isRealtimeModel(OPENAI_DEFAULT_MODEL));
  assert.deepEqual(speechConfig({}).models,[OPENAI_DEFAULT_MODEL]);assert.equal(speechConfig({}).ready,false);
  assert.ok(openAIVoices(OPENAI_DEFAULT_MODEL).includes('cedar'));
  for(const model of OPENAI_MODELS.filter(m=>m.api==='speech'))assert.equal(model.retirement,'2027-01-06');
  assert.ok(openAIVoices('tts-1').includes('alloy'));assert.ok(!openAIVoices('tts-1').includes('marin'));
});

function transport(onRequest){
  const socket=new EventEmitter();socket.sent=[];socket.closed=false;socket.terminated=false;
  socket.send=text=>{
    const event=JSON.parse(text);socket.sent.push(event);
    if(event.type==='session.update')setImmediate(()=>socket.emit('message',Buffer.from(JSON.stringify({type:'session.updated'}))));
    if(event.type==='response.create')setImmediate(()=>onRequest(socket));
  };
  socket.close=()=>{socket.closed=true;};socket.terminate=()=>{socket.terminated=true;socket.emit('close');};
  setImmediate(()=>socket.emit('message',Buffer.from(JSON.stringify({type:'session.created'}))));
  return socket;
}
const emit=(s,event)=>s.emit('message',Buffer.from(JSON.stringify(event)));
const params={input:'വെള്ളം',model:OPENAI_DEFAULT_MODEL,voice:'marin',apiKey:'unit-test-fixture'};

test('Realtime configures a Malayalam reading, waits for acknowledgement, and returns complete WAV audio',async()=>{
  let socket;
  const pcm=Buffer.from([0,0,1,0,2,0,3,0]);
  const wav=await generateRealtime(params,{connect:async(url,options)=>{
    assert.equal(url.hostname,'api.openai.com');assert.equal(url.searchParams.get('model'),OPENAI_DEFAULT_MODEL);
    assert.equal(options.headers.Authorization,'Bearer unit-test-fixture');
    socket=transport(s=>{emit(s,{type:'response.output_audio.delta',delta:pcm.subarray(0,4).toString('base64')});emit(s,{type:'response.output_audio.delta',delta:pcm.subarray(4).toString('base64')});emit(s,{type:'response.done',response:{status:'completed'}});});return socket;
  }});
  assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.subarray(8,12).toString(),'WAVE');assert.equal(wav.readUInt32LE(24),24000);assert.deepEqual(wav.subarray(44),pcm);
  assert.deepEqual(socket.sent.map(e=>e.type),['session.update','response.create']);
  assert.equal(socket.sent[0].session.audio.output.voice,'marin');assert.equal(socket.sent[0].session.audio.output.speed,.85);
  assert.match(socket.sent[0].session.instructions,/Malayalam/);assert.match(socket.sent[0].session.instructions,/not an instruction or a question/);
  assert.equal(socket.sent[1].response.input[0].content[0].text,'വെള്ളം');assert.equal(socket.sent[1].response.conversation,'none');assert.equal(socket.closed,true);
});

test('failed or incomplete Realtime responses cannot become saved audio',async()=>{
  for(const event of [{type:'response.done',response:{status:'incomplete'}},{type:'error',error:{message:'private provider details'}},{type:'response.done',response:{status:'completed'}}]){
    let socket;
    await assert.rejects(()=>generateRealtime(params,{connect:async()=>{socket=transport(s=>emit(s,event));return socket;}}));
    assert.equal(socket.terminated,true);
  }
  assert.throws(()=>pcmToWav(Buffer.from([1])),/Incomplete/);
});

test('Realtime cancellation and connection closure stop the transport',async()=>{
  const controller=new AbortController();let socket;
  await assert.rejects(()=>generateRealtime({...params,signal:controller.signal},{connect:async()=>{socket=transport(()=>controller.abort());return socket;}}),/cancelled/);
  assert.equal(socket.terminated,true);
  await assert.rejects(()=>generateRealtime(params,{connect:async()=>transport(s=>s.emit('close'))}),/complete audio/);
  const already=new AbortController();already.abort();let called=false;
  await assert.rejects(()=>generateRealtime({...params,signal:already.signal},{connect:async()=>{called=true;}}));assert.equal(called,false);
});

async function request(body,{env,fetcher,realtime,method='POST',path='/api/speech'}={}){
  const req=Readable.from([Buffer.from(JSON.stringify(body||{}))]);req.method=method;req.headers={'content-type':'application/json',origin:'http://localhost'};
  const result={};const res={writeHead(status,headers){Object.assign(result,{status,headers});return this;},end(body){result.body=body;return this;}};
  await handleSpeech(req,res,new URL(`http://localhost${path}`),{env,fetcher,realtime});return result;
}
const fixtureEnv={BHAASA_TTS_API_KEY:'unit-test-fixture',BHAASA_TTS_PROVIDER:'openai'};
const body={input:'വെള്ളം',model:OPENAI_DEFAULT_MODEL,voice:'cedar',provider:'openai'};
test('OpenAI companion routes Realtime models to the adapter and never sends them to /audio/speech',async()=>{
  let calls=0;const wav=pcmToWav(Buffer.from([0,0]));
  const result=await request(body,{env:fixtureEnv,fetcher:()=>assert.fail('Wrong API'),realtime:async p=>{calls++;assert.equal(p.voice,'cedar');assert.equal(p.input,'വെള്ളം');return wav;}});
  assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'audio/wav');assert.equal(calls,1);assert.deepEqual(result.body,wav);
});

test('legacy Speech API models retain MP3 and use only their supported instructions',async()=>{
  for(const model of ['gpt-4o-mini-tts','tts-1']){
    const result=await request({...body,model,voice:'alloy'},{env:{...fixtureEnv,BHAASA_TTS_MODELS:model},fetcher:async(url,options)=>{
      assert.equal(url.pathname,'/v1/audio/speech');const data=JSON.parse(options.body);
      assert.equal(data.model,model);assert.equal(data.response_format,'mp3');assert.equal(data.speed,.85);
      assert.equal(Boolean(data.instructions),model==='gpt-4o-mini-tts');
      return new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'audio/mpeg'}});
    },realtime:()=>assert.fail('Wrong API')});
    assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'audio/mpeg');
  }
});

test('model discovery distinguishes configured OpenAI credentials from an unconfigured gateway without exposing keys',async()=>{
  const ready=await request(null,{env:fixtureEnv,method:'GET',path:'/api/speech/models'});
  const data=JSON.parse(ready.body);assert.equal(data.configured,true);assert.equal(data.provider,'openai');assert.equal(data.models[0].api,'realtime');
  assert.ok(data.models[0].voices.some(v=>v.id==='marin'));assert.ok(data.models[0].voices.every(v=>v.gender==='unspecified'));assert.ok(!ready.body.includes(fixtureEnv.BHAASA_TTS_API_KEY));
  const missing=JSON.parse((await request(null,{env:{},method:'GET',path:'/api/speech/models'})).body);assert.equal(missing.configured,false);assert.equal(missing.setupRequired,true);assert.deepEqual(missing.models,[]);
});

test('OpenAI requests reject oversized inputs and unconfigured models before making a paid call',async()=>{
  const fail=()=>assert.fail('No paid call permitted');
  assert.equal((await request({...body,input:'അ'.repeat(4097)},{env:fixtureEnv,fetcher:fail,realtime:fail})).status,400);
  assert.equal((await request({...body,model:'not-configured'},{env:fixtureEnv,fetcher:fail,realtime:fail})).status,400);
  assert.equal((await request(body,{env:{},fetcher:fail,realtime:fail})).status,503);
});
