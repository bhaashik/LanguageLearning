import {validateEndpoint} from './audio-store.js';
import {defaultGateway,isPagesGateway} from './platform.js';

const ACCESS_STORAGE='bhaasa.gateway.access.v1';
let access;
function readAccess(){
  if(access!==undefined)return access;
  try{const saved=JSON.parse(globalThis.sessionStorage?.getItem(ACCESS_STORAGE)||'null');if(saved&&typeof saved.base==='string'&&/^[A-Za-z0-9_-]{32,256}$/.test(saved.token))return access={base:validateEndpoint(saved.base),token:saved.token};}catch{}
  return access=null;
}
export function gatewayAccess(){const saved=readAccess();return {base:saved?.base||'',configured:Boolean(saved)};}
export function setGatewayAccess(base,token){
  const address=validateEndpoint(base),url=new URL(address);
  if(/\/api\/(ocr|speech|transcribe)(?:\/models)?$/.test(url.pathname))throw Error('Use the gateway base URL, without an /api/… suffix.');
  if(!/^[A-Za-z0-9_-]{32,256}$/.test(token))throw Error('Enter the separate gateway access token (32–256 letters, digits, underscores or hyphens). Keep the Gemini API key on Firebase.');
  access={base:address,token};
  try{if(!globalThis.sessionStorage)return false;globalThis.sessionStorage.setItem(ACCESS_STORAGE,JSON.stringify(access));return true;}catch{return false;}
}
export function clearGatewayAccess(){access=null;try{globalThis.sessionStorage?.removeItem(ACCESS_STORAGE);return true;}catch{return false;}}
// A test gateway token belongs to one exact gateway base and its API routes.
// Never send it to a different host, another function, or an arbitrary URL.
export function gatewayHeaders(endpoint,headers={}){
  const saved=readAccess();if(!saved)return {...headers};
  const url=new URL(endpoint),base=new URL(saved.base),prefix=base.pathname.replace(/\/$/,'');
  const paths=['/api/ocr','/api/speech','/api/speech/models','/api/transcribe'];
  return {...headers,...(url.origin===base.origin&&paths.some(path=>url.pathname===prefix+path)?{'X-Bhaasa-Gateway-Token':saved.token}:{})};
}

export function restoreGateway(value,service){
  if(typeof value!=='string')return defaultGateway(service);
  if(!value.trim()||isPagesGateway(value))return '';
  try{return validateEndpoint(value);}catch{return '';}
}
// AbortSignal.any is absent on older iPadOS versions supported by the app.
export function requestTimeout(signal,milliseconds){
  const controller=new AbortController();let expired=false;
  const abort=()=>controller.abort();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>{expired=true;controller.abort();},milliseconds);
  return {signal:controller.signal,expired:()=>expired,cleanup:()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
}
export async function gatewayJSON(endpoint,{models=false,signal,fetcher=globalThis.fetch}={}){
  const address=validateEndpoint(endpoint),url=new URL(address);
  if(models&&!url.pathname.endsWith('/models'))url.pathname=url.pathname.replace(/\/$/,'')+'/models';
  const request=requestTimeout(signal,12000);
  try{
  let response;
  try{response=await fetcher(url.href,{signal:request.signal,headers:gatewayHeaders(url.href,{Accept:'application/json'}),redirect:'error'});}
  catch(error){if(signal?.aborted)throw error;if(request.expired())throw Error('The gateway did not respond within 12 seconds. Check its address and that the server is running.');throw Error('Could not reach the gateway. Check its HTTPS address, network access, and CORS permission for this app’s origin. A desktop localhost server is not reachable from this iPad or another device.');}
  if(response.status===401)throw Error('Gateway access was refused. Save its separate access token in Connections & models; keep provider API keys on the server.');
  if(!response.ok)throw Error(`Gateway returned HTTP ${response.status}. Check the gateway URL and access permissions. GitHub Pages cannot provide the API.`);
  let data;try{data=await response.json();}catch{throw Error('This address returned a web page or unreadable data instead of gateway JSON. Use the OCR, speech, or transcription API address.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('The gateway did not return a configuration object.');return data;
  }finally{request.cleanup();}
}
