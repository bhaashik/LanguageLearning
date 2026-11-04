import {validateEndpoint} from './audio-store.js';
export const OCR_PROVIDERS=[
  {id:'openai',label:'OpenAI'},
  {id:'gemini',label:'Google Gemini'},
  {id:'anthropic',label:'Anthropic Claude'},
  {id:'compatible',label:'Local / OpenAI-compatible vision model'},
  {id:'custom',label:'Custom OCR endpoint'},
  {id:'none',label:'Off · tracing only'}
];
const KEY='bhaasa.ocr.preferences.v1';
const defaultEndpoint=()=>new URL('./api/ocr',globalThis.location?.href||'http://localhost:4173/').href;
export function loadOCRSettings(){
  const settings={provider:'openai',profiles:{}};
  for(const p of OCR_PROVIDERS)settings.profiles[p.id]={model:'',endpoint:p.id==='custom'?'':defaultEndpoint()};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved&&OCR_PROVIDERS.some(p=>p.id===saved.provider))settings.provider=saved.provider;
    for(const p of OCR_PROVIDERS){const value=saved?.profiles?.[p.id];if(!value)continue;
      const endpoint=value.endpoint?validateEndpoint(value.endpoint):'';
      settings.profiles[p.id]={endpoint:endpoint||(p.id==='custom'?'':defaultEndpoint()),model:typeof value.model==='string'?value.model.slice(0,150):''};
    }
    if(!saved){const old=localStorage.getItem('bhaasa.ocr.gateway');if(old)settings.profiles.openai.endpoint=validateEndpoint(old);}
  }catch{/* Keep safe defaults; a malformed saved preference must not block drawing. */}
  return settings;
}
export function saveOCRSettings(settings){try{localStorage.setItem(KEY,JSON.stringify(settings));return true;}catch{return false;}}
export function ocrSelection(settings){return {provider:settings.provider,...settings.profiles[settings.provider]};}
export const ocrRecognitionKey=config=>JSON.stringify([config.provider,config.endpoint,config.model||'gateway-default']);
export function recognitionPayload(image,config){if(config.provider==='none')throw Error('Handwriting recognition is off.');return config.provider==='custom'?{image}:{image,provider:config.provider,...(config.model?{model:config.model}:{})};}
export const providerLabel=id=>OCR_PROVIDERS.find(p=>p.id===id)?.label||id;
