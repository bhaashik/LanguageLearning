import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {ocrConfigurations,publicOCRConfig,ocrProviderRequest,parseOCRResult} from '../scripts/ocr-providers.mjs';
import {handleOCR,ocrServerEnabled} from '../scripts/ocr.mjs';
import {loadOCRSettings,saveOCRSettings,ocrSelection,ocrRecognitionKey,recognitionPayload,ocrErrorMessage} from '../ocr-settings.js';
import {emptyProgress,recordHandwritingRecognition,validateProgress} from '../learning.js';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const transcription={text:'ക',legible:true};
const fixture={
  BHAASA_OCR_OPENAI_API_KEY:'openai-test-fixture',
  BHAASA_OCR_GEMINI_API_KEY:'gemini-test-fixture',BHAASA_OCR_GEMINI_MODELS:'models/gemini-vision-fixture,gemini-other-fixture',
  BHAASA_OCR_ANTHROPIC_API_KEY:'claude-test-fixture',BHAASA_OCR_ANTHROPIC_MODEL:'claude-vision-fixture',
  BHAASA_OCR_COMPATIBLE_URL:'http://127.0.0.1:11434/v1/chat/completions',BHAASA_OCR_COMPATIBLE_MODEL:'local-vision-fixture',
  BHAASA_OCR_CUSTOM_URL:'http://localhost:9000/recognize'
};
function envelope(provider,result=transcription){
  const text=JSON.stringify(result);
  return {
    openai:{status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]},
    gemini:{candidates:[{finishReason:'STOP',content:{parts:[{text:'private thinking',thought:true},{text}]}}]},
    anthropic:{stop_reason:'end_turn',content:[{type:'text',text}]},
    compatible:{choices:[{finish_reason:'stop',message:{content:text}}]},
    custom:result
  }[provider];
}
async function request(body,{env=fixture,method='POST',query='',fetcher=()=>assert.fail('Unexpected provider call')}={}){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;req.headers={'content-type':'application/json',origin:'http://localhost'};
  const result={};const res={writeHead(status,headers){Object.assign(result,{status,headers});return this;},end(body){result.body=body;return this;}};
  await handleOCR(req,res,new URL('http://localhost/api/ocr'+query),{env,fetcher});return result;
}

test('OCR credentials stay with their provider and public configuration never exposes them',async()=>{
  let config=ocrConfigurations({BHAASA_TTS_API_KEY:'speech-fixture'});
  assert.equal(config.openai.key,'speech-fixture');assert.equal(config.gemini.key,undefined);assert.equal(config.anthropic.key,undefined);
  config=ocrConfigurations({BHAASA_TTS_PROVIDER:'elevenlabs',BHAASA_TTS_API_KEY:'elevenlabs-fixture'});
  assert.equal(config.openai.configured,false);assert.equal(config.openai.key,undefined);
  assert.equal(ocrConfigurations({BHAASA_OCR_API_KEY:'legacy-fixture'}).openai.configured,true);
  assert.equal(ocrConfigurations({BHAASA_OCR_API_KEY:'legacy',BHAASA_OCR_OPENAI_API_KEY:'preferred'}).openai.key,'preferred');
  const result=await request({}, {method:'GET'}),body=JSON.parse(result.body);
  assert.equal(result.status,200);assert.equal(body.expectedAnswerSent,false);assert.equal(body.providers.length,5);
  assert.ok(body.providers.every(c=>c.configured));
  for(const [name,value] of Object.entries(fixture).filter(([name])=>/API_KEY|URL/.test(name)))assert.ok(!result.body.includes(value),`${name} must be private`);
  assert.equal(ocrServerEnabled({BHAASA_OCR_COMPATIBLE_URL:fixture.BHAASA_OCR_COMPATIBLE_URL,BHAASA_OCR_COMPATIBLE_MODEL:'vision'}),true);
  assert.equal(ocrServerEnabled({}),false);
});

