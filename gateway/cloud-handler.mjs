import {Readable} from 'node:stream';
import {timingSafeEqual} from 'node:crypto';
import {handleOCR} from '../scripts/ocr.mjs';
import {handleSpeech} from '../scripts/speech.mjs';
import {handleTranscription} from '../scripts/transcribe.mjs';

const routes=new Map([
  ['/api/ocr',handleOCR],['/api/speech',handleSpeech],
  ['/api/speech/models',handleSpeech],['/api/transcribe',handleTranscription]
]);
const limits={'/api/ocr':2*1024*1024,'/api/speech':65536,'/api/transcribe':14*1024*1024};
const tokenPattern=/^[A-Za-z0-9_-]{32,256}$/;

// Explicitly bind the same project key to three independent Gemini adapters.
// Do not inherit unrelated local provider credentials into this cloud function.
export function geminiEnvironment({apiKey,origins,ocrModel,asrModel,ttsModel,voice}){
  return {
    BHAASA_OCR_PROVIDER:'gemini',BHAASA_OCR_GEMINI_API_KEY:apiKey,
    BHAASA_OCR_GEMINI_MODEL:ocrModel,BHAASA_OCR_ALLOWED_ORIGIN:origins,
    BHAASA_ASR_GEMINI_API_KEY:apiKey,BHAASA_ASR_GEMINI_MODEL:asrModel,
    BHAASA_ASR_ALLOWED_ORIGIN:origins,
    BHAASA_TTS_PROVIDER:'gemini',BHAASA_TTS_API_KEY:apiKey,
    BHAASA_TTS_MODELS:ttsModel,BHAASA_TTS_VOICE:voice,BHAASA_TTS_ALLOWED_ORIGIN:origins
  };
}

export function createCloudGateway({env,accessToken,fetcher=fetch}){
  return async(req,res)=>{
    const origin=req.headers.origin,allowed=(env.BHAASA_TTS_ALLOWED_ORIGIN||'').split(',').map(s=>s.trim()).filter(Boolean);
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin'};
    const reply=(status,error)=>res.writeHead(status,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({error,source:'gateway'}));
    if(origin&&!allowed.includes(origin)){reply(403,'origin_not_allowed');return;}
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    const url=new URL(req.url,'https://gateway.invalid');
    // Support both Functions URLs and their underlying Cloud Run URL.
    if(url.pathname.startsWith('/bhaasaApi/'))url.pathname=url.pathname.slice('/bhaasaApi'.length);
    const handler=routes.get(url.pathname);
    if(!handler){reply(404,'route_not_found');return;}
    if(!['GET','POST','OPTIONS'].includes(req.method)){reply(405,'method_not_allowed');return;}
    // Browsers send no token on CORS preflights. Authentication applies to the
    // actual request, including model discovery, even without an Origin header.
    if(req.method==='OPTIONS'){
      res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type, Accept, X-Bhaasa-Gateway-Token','Access-Control-Max-Age':'600'}).end();return;
    }
    if(!tokenPattern.test(accessToken||'')||accessToken===env.BHAASA_TTS_API_KEY){reply(503,'gateway_access_not_configured');return;}
    const supplied=req.headers['x-bhaasa-gateway-token'];
    if(typeof supplied!=='string'||!tokenPattern.test(supplied)||supplied.length!==accessToken.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(accessToken))){reply(401,'gateway_access_required');return;}
    if(!env.BHAASA_TTS_API_KEY){reply(503,'provider_not_configured');return;}
    if(req.method==='POST'&&!(req.headers['content-type']||'').startsWith('application/json')){reply(415,'json_required');return;}
    const limit=limits[url.pathname]||65536;
    // Firebase's Functions Framework already consumes the incoming stream.
    // Replay its raw bytes, rather than JSON.stringify(req.body), so limits and
    // adapter validation have the same behavior as the desktop/local gateway.
    const raw=req.rawBody;
    if(req.method==='POST'&&(!Buffer.isBuffer(raw)||raw.length>limit)){reply(Buffer.isBuffer(raw)?413:400,'invalid_request_body');return;}
    const body=Readable.from(req.method==='POST'?[raw]:[]);
    body.headers=req.headers;body.method=req.method;
    const aborted=()=>body.emit('aborted');req.on?.('aborted',aborted);
    for(const [name,value] of Object.entries(headers))res.setHeader(name,value);
    try{await handler(body,res,url,{env,fetcher});}
    catch{if(!res.headersSent)reply(502,'gateway_failed');else res.end();}
    finally{req.removeListener?.('aborted',aborted);body.destroy();}
  };
}
