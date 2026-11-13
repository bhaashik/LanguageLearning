import test from 'node:test';
import assert from 'node:assert/strict';
import {saveGatewayConnection,gatewayConnection,gatewayHeaders,clearGatewayAccess} from '../gateway.js';
import {gatewayServiceSettings,forgetGatewayEndpoints} from '../connection-discovery.js';

const key='bhaasa.gateway.access.v1',token='fixture_gateway_access_'.padEnd(64,'x');
function storage(){const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};}
async function withStorage(action){
  const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage;
  const local=storage(),session=storage();globalThis.localStorage=local;globalThis.sessionStorage=session;clearGatewayAccess();
  try{await action(local,session);}finally{clearGatewayAccess();if(oldLocal===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldLocal;if(oldSession===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldSession;}
}
test('gateway access persists on the device only after explicit opt-in and survives a module restart',async()=>{
  await withStorage(async(local,session)=>{
    const base='https://fixture.example/bhaasaApi';
    saveGatewayConnection(base,token);assert.ok(session.getItem(key));assert.equal(local.getItem(key),null);assert.equal(gatewayConnection().remember,false);
    saveGatewayConnection(base,'',{remember:true});assert.equal(session.getItem(key),null);assert.ok(local.getItem(key));
    const fresh=await import('../gateway.js?remember-fixture');
    assert.equal(fresh.gatewayConnection().remember,true);assert.equal(fresh.gatewayHeaders(base+'/api/ocr')['X-Bhaasa-Gateway-Token'],token);
    assert.ok(!JSON.stringify(fresh.gatewayConnection()).includes(token));assert.ok(fresh.gatewayConnection().savedAt>0);
    saveGatewayConnection(base,'',{remember:false});assert.equal(local.getItem(key),null);assert.ok(session.getItem(key));
    saveGatewayConnection('https://different.example','');assert.deepEqual(gatewayHeaders('https://different.example/api/ocr'),{});assert.deepEqual(gatewayHeaders(base+'/api/ocr'),{});
  });
});
test('failed persistence does not claim success or replace a working connection',async()=>{
  await withStorage(async(local,session)=>{
    const base='https://old.example';saveGatewayConnection(base,token);
    const write=local.setItem;local.setItem=()=>{throw Error('fixture quota');};
    assert.throws(()=>saveGatewayConnection('https://new.example',token,{remember:true}),/could not remember/);
    assert.equal(gatewayConnection().base,base);assert.equal(local.getItem(key),null);assert.ok(session.getItem(key));local.setItem=write;
    const remove=session.removeItem;session.removeItem=()=>{throw Error('fixture blocked');};
    assert.throws(()=>saveGatewayConnection(base,token,{remember:true}),/could not remember/);assert.equal(local.getItem(key),null);session.removeItem=remove;
    assert.equal(clearGatewayAccess(),true);assert.equal(session.getItem(key),null);assert.equal(local.getItem(key),null);
  });
});
test('legacy session access is restored without silently promoting it to device storage',async()=>{
  await withStorage(async(local,session)=>{
    const base='https://legacy.example/bhaasaApi';session.setItem(key,JSON.stringify({base,token}));
    const fresh=await import('../gateway.js?legacy-fixture');
    assert.equal(fresh.gatewayConnection().remember,false);assert.equal(fresh.gatewayHeaders(base+'/api/ocr')['X-Bhaasa-Gateway-Token'],token);
    fresh.saveGatewayConnection(base,'');assert.equal(local.getItem(key),null);assert.ok(session.getItem(key));
  });
});
test('discovery selects configured Gemini over cold defaults and preserves working models and voices',()=>{
  const endpoint='https://fixture.example/api/ocr';
  const data={provider:'gemini',providers:[{id:'openai',configured:false,models:[]},{id:'gemini',configured:true,model:'vision-a',models:['vision-a','vision-b']}]};
  assert.equal(gatewayServiceSettings('ocr',data,{endpoint,current:{provider:'openai',endpoint,model:'',preserve:false}}).provider,'gemini');
  assert.equal(gatewayServiceSettings('ocr',data,{endpoint,current:{provider:'gemini',endpoint,model:'vision-b',preserve:true}}).model,'vision-b');
  const speech={provider:'gemini',configured:true,models:[{id:'tts-a',voices:['Kore']},{id:'tts-b',voices:['Aoede','Kore']}]};
  const selected=gatewayServiceSettings('tts',speech,{endpoint:'https://fixture.example/api/speech',profiles:{gemini:{endpoint:'https://fixture.example/api/speech',model:'tts-b',voice:'Aoede'}}});
  assert.equal(selected.model,'tts-b');assert.equal(selected.voice,'Aoede');
  const other=gatewayServiceSettings('tts',speech,{endpoint:'https://new.example/api/speech',profiles:{gemini:{endpoint:'https://fixture.example/api/speech',model:'tts-b',voice:'Aoede'}}});
  assert.equal(other.model,'tts-a');assert.equal(other.voice,'Kore');
});
test('missing providers or speech voices produce per-service errors instead of invented settings',()=>{
  assert.throws(()=>gatewayServiceSettings('asr',{providers:[{id:'gemini',configured:false}]},{endpoint:'https://fixture.example/api/transcribe'}),/configured ASR/);
  assert.throws(()=>gatewayServiceSettings('tts',{provider:'gemini',configured:true,models:['tts-a']},{endpoint:'https://fixture.example/api/speech'}),/voice/);
  const custom=gatewayServiceSettings('ocr',{providers:[{id:'custom',configured:true}]},{endpoint:'https://fixture.example/api/ocr'});assert.equal(custom.provider,'custom');assert.equal(custom.model,'');
});
test('forget clears only this gateway’s endpoints across languages, preserving learning and voice identities',()=>{
  const values=storage(),base='https://fixture.example';
  values.setItem('bhaasa.ocr.preferences.v1',JSON.stringify({provider:'gemini',profiles:{gemini:{endpoint:base+'/api/ocr',model:'vision'},openai:{endpoint:'https://other.example/api/ocr',model:'other'}}}));
  values.setItem('bhaasa.ocr.gateway',base+'/api/ocr');
  for(const language of ['ml','fr']){
    values.setItem(`bhaasa.asr.${language}.v1`,JSON.stringify({provider:'gemini',profiles:{gemini:{endpoint:base+'/api/transcribe',model:'asr'}}}));
    values.setItem(language==='ml'?'bhaasa.voices.v1':`bhaasa.voices.${language}.v1`,JSON.stringify({activeId:'my-profile',profiles:[{id:'my-profile',provider:'gemini',endpoint:base+'/api/speech',model:'tts',voice:'Kore'}]}));
  }
  values.setItem('bhaasa.progress.v2','progress-fixture');forgetGatewayEndpoints(base,values);
  const ocr=JSON.parse(values.getItem('bhaasa.ocr.preferences.v1'));assert.equal(ocr.profiles.gemini.endpoint,'');assert.equal(ocr.profiles.gemini.model,'vision');assert.equal(ocr.profiles.openai.endpoint,'https://other.example/api/ocr');assert.equal(values.getItem('bhaasa.ocr.gateway'),null);
  for(const language of ['ml','fr']){const audio=JSON.parse(values.getItem(language==='ml'?'bhaasa.voices.v1':`bhaasa.voices.${language}.v1`));assert.equal(audio.activeId,'my-profile');assert.equal(audio.profiles[0].voice,'Kore');assert.equal(audio.profiles[0].endpoint,'');assert.equal(JSON.parse(values.getItem(`bhaasa.asr.${language}.v1`)).profiles.gemini.model,'asr');}
  assert.equal(values.getItem('bhaasa.progress.v2'),'progress-fixture');
});