test('each named OCR adapter uses its own protocol and returns a source-tagged transcription',async()=>{
  for(const provider of ['openai','gemini','anthropic','compatible','custom']){
    const result=await request({image:png,provider},{fetcher:async(url,options)=>{
      const body=JSON.parse(options.body),config=ocrConfigurations(fixture)[provider];
      assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
      assert.ok(!options.body.includes('ക'),'no expected symbol is sent');
      if(provider==='openai'){
        assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,`Bearer ${config.key}`);
        assert.equal(body.input[0].content[1].image_url,png);assert.equal(body.store,false);
      }else if(provider==='gemini'){
        assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-vision-fixture:generateContent');
        assert.equal(options.headers['x-goog-api-key'],config.key);assert.equal(options.headers.Authorization,undefined);
        assert.equal(body.contents[0].parts[1].inlineData.data,png.split(',')[1]);assert.equal(body.generationConfig.responseMimeType,'application/json');
      }else if(provider==='anthropic'){
        assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.headers['x-api-key'],config.key);
        assert.equal(options.headers['anthropic-version'],'2023-06-01');assert.equal(body.messages[0].content[0].source.data,png.split(',')[1]);
      }else if(provider==='compatible'){
        assert.equal(url,fixture.BHAASA_OCR_COMPATIBLE_URL);assert.equal(options.headers.Authorization,undefined);
        assert.equal(body.messages[1].content[1].image_url.url,png);assert.equal(body.model,'local-vision-fixture');
      }else{assert.equal(url,fixture.BHAASA_OCR_CUSTOM_URL);assert.deepEqual(body,{image:png});}
      return Response.json(envelope(provider));
    }});
    assert.equal(result.status,200,provider);assert.deepEqual(JSON.parse(result.body),{...transcription,provider,model:ocrConfigurations(fixture)[provider].model||null});
  }
});

test('provider/model selection is explicit and allowlisted before a provider call',async()=>{
  for(const provider of ['none','unknown','__proto__',12])assert.equal((await request({image:png,provider})).status,400);
  assert.equal((await request({image:png,provider:'gemini',model:'unlisted'})).status,400);
  assert.equal((await request({image:png,provider:'gemini',expected:'ക'})).status,400);
  const missing=await request({image:png,provider:'gemini'},{env:{BHAASA_OCR_OPENAI_API_KEY:'openai-only-fixture'}});
  assert.equal(missing.status,503);assert.equal(JSON.parse(missing.body).provider,'gemini');
  const allowed=await request({image:png,provider:'gemini',model:'gemini-other-fixture'},{fetcher:async url=>{
    assert.ok(url.includes('/gemini-other-fixture:generateContent'));return Response.json(envelope('gemini'));
  }});assert.equal(allowed.status,200);
  const legacyDefault=await request({image:png},{env:{...fixture,BHAASA_OCR_PROVIDER:'anthropic'},fetcher:async url=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages');return Response.json(envelope('anthropic'));
  }});assert.equal(JSON.parse(legacyDefault.body).provider,'anthropic');
});

test('local/custom endpoints accept optional independent credentials and reject unsafe configuration',()=>{
  for(const id of ['compatible','custom']){
    const prefix=`BHAASA_OCR_${id.toUpperCase()}_`;
    for(const url of ['http://public.example/ocr','https://user:pass@example.com/ocr','https://example.com/ocr?key=secret','relative/path']){
      const config=ocrConfigurations({...fixture,[prefix+'URL']:url})[id];
      assert.equal(config.configured,false);assert.equal(config.configurationError,'invalid_endpoint');
    }
    const config=ocrConfigurations({...fixture,[prefix+'API_KEY']:'local-own-fixture'})[id];
    assert.equal(ocrProviderRequest(config,png,config.model).headers.Authorization,'Bearer local-own-fixture');
    assert.ok(!JSON.stringify(publicOCRConfig(config)).includes('local-own-fixture'));
  }
});

test('all adapters reject partial output, guesses, and invalid transcription while preserving uncertainty',()=>{
  const partial={openai:{status:'incomplete'},gemini:{candidates:[{finishReason:'MAX_TOKENS'}]},anthropic:{stop_reason:'max_tokens'},compatible:{choices:[{finish_reason:'length'}]}};
  for(const id of ['openai','gemini','anthropic','compatible','custom']){
    assert.deepEqual(parseOCRResult(id,envelope(id,{text:null,legible:false})),{text:null,legible:false});
    for(const invalid of [{text:'guess: ക',legible:true},{text:'',legible:true},{text:'ക',legible:'yes'}])assert.throws(()=>parseOCRResult(id,envelope(id,invalid)),undefined,id);
    if(partial[id])assert.throws(()=>parseOCRResult(id,partial[id]));
  }
});

