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
export const normalizeOCRModel=(provider,model)=>provider==='gemini'?model.trim().replace(/^models\//,''):model.trim();
export const genericGeminiModel=model=>/^(google\s+)?gemini$/i.test(model);
export function ocrErrorMessage(status,body,provider){
  const label=providerLabel(provider),messages={
    provider_not_configured:'The selected OCR provider is not configured on this gateway. Use Check OCR connection and update the local .env.local file.',
    invalid_model_id:'“Gemini” is a provider name, not an API model ID. Set BHAASA_OCR_GEMINI_MODEL to the exact image-capable model ID from AI Studio, restart the server, and leave the optional Model field blank.',
    invalid_credentials:`${label} rejected the API key. Check the provider-specific API key in .env.local and restart the server.${provider==='gemini'?' OAuth client IDs and client secrets are not Gemini API keys.':''}`,
    credential_restricted:`${label} rejected the API key’s restrictions. This app sends requests from its server; review the key’s API and application restrictions.`,
    api_disabled:`${label} reports that the API is disabled for this project. Enable the API for the project associated with this key.`,
    model_discovery_failed:'The Gemini model list could not be retrieved. Check your internet connection and retry. Your model settings and drawing are kept.',
    provider_access_denied:`${label} denied access. Check API permissions, key restrictions, and model access for this project.`,
    provider_model_unavailable:`${label} could not find or access that model. Use an exact image-capable API model ID available to your project, update .env.local, and restart the server.`,
    provider_quota_exceeded:`${label} reports an exhausted quota or rate limit. Check this model’s free-tier/project quota and retry when available.`,
    provider_region_unavailable:`${label} reports that this service or free tier is unavailable in the request’s region. Check your project’s regional availability.`,
    provider_request_invalid:`${label} rejected the recognition request (HTTP ${status}). Check that the exact API model ID supports image input and JSON output. This error came from the provider, not the local model allowlist.`,
    provider_unavailable:`${label} is temporarily unavailable (HTTP ${status}). Try again later.`,
    provider_rejected:`${label} rejected the request (HTTP ${status}). Check API access and the selected model.`
  };
  if(body?.error==='model_not_allowed'){
    const models=Array.isArray(body.models)?body.models.filter(m=>typeof m==='string'&&m.length<=150).slice(0,30):[];
    return `The Model field does not match this Bhaasa server’s enabled models.${models.length?` Enabled models: ${models.join(', ')}.`:''} Clear the optional Model field to use the server default, or choose a listed model. No provider request was made.`;
  }
  if(typeof body?.error==='string'&&Object.hasOwn(messages,body.error))return messages[body.error];
  return {503:messages.provider_not_configured,400:'The request was rejected (HTTP 400). Clear the optional Model field and use Check OCR connection to see the server’s enabled models. Update the local server for more specific error details.',404:'No OCR gateway was found at this address, or the provider could not find the model. Use Check OCR connection and restart the updated local Bhaasa server.'}[status]||`OCR returned HTTP ${status}. Check the gateway, API access, and selected model.`;
}
