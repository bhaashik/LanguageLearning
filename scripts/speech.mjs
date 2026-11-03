// Optional local companion. Never copied into the static Pages build.
import {OPENAI_MODELS,OPENAI_DEFAULT_MODEL,OPENAI_DEFAULT_VOICE,openAIVoices,isRealtimeModel,openAIVoice,MALAYALAM_READING_INSTRUCTIONS} from '../speech-presets.js';
import {generateRealtime} from '../gateway/openai-realtime.mjs';
export function speechConfig(env=process.env){
  const provider=env.BHAASA_TTS_PROVIDER||'openai';
  const ready=Boolean(env.BHAASA_TTS_API_KEY)||(provider==='custom'&&Boolean(env.BHAASA_TTS_URL));
  const models=(env.BHAASA_TTS_MODELS||env.BHAASA_TTS_MODEL||(provider==='openai'?OPENAI_DEFAULT_MODEL:provider==='elevenlabs'?'eleven_multilingual_v2':'')).split(',').map(s=>s.trim()).filter(Boolean);
  return {provider,ready,models,voice:env.BHAASA_TTS_VOICE||(provider==='openai'?OPENAI_DEFAULT_VOICE:'')};
}
export async function handleSpeech(req,res,url,{env=process.env,fetcher=fetch,realtime=generateRealtime}={}){
  if(!['/api/speech','/api/speech/models'].includes(url.pathname))return false;
  const origin=req.headers.origin;
  const allowed=env.BHAASA_TTS_ALLOWED_ORIGIN||url.origin;
  if(origin&&origin!==allowed){res.writeHead(403).end('Origin not allowed');return true;}
  const headers={'Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})};
  if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Accept'}).end();return true;}
  const cfg=speechConfig(env);
  if(req.method==='GET'&&url.pathname.endsWith('/models')){
    res.writeHead(200,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({configured:cfg.ready,provider:cfg.provider,setupRequired:!cfg.ready,models:cfg.ready?cfg.models.map(id=>({id,provider:cfg.provider,api:cfg.provider==='openai'?(isRealtimeModel(id)?'realtime':'speech'):undefined,retirement:OPENAI_MODELS.find(m=>m.id===id)?.retirement,voices:cfg.provider==='openai'?openAIVoices(id).map(voice=>({id:voice,name:voice,gender:'unspecified'})):cfg.voice?[{id:cfg.voice,name:cfg.voice,gender:'unspecified'}]:[]})):[]}));return true;
  }
  if(req.method!=='POST'||url.pathname!=='/api/speech'){res.writeHead(405,headers).end('Method not allowed');return true;}
  if(!cfg.ready){res.writeHead(503,headers).end('No speech provider configured');return true;}
  if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415,headers).end('Use application/json');return true;}
  try{
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536)throw Error('Request too large');chunks.push(c);}
    const data=JSON.parse(Buffer.concat(chunks).toString());
    if(typeof data.input!=='string'||!data.input.trim()||data.input.length>10000||!cfg.models.includes(data.model)||data.provider!==cfg.provider||typeof data.voice!=='string'||!data.voice||data.voice.length>200){res.writeHead(400,headers).end('Check input, configured model, provider, and voice');return true;}
    if(cfg.provider==='openai'&&data.input.length>4096){res.writeHead(400,headers).end('Choose a smaller item: OpenAI requests are limited to 4096 characters.');return true;}
    if(cfg.provider==='openai'&&isRealtimeModel(data.model)){
      const wav=await realtime({input:data.input,model:data.model,voice:data.voice,apiKey:env.BHAASA_TTS_API_KEY,signal:AbortSignal.timeout(40000)});
      res.writeHead(200,{...headers,'Content-Type':'audio/wav'}).end(wav);return true;
    }
    const remoteHeaders={'Content-Type':'application/json'};let endpoint,body;
    if(cfg.provider==='openai'){
      endpoint=env.BHAASA_TTS_URL||'https://api.openai.com/v1/audio/speech';remoteHeaders.Authorization=`Bearer ${env.BHAASA_TTS_API_KEY}`;
      body={model:data.model,input:data.input,voice:openAIVoice(data.voice),response_format:'mp3',speed:.85,...(data.model.startsWith('gpt-4o-mini-tts')?{instructions:MALAYALAM_READING_INSTRUCTIONS}:{})};
    }else if(cfg.provider==='elevenlabs'){
      endpoint=env.BHAASA_TTS_URL||`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(data.voice)}`;remoteHeaders['xi-api-key']=env.BHAASA_TTS_API_KEY;
      body={text:data.input,model_id:data.model};
    }else if(cfg.provider==='custom'){
      endpoint=env.BHAASA_TTS_URL;body={...data,response_format:'mp3'};if(env.BHAASA_TTS_API_KEY)remoteHeaders.Authorization=`Bearer ${env.BHAASA_TTS_API_KEY}`;
    }else{res.writeHead(400,headers).end('Unsupported provider');return true;}
    const remote=new URL(endpoint);
    if(remote.username||remote.password||!(remote.protocol==='https:'||(remote.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(remote.hostname))))throw Error('Use a secure configured provider URL');
    const result=await fetcher(remote,{method:'POST',headers:remoteHeaders,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(40000)});
    if(!result.ok){res.writeHead(result.status,{...headers,'Content-Type':'text/plain'}).end('Speech provider rejected the request. Check provider configuration.');return true;}
    const type=result.headers.get('content-type');if(!type?.startsWith('audio/'))throw Error('Provider did not return audio');
    if(Number(result.headers.get('content-length'))>20*1024*1024)throw Error('Audio exceeds file limit');
    const audio=await result.arrayBuffer();if(audio.byteLength>20*1024*1024)throw Error('Audio exceeds file limit');
    res.writeHead(200,{...headers,'Content-Type':type}).end(Buffer.from(audio));return true;
  }catch{res.writeHead(502,{...headers,'Content-Type':'text/plain'}).end('Speech request failed. Check the server-side provider configuration.');return true;}
}