test('provider failures never leak the upstream response or record a fabricated result',async()=>{
  const denied=await request({image:png,provider:'anthropic'},{fetcher:async()=>new Response('private vendor details',{status:401})});
  assert.equal(denied.status,401);assert.ok(!denied.body.includes('private'));
  const bad=await request({image:png,provider:'compatible'},{fetcher:async()=>Response.json({choices:[]})});assert.equal(bad.status,502);
});

test('Gemini resource prefixes and whitespace resolve to the same allowed API model',async()=>{
  for(const model of ['gemini-vision-fixture','models/gemini-vision-fixture',' models/gemini-vision-fixture ']){
    const result=await request({image:png,provider:'gemini',model},{fetcher:async url=>{
      assert.ok(url.includes('/gemini-vision-fixture:generateContent'));return Response.json(envelope('gemini'));
    }});
    assert.equal(result.status,200);assert.equal(JSON.parse(result.body).model,'gemini-vision-fixture');
  }
});

test('brand names and disallowed models produce actionable local errors before a provider call',async()=>{
  const mismatch=await request({image:png,provider:'gemini',model:'different-model'}),body=JSON.parse(mismatch.body);
  assert.equal(mismatch.status,400);assert.equal(body.error,'model_not_allowed');assert.equal(body.source,'gateway');
  assert.deepEqual(body.models,['gemini-vision-fixture','gemini-other-fixture']);
  assert.match(ocrErrorMessage(mismatch.status,body,'gemini'),/Clear the optional Model field/);
  assert.match(ocrErrorMessage(mismatch.status,body,'gemini'),/gemini-vision-fixture/);
  assert.equal(JSON.parse((await request({image:png,provider:'gemini',model:'Gemini'})).body).error,'invalid_model_id');
  const env={...fixture,BHAASA_OCR_GEMINI_MODELS:'',BHAASA_OCR_GEMINI_MODEL:'Gemini'};
  const config=ocrConfigurations(env).gemini;assert.equal(config.configured,false);assert.equal(config.configurationError,'invalid_model_id');
  const invalidDefault=await request({image:png,provider:'gemini'},{env});
  assert.equal(JSON.parse(invalidDefault.body).error,'invalid_model_id');
});

test('Gemini upstream errors remain distinct from gateway validation and never expose raw details',async()=>{
  const scenarios=[
    [400,{status:'INVALID_ARGUMENT',message:'API key not valid: private-gemini-fixture',details:[{reason:'API_KEY_INVALID',metadata:{key:'private-gemini-fixture'}}]},'invalid_credentials'],
    [400,{status:'INVALID_ARGUMENT',message:'private unknown validation details'},'provider_request_invalid'],
    [400,{status:'FAILED_PRECONDITION',message:'User location is not supported'},'provider_region_unavailable'],
    [403,{details:[{reason:'API_KEY_HTTP_REFERRER_BLOCKED'}]},'credential_restricted'],
    [403,{details:[{reason:'SERVICE_DISABLED'}]},'api_disabled'],
    [404,{message:'private model info'},'provider_model_unavailable'],
    [429,{message:'private quota info'},'provider_quota_exceeded'],
    [503,{message:'private unavailable info'},'provider_unavailable']
  ];
  for(const [status,error,code] of scenarios){
    const result=await request({image:png,provider:'gemini'},{fetcher:async()=>Response.json({error},{status})});
    const body=JSON.parse(result.body);assert.equal(result.status,status);assert.equal(body.source,'provider');assert.equal(body.error,code);
    assert.ok(!result.body.includes('private'));assert.notEqual(body.error,'model_not_allowed');
    assert.ok(!ocrErrorMessage(status,body,'gemini').includes('private'));
  }
  const fallback=ocrErrorMessage(400,{message:'private key in unrecognized response'},'gemini');assert.ok(!fallback.includes('private'));
});

