import {firebaseClient,FIREBASE_MODELS} from './firebase-client.js';
import {defaultGateway} from './platform.js';
import {validateEndpoint} from './audio-store.js';
import {restoreGateway,requestTimeout,gatewayHeaders} from './gateway.js';
export const ASR_PROVIDERS=[['browser','Device/browser recognition'],['openai','OpenAI transcription'],['gemini','Google Gemini audio · gateway'],['firebase','Firebase AI Logic · direct Gemini'],['compatible','Local / Whisper-compatible'],['custom','Custom ASR adapter']];
export function loadASRSettings(language){
  const settings={provider:(globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition)?'browser':'openai',profiles:Object.fromEntries(ASR_PROVIDERS.map(([id])=>[id,{endpoint:['browser','firebase'].includes(id)?'':defaultGateway('transcribe'),model:id==='firebase'?FIREBASE_MODELS.asr:''}]))};
  try{const saved=JSON.parse(localStorage.getItem(`bhaasa.asr.${language}.v1`));if(ASR_PROVIDERS.some(([id])=>id===saved?.provider))settings.provider=saved.provider;for(const [id] of ASR_PROVIDERS){const p=saved?.profiles?.[id];if(p&&typeof p.endpoint==='string'&&p.endpoint.length<=1000&&typeof p.model==='string'&&p.model.length<=150)settings.profiles[id]={endpoint:['browser','firebase'].includes(id)?'':restoreGateway(p.endpoint,'transcribe'),model:p.model};}}catch{}
  return settings;
}
export function saveASRSettings(language,value){try{localStorage.setItem(`bhaasa.asr.${language}.v1`,JSON.stringify(value));return true;}catch{return false;}}
const dataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The recording could not be read.'));reader.readAsDataURL(blob);});
export async function transcribeAudio(blob,{provider,endpoint,model},language,signal){
  if(!blob.size||blob.size>10*1024*1024||!blob.type.startsWith('audio/'))throw Error('Use a nonempty audio recording under 10 MB.');
  if(provider==='firebase')return firebaseClient.transcribe(blob,{model,language,signal});
  const address=validateEndpoint(endpoint),body=JSON.stringify({audio:await dataURL(blob),language,provider,...(model.trim()?{model:model.trim()}:{})}),request=requestTimeout(signal,65000);
  try{
  const response=await fetch(address,{method:'POST',headers:gatewayHeaders(address,{'Content-Type':'application/json'}),redirect:'error',body,signal:request.signal});
  if(response.status===401)throw Error('Save the gateway access token in Connections & models, then try again.');
  let data;try{data=await response.json();}catch{throw Error(`ASR gateway returned HTTP ${response.status} without a readable result.`);}
  if(!response.ok){const messages={asr_not_configured:'This ASR provider is not configured on the gateway. Add its BHAASA_ASR settings and restart the server.',model_not_allowed:`This model is not on the gateway allowlist. Enabled: ${(data.models||[]).join(', ')}. Leave Model ID blank to use its default.`,asr_quota_exceeded:'The ASR provider reports a quota or rate limit.',asr_access_denied:'The ASR provider rejected access. Check its server-side key and permissions.',asr_provider_unavailable:'The ASR provider is temporarily unavailable. Retry explicitly when ready.',asr_provider_rejected:'The ASR provider rejected this model or audio request. Check audio input and transcription support.',asr_invalid_response:'The provider responded, but its transcript format was invalid. No attempt was scored.',asr_incomplete_response:'The provider did not complete a transcript. No attempt was scored.',asr_timeout:'Transcription timed out. No attempt was scored.',asr_connection_failed:'The gateway could not complete transcription. Check its network connection and provider configuration.',invalid_audio:'This audio format could not be validated. Record again or import WAV, MP3, WebM, MP4/M4A, or Ogg audio.'};throw Error(messages[data.error]||`ASR returned HTTP ${response.status}. Check the gateway and provider.`);}
  if(typeof data.text!=='string'||data.text.length>2000)throw Error('ASR returned an invalid transcript. No attempt was scored.');return data;
  }finally{request.cleanup();}
}
