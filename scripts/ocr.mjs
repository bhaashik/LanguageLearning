import {ocrConfigurations,publicOCRConfig,ocrProviderRequest,parseOCRResult,ocrProviderFailure,listGeminiModels,OCRResultError} from './ocr-providers.mjs';
import {normalizeOCRModel,genericGeminiModel} from '../ocr-models.js';
import {originAllowed} from './origins.mjs';
export const ocrServerEnabled=(env=process.env)=>Object.values(ocrConfigurations(env)).some(c=>c.key||c.configured);
export async function handleOCR(req,res,url,{env=process.env,fetcher=fetch}={}){
  if(url.pathname!=='/api/ocr')return false;
  const origin=req.headers.origin,allowed=env.BHAASA_OCR_ALLOWED_ORIGIN||env.BHAASA_TTS_ALLOWED_ORIGIN||url.origin;
  if(!originAllowed(origin,allowed,url.origin)){res.writeHead(403).end('Origin not allowed');return true;}
  const headers={'Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})};
  const configurations=ocrConfigurations(env),requestedDefault=env.BHAASA_OCR_PROVIDER||'openai',defaultProvider=Object.hasOwn(configurations,requestedDefault)?requestedDefault:null;
  const defaultConfig=defaultProvider?configurations[defaultProvider]:null;
  if(req.method==='OPTIONS'){res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}).end();return true;}
  if(req.method==='GET'&&url.searchParams.get('action')==='models'){
    const jsonHeaders={...headers,'Content-Type':'application/json'},config=configurations.gemini;
    if(url.searchParams.get('provider')!=='gemini'){res.writeHead(400,jsonHeaders).end(JSON.stringify({error:'unsupported_model_discovery'}));return true;}
    if(!config.key){res.writeHead(503,jsonHeaders).end(JSON.stringify({error:'provider_not_configured',source:'gateway',provider:'gemini',missing:['credential']}));return true;}
    const cancellation=new AbortController(),cancel=()=>cancellation.abort();res.on?.('close',cancel);req.on?.('aborted',cancel);
    try{
      const {status,...result}=await listGeminiModels(config,{fetcher,signal:AbortSignal.any([AbortSignal.timeout(20000),cancellation.signal])});
      if(!res.destroyed)res.writeHead(status,jsonHeaders).end(JSON.stringify(result));
    }catch{if(!res.destroyed)res.writeHead(502,jsonHeaders).end(JSON.stringify({error:'model_discovery_failed'}));}
    finally{res.removeListener?.('close',cancel);req.removeListener?.('aborted',cancel);}
    return true;
  }
  if(req.method==='GET'){res.writeHead(200,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({configured:defaultConfig?.configured||false,provider:defaultProvider,model:defaultConfig?.model||null,expectedAnswerSent:false,providers:Object.values(configurations).map(publicOCRConfig)}));return true;}
  if(req.method!=='POST'){res.writeHead(405,headers).end();return true;}
  if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415,headers).end('Use application/json');return true;}
  const cancellation=new AbortController(),cancel=()=>cancellation.abort();res.on?.('close',cancel);req.on?.('aborted',cancel);
  try{
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2*1024*1024){res.writeHead(413,headers).end('Image too large');return true;}chunks.push(c);}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{res.writeHead(400,headers).end('Invalid JSON');return true;}
    if(!data||typeof data!=='object'||Object.keys(data).some(k=>!['image','provider','model'].includes(k))||typeof data.image!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data.image)||(data.model!==undefined&&(typeof data.model!=='string'||data.model.length>150))){res.writeHead(400,headers).end('Send a PNG drawing and optional provider/model; no expected answer');return true;}
    const provider=data.provider===undefined?defaultProvider:data.provider;
    if(typeof provider!=='string'||!Object.hasOwn(configurations,provider)){res.writeHead(400,headers).end('Unsupported OCR provider');return true;}
    const config=configurations[provider];
    if(!config.configured){res.writeHead(503,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({error:config.configurationError==='invalid_model_id'?'invalid_model_id':'provider_not_configured',source:'gateway',provider,missing:config.missing,configurationError:config.configurationError}));return true;}
    const model=normalizeOCRModel(provider,data.model||config.model);
    if(provider==='gemini'&&genericGeminiModel(model)){res.writeHead(400,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({error:'invalid_model_id',source:'gateway',provider}));return true;}
    if(model&&!config.models.includes(model)){res.writeHead(400,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({error:'model_not_allowed',source:'gateway',provider,model:config.model,models:config.models}));return true;}
    const bytes=Buffer.from(data.image.split(',')[1],'base64');
    if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)>1024||bytes.readUInt32BE(20)>1024||!bytes.readUInt32BE(16)||!bytes.readUInt32BE(20)){res.writeHead(400,headers).end('Invalid PNG dimensions');return true;}
    const request=ocrProviderRequest(config,data.image,model);
    const response=await fetcher(request.url,{method:'POST',headers:request.headers,signal:AbortSignal.any([AbortSignal.timeout(40000),cancellation.signal]),redirect:'error',body:JSON.stringify(request.body)});
    if(!response.ok){let body;try{body=await response.json();}catch{}res.writeHead(response.status,{...headers,'Content-Type':'application/json'}).end(JSON.stringify(ocrProviderFailure(provider,response.status,body)));return true;}
    let body;try{body=await response.json();}catch(error){if(error instanceof SyntaxError)throw new OCRResultError('recognition_invalid_json');throw error;}
    const result=parseOCRResult(provider,body);
    res.writeHead(200,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({...result,provider,model:model||null}));return true;
  }catch(error){
    const timedOut=['TimeoutError','AbortError'].includes(error?.name),networkCodes=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','ETIMEDOUT'];
    const code=error instanceof OCRResultError?error.code:timedOut?'ocr_timeout':networkCodes.includes(error?.cause?.code)?'ocr_connection_failed':'ocr_gateway_failed';
    if(!res.destroyed)res.writeHead(timedOut?504:502,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({error:code,source:'gateway'}));return true;
  }
  finally{res.removeListener?.('close',cancel);req.removeListener?.('aborted',cancel);}
}
