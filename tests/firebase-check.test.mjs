import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {checkGateway} from '../firebase/check.mjs';
import {createCloudGateway,geminiEnvironment} from '../gateway/cloud-handler.mjs';

const token='fixture_gateway_token_'.padEnd(64,'x'),origin='https://bhaashik.github.io';
async function fixture(action){
  const calls=[],env=geminiEnvironment({apiKey:'private-gemini-fixture',origins:origin,ocrModel:'gemini-3.1-flash-lite',asrModel:'gemini-3.1-flash-lite',ttsModel:'gemini-2.5-flash-preview-tts',voice:'Kore'});
  const gateway=createCloudGateway({env,accessToken:token,fetcher:async(url,options)=>{
    assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
    const body=JSON.parse(options.body);calls.push(body);
    assert.ok(!options.body.includes('expectedAnswer'));
    const part=body.contents[0].parts.find(p=>p.inlineData);
    if(body.generationConfig.responseModalities?.includes('AUDIO'))return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'audio/L16;rate=24000',data:Buffer.alloc(480).toString('base64')}}]}}]});
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(part.inlineData.mimeType==='image/png'?{text:'അ',legible:true}:{text:'നമസ്കാരം'})}]}}]});
  }});
  const server=http.createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);req.rawBody=Buffer.concat(chunks);await gateway(req,res);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{await action({base,token,origin,calls});}finally{await new Promise(resolve=>server.close(resolve));}
}

test('gateway diagnostic verifies Gemini metadata, authentication and CORS without paid calls',async()=>{
  await fixture(async({calls,...options})=>{
    const report=await checkGateway(options);
    assert.equal(report.passed,true,JSON.stringify(report));assert.equal(report.checks.length,9);
    assert.deepEqual(report.generation,{tts:false,asr:false,ocr:false});assert.equal(calls.length,0);
    assert.ok(!JSON.stringify(report).includes(token));assert.ok(!JSON.stringify(report).includes('private-gemini-fixture'));
    assert.equal(report.checks.find(c=>c.name==='ocr configuration').model,'gemini-3.1-flash-lite');
  });
});
test('explicit gateway generation checks exercise speech, returned WAV transcription and blind OCR',async()=>{
  await fixture(async({calls,...options})=>{
    const image=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(image);image.writeUInt32BE(100,16);image.writeUInt32BE(100,20);
    const report=await checkGateway({...options,generate:true,image});
    assert.equal(report.passed,true,JSON.stringify(report));assert.deepEqual(report.generation,{tts:true,asr:true,ocr:true});assert.equal(calls.length,3);
    assert.equal(report.checks.find(c=>c.name==='asr generation').transcript,'നമസ്കാരം');
    const asr=calls.find(c=>c.contents[0].parts.some(p=>p.inlineData?.mimeType==='audio/wav'));
    assert.ok(asr);assert.ok(!JSON.stringify(asr).includes('നമസ്കാരം'),'ASR receives the audio without its expected phrase');
  });
});
test('diagnostic separates refused access and CORS failures from successful generation',async()=>{
  await fixture(async({calls,...options})=>{
    const refused=await checkGateway({...options,token:'wrong_token_'.padEnd(64,'w'),generate:true});
    assert.equal(refused.passed,false);assert.equal(calls.length,0);assert.match(refused.checks[0].error,/401/);
    const cors=await checkGateway({...options,origin:'https://different.example'});
    assert.equal(cors.passed,false);assert.ok(cors.checks.some(c=>c.name.includes('preflight')&&!c.passed));assert.equal(calls.length,0);
  });
});
test('diagnostic rejects unsafe addresses and missing access before network calls',async()=>{
  let calls=0;const options={token,fetcher:()=>{calls++;throw Error('unexpected');}};
  for(const base of ['http://public.example','https://user:pass@example.com','https://example.com?token=secret','https://example.com/api/ocr'])await assert.rejects(checkGateway({...options,base}));
  await assert.rejects(checkGateway({...options,base:'https://example.com',token:''}),/BHAASA_GATEWAY_TOKEN/);assert.equal(calls,0);
});
