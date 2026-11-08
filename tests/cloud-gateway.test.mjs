import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createCloudGateway,geminiEnvironment} from '../gateway/cloud-handler.mjs';

const token='test_gateway_token_'.padEnd(64,'x');
const config={apiKey:'private-google-key-fixture',origins:'https://bhaashik.github.io,http://127.0.0.1:4173',
  ocrModel:'gemini-2.5-flash',asrModel:'gemini-2.5-flash',ttsModel:'gemini-2.5-flash-preview-tts',voice:'Kore'};
const env=geminiEnvironment(config);
async function request(path,{method='GET',data,rawBody,headers={},accessToken=token,environment=env,fetcher=async()=>{throw Error('Unexpected provider request');}}={}){
  const req=new EventEmitter();Object.assign(req,{url:path,method,headers:{origin:'https://bhaashik.github.io','content-type':'application/json','x-bhaasa-gateway-token':token,...headers},rawBody:rawBody??Buffer.from(JSON.stringify(data??{})),body:{expected:'Firebase parsed body must not replace raw bytes'}});
  const res=new EventEmitter();Object.assign(res,{status:0,headers:{},body:Buffer.alloc(0),headersSent:false,
    setHeader(name,value){this.headers[name]=value;},
    writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);this.headersSent=true;return this;},
    end(value=''){this.body=Buffer.from(value);return this;}});
  await createCloudGateway({env:environment,accessToken,fetcher})(req,res);return res;
}
test('cloud metadata uses the existing app contract without exposing either secret',async()=>{
  for(const prefix of ['','/bhaasaApi'])for(const path of ['/api/ocr','/api/speech/models','/api/transcribe']){
    const res=await request(prefix+path);assert.equal(res.status,200);const data=JSON.parse(res.body);
    assert.equal(data.provider||data.providers.find(p=>p.id==='gemini')?.id,'gemini');
    if(data.providers)assert.equal(data.providers.find(p=>p.id==='gemini').configured,true);
    assert.ok(!res.body.includes(Buffer.from(config.apiKey)));assert.ok(!res.body.includes(Buffer.from(token)));
    assert.equal(res.headers['Access-Control-Allow-Origin'],'https://bhaashik.github.io');assert.equal(res.headers['Cache-Control'],'no-store');
  }
});
test('cloud gateway authenticates metadata and generation, including non-browser clients',async()=>{
  let calls=0;const fetcher=async()=>{calls++;};
  for(const method of ['GET','POST'])for(const supplied of [undefined,'wrong-token','ø'.repeat(token.length)]){
    const res=await request('/api/ocr',{method,headers:{'x-bhaasa-gateway-token':supplied},fetcher});assert.equal(res.status,401);
  }
  assert.equal((await request('/api/ocr',{headers:{origin:undefined,'x-bhaasa-gateway-token':undefined},fetcher})).status,401);
  assert.equal((await request('/api/ocr',{headers:{origin:'https://foreign.example'},fetcher})).status,403);
  assert.equal((await request('/api/ocr',{accessToken:'short',fetcher})).status,503);
  const same='another_random_'.padEnd(64,'a');assert.equal((await request('/api/ocr',{environment:{...env,BHAASA_TTS_API_KEY:same},accessToken:same,fetcher})).status,503);
  assert.equal(calls,0);
});
test('cloud CORS preflight accepts the access header without requiring a token',async()=>{
  const res=await request('/bhaasaApi/api/transcribe',{method:'OPTIONS',headers:{'x-bhaasa-gateway-token':undefined}});
  assert.equal(res.status,204);assert.match(res.headers['Access-Control-Allow-Headers'],/X-Bhaasa-Gateway-Token/);
  assert.equal((await request('/api/ocr',{method:'OPTIONS',headers:{origin:'https://foreign.example'}})).status,403);
});
test('cloud wrapper rejects invalid routes, methods, types and request sizes before Gemini',async()=>{
  assert.equal((await request('/.env.local')).status,404);
  assert.equal((await request('/anotherFunction/api/ocr')).status,404);
  assert.equal((await request('/api/ocr',{method:'PUT'})).status,405);
  assert.equal((await request('/api/ocr',{method:'POST',headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await request('/api/ocr',{method:'POST',rawBody:Buffer.alloc(2*1024*1024+1)})).status,413);
  assert.equal((await request('/api/speech',{method:'POST',rawBody:Buffer.alloc(65537)})).status,413);
  assert.equal((await request('/api/transcribe',{method:'POST',rawBody:Buffer.alloc(14*1024*1024+1)})).status,413);
  assert.equal((await request('/api/ocr',{method:'POST',rawBody:Buffer.from('invalid-json')})).status,400);
});
test('Firebase rawBody is replayed to OCR and ASR; only actual ink/speech reaches Gemini',async()=>{
  const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(100,16);png.writeUInt32BE(100,20);
  const wav=Buffer.alloc(48);wav.write('RIFF');wav.writeUInt32LE(40,4);wav.write('WAVE',8);
  for(const [path,data,result] of [
    ['/api/ocr',{provider:'gemini',image:`data:image/png;base64,${png.toString('base64')}`},{text:'ക',legible:true}],
    ['/api/transcribe',{provider:'gemini',language:'ml',audio:`data:audio/wav;base64,${wav.toString('base64')}`},{text:'നമസ്കാരം'}]
  ]){
    let calls=0;const res=await request('/bhaasaApi'+path,{method:'POST',data,fetcher:async(url,options)=>{
      calls++;assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');assert.equal(options.headers['x-goog-api-key'],config.apiKey);
      assert.ok(!options.body.includes('"expected":'));assert.ok(!options.body.includes('Firebase parsed body'));
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]});
    }});assert.equal(res.status,200);assert.equal(JSON.parse(res.body).text,result.text);assert.equal(calls,1);
  }
});
test('Firebase TTS reuses the Gemini adapter and returns WAV audio',async()=>{
  const res=await request('/api/speech',{method:'POST',data:{provider:'gemini',model:config.ttsModel,voice:'Kore',language:'ml-IN',input:'ക'},fetcher:async(url,options)=>{
    assert.equal(options.headers['x-goog-api-key'],config.apiKey);const body=JSON.parse(options.body);
    assert.deepEqual(body.generationConfig.responseModalities,['AUDIO']);
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:Buffer.alloc(480).toString('base64')}}]}}]});
  }});
  assert.equal(res.status,200);assert.equal(res.headers['Content-Type'],'audio/wav');assert.equal(res.body.subarray(0,4).toString(),'RIFF');
});