test('Gemini model listing uses its server key, follows pagination and never submits an image',async()=>{
  let calls=0;
  const result=await request({}, {method:'GET',query:'?action=models&provider=gemini',fetcher:async(url,options)=>{
    const parsed=new URL(url);assert.equal(parsed.origin,'https://generativelanguage.googleapis.com');assert.equal(parsed.pathname,'/v1beta/models');
    assert.equal(parsed.searchParams.get('pageSize'),'1000');assert.equal(options.headers['x-goog-api-key'],fixture.BHAASA_OCR_GEMINI_API_KEY);
    assert.equal(options.body,undefined);assert.equal(options.redirect,'error');assert.ok(!url.includes(fixture.BHAASA_OCR_GEMINI_API_KEY));
    calls++;
    if(calls===1)return Response.json({models:[{name:'models/gemini-vision-fixture',supportedGenerationMethods:['generateContent'],description:'private info'},{name:'models/embedding-fixture',supportedGenerationMethods:['embedContent']}],nextPageToken:'private-page-token'});
    assert.equal(parsed.searchParams.get('pageToken'),'private-page-token');
    return Response.json({models:[{name:'models/gemini-other-fixture',supportedGenerationMethods:['generateContent']}]});
  }});
  const body=JSON.parse(result.body);assert.equal(result.status,200);assert.equal(calls,2);
  assert.deepEqual(body.models,['gemini-other-fixture','gemini-vision-fixture']);assert.equal(body.configuredModelListed,true);assert.equal(body.complete,true);
  assert.ok(!result.body.includes('private'));assert.ok(!result.body.includes(fixture.BHAASA_OCR_GEMINI_API_KEY));
});

test('model listing diagnoses invalid keys, works without a valid default model and never borrows an OpenAI key',async()=>{
  const query='?action=models&provider=gemini',method='GET';
  assert.equal((await request({},{query,method,env:{BHAASA_OCR_OPENAI_API_KEY:'openai-only'}})).status,503);
  assert.equal((await request({},{query:'?action=models&provider=openai',method})).status,400);
  const denied=await request({},{query,method,fetcher:async()=>Response.json({error:{message:'private API key not valid',details:[{reason:'API_KEY_INVALID'}]}},{status:400})});
  assert.equal(JSON.parse(denied.body).error,'invalid_credentials');assert.ok(!denied.body.includes('private'));
  const result=await request({},{query,method,env:{...fixture,BHAASA_OCR_GEMINI_MODELS:'',BHAASA_OCR_GEMINI_MODEL:'Gemini'},fetcher:async()=>Response.json({models:[{name:'models/gemini-vision-fixture',supportedGenerationMethods:['generateContent']}]})});
  assert.equal(result.status,200);assert.equal(JSON.parse(result.body).configuredModelListed,false);
});

test('Gemini 2.5 Flash avoids spending the transcription budget on thinking without changing other families',async()=>{
  for(const model of ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.5-pro','gemini-3.8-flash']){
    const env={...fixture,BHAASA_OCR_GEMINI_MODELS:model};let calls=0;
    const result=await request({image:png,provider:'gemini',model},{env,fetcher:async(url,options)=>{
      calls++;const body=JSON.parse(options.body),config=body.generationConfig;
      assert.equal(config.maxOutputTokens,4096);assert.equal(config.responseMimeType,'application/json');
      if(['gemini-2.5-flash','gemini-2.5-flash-lite'].includes(model))assert.deepEqual(config.thinkingConfig,{thinkingBudget:0});
      else assert.equal(config.thinkingConfig,undefined,'do not force unsupported thinking settings onto Pro or newer models');
      assert.ok(!options.body.includes('ക'),'no target symbol is sent');return Response.json(envelope('gemini'));
    }});
    assert.equal(result.status,200);assert.equal(calls,1);assert.equal(JSON.parse(result.body).text,'ക');
  }
});

test('response token limits, empty text, malformed JSON and invalid results have distinct local errors',async()=>{
  const cases=[
    [{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{thought:true,text:'private thinking'}, {text:JSON.stringify(transcription)}]}}],usageMetadata:{thoughtsTokenCount:1024}},'recognition_token_limit'],
    [{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private thinking'}]}}]},'recognition_no_result'],
    [{candidates:[{finishReason:'STOP',content:{parts:[{text:'private invalid JSON'}]}}]},'recognition_invalid_json'],
    [envelope('gemini',{text:'private non-Malayalam',legible:true}),'recognition_invalid_result'],
    [{promptFeedback:{blockReason:'SAFETY',private:'private details'}},'recognition_blocked'],
    [{candidates:[{finishReason:'OTHER',content:{parts:[{text:'private unfinished'}]}}]},'recognition_incomplete']
  ];
  for(const [body,code] of cases){
    let calls=0;const result=await request({image:png,provider:'gemini'},{fetcher:async()=>{calls++;return Response.json(body);}});
    const error=JSON.parse(result.body);assert.equal(result.status,502);assert.equal(error.error,code);assert.equal(error.source,'gateway');
    assert.equal(calls,1,'a failed paid request is not retried automatically');assert.ok(!result.body.includes('private'));assert.ok(!result.body.includes('ക'));
    assert.match(ocrErrorMessage(502,error,'gemini'),/No handwriting result was scored|no handwriting result was scored/);
  }
  const html=await request({image:png,provider:'gemini'},{fetcher:async()=>new Response('<html>private upstream page</html>')});
  assert.equal(JSON.parse(html.body).error,'recognition_invalid_json');assert.ok(!html.body.includes('private'));
});

