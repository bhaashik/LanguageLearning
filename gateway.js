import {validateEndpoint} from './audio-store.js';
import {defaultGateway,isPagesGateway} from './platform.js';

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
  try{response=await fetcher(url.href,{signal:request.signal,headers:{Accept:'application/json'}});}
  catch(error){if(signal?.aborted)throw error;if(request.expired())throw Error('The gateway did not respond within 12 seconds. Check its address and that the server is running.');throw Error('Could not reach the gateway. Check its HTTPS address, network access, and CORS permission for this app’s origin. A desktop localhost server is not reachable from this iPad or another device.');}
  if(!response.ok)throw Error(`Gateway returned HTTP ${response.status}. Check the gateway URL and access permissions. GitHub Pages cannot provide the API.`);
  let data;try{data=await response.json();}catch{throw Error('This address returned a web page or unreadable data instead of gateway JSON. Use the OCR, speech, or transcription API address.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('The gateway did not return a configuration object.');return data;
  }finally{request.cleanup();}
}
