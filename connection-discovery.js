const supported={ocr:['gemini','openai','anthropic','compatible','custom'],tts:['gemini','openai','elevenlabs','custom','local'],asr:['gemini','openai','compatible','custom']};
export function gatewayModels(value){return (Array.isArray(value)?value:[]).slice(0,100).map(m=>typeof m==='string'?{id:m}:m).filter(m=>m&&typeof m.id==='string'&&m.id.trim()&&m.id.length<=150).map(m=>({id:m.id,voices:(Array.isArray(m.voices)?m.voices:[]).slice(0,100).map(v=>typeof v==='string'?{id:v}:v).filter(v=>v&&typeof v.id==='string'&&v.id.trim()&&v.id.length<=190).map(v=>({id:v.id,name:typeof v.name==='string'?v.name.slice(0,200):v.id}))}));}

// A reported configuration is not proof of model access, quota or generation.
// Retain valid choices only when they belong to the exact same service endpoint.
export function gatewayServiceSettings(kind,data,{endpoint,current={},profiles={}}){
  const candidates=kind==='tts'?[data]:(Array.isArray(data.providers)?data.providers:[data]);
  const ready=candidates.filter(p=>p&&supported[kind].includes(p.id||p.provider)&&p.configured===true&&p.setupRequired!==true);
  const existing=ready.find(p=>(p.id||p.provider)===current.provider&&current.preserve&&current.endpoint===endpoint);
  const selected=existing||ready.find(p=>(p.id||p.provider)===data.provider)||ready[0];
  if(!selected)throw Error(`The gateway did not report a configured ${kind.toUpperCase()} provider. Check its server setup or use Advanced.`);
  const provider=selected.id||selected.provider,models=gatewayModels(selected.models||[selected.model].filter(Boolean));
  const saved=existing?current:profiles[provider]?.endpoint===endpoint?profiles[provider]:{};
  const model=models.some(m=>m.id===saved.model)?saved.model:models.some(m=>m.id===selected.model)?selected.model:models[0]?.id||'';
  if(!model&&!(provider==='custom'&&kind!=='tts'))throw Error(`The gateway did not report an enabled ${kind.toUpperCase()} model.`);
  let voice='';
  if(kind==='tts'){
    const voices=models.find(m=>m.id===model)?.voices||[];
    voice=saved.voice&&(!voices.length||voices.some(v=>v.id===saved.voice))?saved.voice:voices[0]?.id||'';
    if(!voice)throw Error('The speech gateway did not report a voice. Select its exact voice ID under Advanced.');
  }
  return {provider,endpoint,model,voice,models};
}

// Forget the gateway address without removing models, voices, profile identities
// or learning data. Apply this to both languages, including inactive profiles.
export function forgetGatewayEndpoints(base,storage=globalThis.localStorage){
  const endpoints=new Set(['/api/ocr','/api/speech','/api/transcribe'].map(p=>base+p));
  const keys=['bhaasa.ocr.preferences.v1','bhaasa.asr.ml.v1','bhaasa.asr.fr.v1','bhaasa.voices.v1','bhaasa.voices.fr.v1'];
  if(endpoints.has(storage?.getItem('bhaasa.ocr.gateway')))storage.removeItem('bhaasa.ocr.gateway');
  for(const key of keys){
    const raw=storage?.getItem(key);let data;try{data=JSON.parse(raw||'null');}catch{continue;}
    if(!data||typeof data!=='object')continue;
    const profiles=Array.isArray(data.profiles)?data.profiles:Object.values(data.profiles||{});let changed=false;
    for(const p of profiles)if(p&&endpoints.has(p.endpoint)){p.endpoint='';changed=true;}
    if(changed)storage.setItem(key,JSON.stringify(data));
  }
}