test('a local timeout/connection failure remains distinct from an upstream HTTP 502',async()=>{
  for(const [failure,code,status] of [
    [new DOMException('private timeout','TimeoutError'),'ocr_timeout',504],
    [new TypeError('private fetch failure',{cause:{code:'ECONNRESET',secret:'private'}}),'ocr_connection_failed',502],
    [new Error('private unexpected exception'),'ocr_gateway_failed',502]
  ]){
    const result=await request({image:png,provider:'gemini'},{fetcher:async()=>{throw failure;}});
    assert.equal(result.status,status);assert.equal(JSON.parse(result.body).error,code);assert.ok(!result.body.includes('private'));
  }
  const upstream=await request({image:png,provider:'gemini'},{fetcher:async()=>Response.json({error:{message:'private provider error'}},{status:502})});
  assert.equal(upstream.status,502);assert.equal(JSON.parse(upstream.body).source,'provider');assert.equal(JSON.parse(upstream.body).error,'provider_unavailable');
  assert.equal(parseOCRResult('gemini',envelope('gemini',{text:null,legible:false})).legible,false,'unreadable ink is still a successful, unjudged response');
});

test('browser preferences migrate legacy endpoints and keep independent provider/model identities',()=>{
  const previous=globalThis.localStorage,map=new Map([['bhaasa.ocr.gateway','http://localhost:9001/api/ocr']]);
  globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  try{
    let settings=loadOCRSettings();assert.equal(settings.profiles.openai.endpoint,'http://localhost:9001/api/ocr');
    settings.provider='gemini';settings.profiles.gemini.model='vision-a';assert.equal(saveOCRSettings(settings),true);
    settings=loadOCRSettings();const selected=ocrSelection(settings);assert.equal(selected.provider,'gemini');assert.equal(selected.model,'vision-a');
    assert.equal(settings.profiles.openai.endpoint,'http://localhost:9001/api/ocr');
    const key=ocrRecognitionKey(selected);
    for(const change of [{provider:'openai'},{model:'vision-b'},{endpoint:'https://other.example/ocr'}])assert.notEqual(ocrRecognitionKey({...selected,...change}),key);
    assert.deepEqual(recognitionPayload(png,selected),{image:png,provider:'gemini',model:'vision-a'});
    assert.deepEqual(recognitionPayload(png,{provider:'custom'}),{image:png});
    assert.throws(()=>recognitionPayload(png,{provider:'none'}));
  }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous;}
});

test('one drawing retains readings across providers, reloads, and explicit fresh requests',()=>{
  let progress=emptyProgress();const result={text:'ക',matched:true,drawingId:'same-drawing',provider:'openai',model:'vision-a',recognitionKey:'openai-key'};
  progress=recordHandwritingRecognition(progress,'vel-0',result);
  progress=recordHandwritingRecognition(progress,'vel-0',result);
  assert.equal(progress.writing['vel-0'].ocr.requests,1);
  progress=recordHandwritingRecognition(progress,'vel-0',{...result,provider:'gemini',recognitionKey:'gemini-key',matched:false,text:'മ'});
  progress=recordHandwritingRecognition(progress,'vel-0',result);
  assert.equal(progress.writing['vel-0'].ocr.requests,2);assert.equal(progress.writing['vel-0'].ocr.readings.length,2);
  progress=validateProgress(JSON.parse(JSON.stringify(progress)),new Set(['vel-0']),new Set());
  progress=recordHandwritingRecognition(progress,'vel-0',{...result,force:true});
  const ocr=progress.writing['vel-0'].ocr;assert.equal(ocr.requests,3);assert.equal(ocr.correct,2);assert.equal(ocr.readings.length,2);
  assert.deepEqual(progress.items,{});assert.deepEqual(progress.session.sections,{});
});
