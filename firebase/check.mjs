import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const tokenPattern=/^[A-Za-z0-9_-]{32,256}$/;
const paths={ocr:'/api/ocr',tts:'/api/speech/models',asr:'/api/transcribe'};

// Metadata checks never generate content. Generation requires an explicit flag.
// The gateway token is supplied through the environment, never a URL/CLI flag.
export async function checkGateway({base,token,origin='https://bhaashik.github.io',generate=false,image,audio,language='ml',fetcher=fetch}){
  const url=new URL(base);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Use an HTTPS gateway base, or HTTP loopback, without credentials, a query, or a fragment.');
  if(/\/api\/(ocr|speech|transcribe)(?:\/models)?\/?$/.test(url.pathname))throw Error('Use the gateway base without an /api/… suffix.');
  if(!tokenPattern.test(token||''))throw Error('Set BHAASA_GATEWAY_TOKEN to the separate gateway access token; do not use the Gemini API key.');
  if(new URL(origin).origin!==origin)throw Error('Use an exact browser origin with scheme, host and optional port, without a path.');
  if(!['ml','fr'].includes(language))throw Error('Choose language ml or fr.');
  base=url.href.replace(/\/$/,'');
  const checks=[],configs={},results={};
  const record=async(name,action)=>{
    try{const detail=await action();checks.push({name,passed:true,...detail});}
    catch(error){checks.push({name,passed:false,error:error.message});}
  };
  async function request(path,body){
    let response;
    try{response=await fetcher(base+path,{method:body?'POST':'GET',headers:{Origin:origin,Accept:'application/json','X-Bhaasa-Gateway-Token':token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(90000)});}
    catch{throw Error('Gateway request failed or timed out. Check its URL, network access and deployment.');}
    if(!response.ok){let code='';try{const data=await response.json();if(/^[a-z_]{1,80}$/.test(data.error))code=` (${data.error})`;}catch{}throw Error(`Gateway returned HTTP ${response.status}${code}.`);}
    if(response.headers.get('access-control-allow-origin')!==origin)throw Error('The response does not allow this browser origin. Update BHAASA_ALLOWED_ORIGINS and redeploy.');
    return response;
  }
  await Promise.all(Object.entries(paths).map(([kind,path])=>record(`${kind} configuration`,async()=>{
    const response=await request(path);let data;
    try{data=await response.json();}catch{throw Error('The endpoint returned unreadable JSON or a web page.');}
    const provider=kind==='tts'?data:(data.providers||[]).find(p=>p.id==='gemini'||p.provider==='gemini');
    if(!provider||kind==='tts'&&provider.provider!=='gemini'||!provider.configured)throw Error('Gemini is not configured for this service.');
    const models=(provider.models||[]).map(m=>typeof m==='string'?m:m.id);
    const model=provider.model||models[0],voice=kind==='tts'?provider.models?.find(m=>m.id===model)?.voices?.[0]?.id:undefined;
    if(typeof model!=='string'||!models.includes(model)||kind==='tts'&&!voice)throw Error('The gateway did not report a configured model/voice.');
    configs[kind]={model,...(voice?{voice}:{})};return {provider:'gemini',...configs[kind]};
  })));
  for(const [kind,path] of Object.entries({ocr:'/api/ocr',tts:'/api/speech',asr:'/api/transcribe'}))await record(`${kind} browser preflight`,async()=>{
    const response=await fetcher(base+path,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-bhaasa-gateway-token'},redirect:'error',signal:AbortSignal.timeout(15000)});
    const headers=(response.headers.get('access-control-allow-headers')||'').toLowerCase().split(',').map(s=>s.trim());
    if(!response.ok||response.headers.get('access-control-allow-origin')!==origin||!headers.includes('content-type')||!headers.includes('x-bhaasa-gateway-token')||!(response.headers.get('access-control-allow-methods')||'').split(',').map(s=>s.trim()).includes('POST'))throw Error('The browser preflight does not permit authenticated generation for this origin.');
    return {};
  });
  await Promise.all(Object.entries(paths).map(([kind,path])=>record(`${kind} authentication`,async()=>{
    const response=await fetcher(base+path,{headers:{Origin:origin},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(response.status!==401)throw Error(`Unauthenticated metadata returned HTTP ${response.status}; expected HTTP 401.`);
    return {};
  })));
  if(generate&&configs.tts)await record('tts generation',async()=>{
    const input=language==='fr'?'Bonjour.':'നമസ്കാരം';
    const response=await request('/api/speech',{provider:'gemini',...configs.tts,language:language==='fr'?'fr-FR':'ml-IN',input});
    if(!response.headers.get('content-type')?.startsWith('audio/'))throw Error('Speech did not return audio.');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<44||bytes.length>10*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('Gemini speech did not return a bounded WAV recording.');
    results.speech={bytes,mime:'audio/wav'};return {bytes:bytes.length,model:configs.tts.model,voice:configs.tts.voice};
  });
  const recording=audio||results.speech;
  if((generate||audio)&&configs.asr)await record('asr generation',async()=>{
    if(!recording||!recording.bytes?.length)throw Error('No audio is available. Speech generation must succeed, or supply --audio.');
    const response=await request('/api/transcribe',{provider:'gemini',model:configs.asr.model,language,audio:`data:${recording.mime};base64,${recording.bytes.toString('base64')}`});
    const data=await response.json();if(typeof data.text!=='string'||!data.text.trim()||data.text.length>2000)throw Error('ASR returned no usable transcript.');
    return {model:configs.asr.model,transcript:data.text};
  });
  if(image&&configs.ocr)await record('ocr generation',async()=>{
    const response=await request('/api/ocr',{provider:'gemini',model:configs.ocr.model,image:`data:image/png;base64,${image.toString('base64')}`});
    const data=await response.json();
    if(typeof data.legible!=='boolean'||data.legible&&(typeof data.text!=='string'||!data.text.trim())||!data.legible&&data.text!==null)throw Error('OCR returned an invalid recognition result.');
    return {model:configs.ocr.model,text:data.text,legible:data.legible};
  });
  return {base,origin,checks,passed:checks.every(c=>c.passed),generation:{tts:checks.some(c=>c.name==='tts generation'&&c.passed),asr:checks.some(c=>c.name==='asr generation'&&c.passed),ocr:checks.some(c=>c.name==='ocr generation'&&c.passed)},note:'Configuration checks do not test Gemini authorization, quota or generation. Returned OCR/ASR text needs human review; successful transcription is not a pronunciation grade.'};
}

async function main(){
  const args=process.argv.slice(2),options={token:process.env.BHAASA_GATEWAY_TOKEN,base:process.env.BHAASA_GATEWAY_BASE};
  for(let i=0;i<args.length;i++){
    const flag=args[i];
    if(flag==='--help'){console.log('node firebase/check.mjs --base HTTPS_GATEWAY [--origin BROWSER_ORIGIN] [--generate] [--audio FILE] [--image PNG] [--language ml|fr]\nSet BHAASA_GATEWAY_TOKEN privately. Default: metadata and CORS only. --generate makes one TTS request and transcribes its audio. --image makes one OCR request.');return;}
    if(flag==='--generate'){options.generate=true;continue;}
    if(!['--base','--origin','--audio','--image','--language'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown option or missing value. Use --help.');
    options[flag.slice(2)]=args[++i];
  }
  if(options.image){options.image=await readFile(options.image);if(options.image.length<24||options.image.length>1400000||!options.image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Use a PNG drawing under 1.4 MB.');}
  if(options.audio){const file=options.audio,mime=({wav:'audio/wav',mp3:'audio/mpeg',webm:'audio/webm',ogg:'audio/ogg',m4a:'audio/mp4',mp4:'audio/mp4'})[file.split('.').pop().toLowerCase()];const bytes=await readFile(file);if(!mime||!bytes.length||bytes.length>10*1024*1024)throw Error('Use WAV, MP3, WebM, Ogg or MP4/M4A audio under 10 MB.');options.audio={bytes,mime};}
  if(!options.base)throw Error('Supply --base with your deployed gateway URL.');
  const report=await checkGateway(options);
  console.log(JSON.stringify(report,null,2).replaceAll(options.token,'[redacted]'));
  if(!report.passed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Gateway check failed. Verify its base URL, BHAASA_GATEWAY_TOKEN, input files and options (--help). No credential values are logged.');process.exitCode=1;});
