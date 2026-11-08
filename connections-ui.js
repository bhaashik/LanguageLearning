import {OCR_PROVIDERS,loadOCRSettings,saveOCRSettings,normalizeOCRModel} from './ocr-settings.js';
import {ASR_PROVIDERS,loadASRSettings,saveASRSettings} from './asr.js';
import {gatewayJSON} from './gateway.js';
import {validateEndpoint} from './audio-store.js';
import {defaultGateway,isPagesApp,helpLinkAttributes} from './platform.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ttsProviders=[['device','Device voices · free'],['recording','Saved / imported recordings'],['openai','OpenAI'],['gemini','Google Gemini'],['elevenlabs','ElevenLabs'],['custom','Custom speech service'],['local','Local speech service']];
const choices=list=>list.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
function card(kind,title,description,providers){return `<section class="panel connection-card" id="connection-${kind}"><h2>${title}</h2><p>${description}</p><div class="form-grid"><label>Provider<select id="connection-${kind}-provider">${choices(providers)}</select></label><label>Configured model<select id="connection-${kind}-models"><option value="">Gateway default</option></select></label></div><label class="stacked">${kind.toUpperCase()} gateway URL<input type="url" id="connection-${kind}-endpoint" maxlength="1000" placeholder="https://your-gateway.example/api/${kind==='tts'?'speech':kind==='asr'?'transcribe':'ocr'}" autocomplete="url" spellcheck="false"></label><details class="connection-manual"><summary>Enter an exact model ID manually</summary><label>Model ID<input id="connection-${kind}-model" maxlength="150" placeholder="Leave blank for gateway default" spellcheck="false"></label></details>${kind==='tts'?'<div class="form-grid"><label>Service voice<select id="connection-tts-voices"><option value="">Enter a voice ID manually</option></select></label><label>Voice ID<input id="connection-tts-voice" maxlength="190" placeholder="Discover voices or enter their exact ID" spellcheck="false"></label></div><label id="connection-device-choice">Available device voice<select id="connection-tts-device"><option value="default">Automatic matching voice</option></select></label>':''}<div class="button-row"><button type="button" class="button secondary" id="connection-${kind}-discover">Discover gateway models</button><button type="button" class="button primary" id="connection-${kind}-save">Use these settings</button></div><p class="section-note" id="connection-${kind}-status" role="status" aria-live="polite"></p></section>`;}
export function connectionsPage(languageName){return `<div id="connections-page"><div class="page-heading"><div><p class="eyebrow">OCR · TEXT-TO-SPEECH · SPEECH RECOGNITION</p><h1>Connections &amp; models</h1><p class="description">Choose providers and models for your ${esc(languageName)} practice. Settings are saved separately on each browser/device; your desktop settings do not transfer to an iPad.</p></div></div><section class="panel connection-intro"><h2>Connect your model gateway</h2><p>${isPagesApp()?'This GitHub Pages version includes the lessons and tracing, but no model server.':'Cloud models need a reachable gateway that keeps provider keys on its server.'} Your desktop’s localhost address points to the iPad itself when used on an iPad. Use an HTTPS gateway the device can reach.</p><p>Discovery lists models enabled on that gateway. It cannot discover models inside installed ChatGPT, Gemini, or Claude chat apps. Device TTS and browser ASR, when available, have their own options below.</p><label>Optional gateway base URL<input type="url" id="connection-base" placeholder="https://your-gateway.example" autocomplete="url" spellcheck="false"></label><button type="button" class="button secondary" id="connection-fill">Fill the three gateway addresses</button><p class="section-note" id="connection-base-status" role="status">Then discover models and save each connection. This makes configuration requests only; no drawing, text, or recording is sent for generation.</p><p><a href="./docs/PROVIDERS.html" ${helpLinkAttributes()}>Gateway setup guide</a> · <a href="#audio">Voices &amp; recordings</a> · <a href="#speaking">Speak &amp; listen</a></p></section>${card('ocr','Handwriting recognition (OCR)','For Malayalam drawings. Offline tracing and stroke checks always remain available.',OCR_PROVIDERS.map(p=>[p.id,p.label]))}${card('tts','Listening (TTS)','Use a matching device voice or saved audio for free, or connect a speech service.',ttsProviders)}${card('asr','Speaking checks (ASR)','Choose browser recognition when supported, or a server model for recorded/imported speech.',ASR_PROVIDERS)}<p class="section-note">Keep API keys out of the app and GitHub Pages. Your gateway must allow this app’s exact origin; for the hosted Bhaasa app this is <code>https://bhaashik.github.io</code>. A configured model list does not test billing, quota, language quality, or live generation.</p></div>`;}

export function setupConnections({audio,language,languageName,notify}){
  const root=document.querySelector('#connections-page'),$=selector=>root.querySelector(selector),kinds=['ocr','tts','asr'];
  const fields=Object.fromEntries(kinds.map(kind=>[kind,Object.fromEntries(['provider','models','endpoint','model','discover','save','status'].map(id=>[id,$(`#connection-${kind}-${id}`)]))]));
  const ocr=loadOCRSettings(),asr=loadASRSettings(language),profiles={ocr:ocr.profiles,asr:asr.profiles,tts:{}};
  for(const p of audio.profiles)if(p.kind==='service')profiles.tts[p.provider]={endpoint:p.endpoint||'',model:p.model,voice:p.voice};
  const active=audio.active;if(active.kind==='service')profiles.tts[active.provider]={endpoint:active.endpoint||'',model:active.model,voice:active.voice};
  fields.ocr.provider.value=ocr.provider;fields.asr.provider.value=asr.provider;
  const selected=active.kind==='service'?active.provider:active.kind==='recording'?'recording':'device';
  if(!ttsProviders.some(([id])=>id===selected))fields.tts.provider.add(new Option(selected,selected));fields.tts.provider.value=selected;
  let dead=false,baseAddress='',deviceSelection=active.kind==='device'?active.voice:'default';const requests={},lists={},previous={ocr:ocr.provider,asr:asr.provider,tts:selected};
  function local(kind){const p=fields[kind].provider.value;return kind==='ocr'&&p==='none'||kind==='asr'&&p==='browser'||kind==='tts'&&['device','recording'].includes(p);}
  function message(kind,text){if(!dead)fields[kind].status.textContent=text;}
  function draft(kind,provider=fields[kind].provider.value){profiles[kind][provider]={endpoint:fields[kind].endpoint.value.trim(),model:fields[kind].model.value.trim(),...(kind==='tts'?{voice:$('#connection-tts-voice').value.trim()}:{})};return profiles[kind][provider];}
  function abort(kind){requests[kind]?.abort();delete requests[kind];}
  function sync(kind){
    const f=fields[kind],isLocal=local(kind);f.endpoint.disabled=isLocal;f.model.disabled=isLocal;f.models.disabled=isLocal;
    f.discover.disabled=Boolean(requests[kind])||kind==='ocr'&&f.provider.value==='none'||kind==='tts'&&f.provider.value==='recording';
    f.discover.textContent=kind==='tts'&&f.provider.value==='device'?'Refresh device voices':kind==='asr'&&f.provider.value==='browser'?'Check browser support':'Discover gateway models';
    if(kind==='tts'){const device=f.provider.value==='device';$('#connection-device-choice').hidden=!device;$('#connection-tts-voices').disabled=isLocal;$('#connection-tts-voice').disabled=isLocal;}
  }
  function renderModels(kind,models=[]){
    const f=fields[kind],value=f.model.value;f.models.innerHTML='<option value="">Gateway default</option>';
    for(const m of models)f.models.add(new Option(m.id,m.id));
    if(value&&!models.some(m=>m.id===value))f.models.add(new Option(`${value} · saved/manual, not checked`,value));f.models.value=value;
  }
  function renderVoices(){
    const list=lists.tts||[],model=list.find(m=>m.id===fields.tts.model.value)||list[0],value=$('#connection-tts-voice').value;
    const select=$('#connection-tts-voices');select.innerHTML='<option value="">Enter a voice ID manually</option>';
    for(const voice of model?.voices||[])select.add(new Option(voice.name||voice.id,voice.id));
    if(value&&![...select.options].some(o=>o.value===value))select.add(new Option(`${value} · saved/manual`,value));select.value=value;
  }
  function show(kind){
    const f=fields[kind],p=f.provider.value,saved=profiles[kind][p]||{endpoint:defaultGateway(kind==='tts'?'speech':kind==='asr'?'transcribe':'ocr'),model:'',voice:''};
    f.endpoint.value=local(kind)?'':saved.endpoint||(baseAddress?baseAddress+'/api/'+({ocr:'ocr',tts:'speech',asr:'transcribe'}[kind]):'');f.model.value=saved.model||'';lists[kind]=[];renderModels(kind);
    if(kind==='tts'){$('#connection-tts-voice').value=saved.voice||'';renderVoices();}
    message(kind,local(kind)?kind==='tts'?(p==='device'?'Device voices need no gateway. Only matching language voices reported by this device are listed.':'Manage imported audio in Voices & recordings. No model API is used.'):kind==='asr'?'Browser recognition support depends on Safari/iPadOS and permissions. No cloud model ID is exposed by this API.':'OCR is off; tracing checks still work offline.':f.endpoint.value?'Discover this gateway’s configured models, then choose a model and use these settings.':'Not connected. Enter an HTTPS gateway to discover or use cloud models.');sync(kind);
  }
  async function deviceVoices(){
    await audio.refreshVoices();if(dead)return;const select=$('#connection-tts-device'),value=deviceSelection;
    select.innerHTML='<option value="default">Automatic matching voice</option>';
    for(const voice of audio.voices)select.add(new Option(`${voice.name} · ${voice.lang}`,voice.voiceURI||voice.name));
    if([...select.options].some(o=>o.value===value))select.value=value;
    if(fields.tts.provider.value==='device')message('tts',audio.voices.length?`${audio.voices.length} ${languageName} device voice(s) reported. Select one and use these settings.`:`No ${languageName} voice is currently reported. Install that language’s speech data in device settings and refresh, or use saved recordings / a speech gateway.`);
  }
  function modelList(value){return (Array.isArray(value)?value:[]).slice(0,100).map(m=>typeof m==='string'?{id:m}:m).filter(m=>m&&typeof m.id==='string'&&m.id.length<=150).map(m=>({id:m.id,voices:(Array.isArray(m.voices)?m.voices:[]).slice(0,100).map(v=>typeof v==='string'?{id:v}:v).filter(v=>v&&typeof v.id==='string'&&v.id.length<=190).map(v=>({id:v.id,name:typeof v.name==='string'?v.name.slice(0,200):v.id}))}));}
  async function discover(kind){
    if(local(kind)){
      if(kind==='tts'&&fields.tts.provider.value==='device')await deviceVoices();
      if(kind==='asr')message(kind,globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition?'This browser reports a speech-recognition API. Microphone permission and actual recognition are checked in Speak & listen.':'This browser reports no speech-recognition API. Choose a gateway provider to check recordings.');return;
    }
    abort(kind);const controller=new AbortController();requests[kind]=controller;sync(kind);message(kind,'Reading gateway configuration… No learning content is sent.');
    try{
      const f=fields[kind],provider=f.provider.value,data=await gatewayJSON(f.endpoint.value,{models:kind==='tts',signal:controller.signal});if(dead||requests[kind]!==controller)return;
      if(kind==='tts'){
        if(data.provider&&data.provider!==provider)throw Error(`This gateway supplies ${data.provider} speech. Select that provider, or use a gateway configured for ${provider}.`);
        lists[kind]=modelList(data.models);renderModels(kind,lists[kind]);
        if(data.configured===false||data.setupRequired===true)throw Error('The speech provider is not configured on this gateway. Its owner must configure the provider key and models.');
        if(!f.model.value&&lists[kind][0]){f.model.value=lists[kind][0].id;f.models.value=f.model.value;}
        const model=lists[kind].find(m=>m.id===f.model.value)||lists[kind][0];if(!$('#connection-tts-voice').value&&model?.voices[0])$('#connection-tts-voice').value=model.voices[0].id;renderVoices();
      }else{
        const p=(Array.isArray(data.providers)?data.providers:[]).find(p=>p.id===provider||p.provider===provider)||(data.provider===provider?data:null);
        if(!p)throw Error('This gateway did not report the selected provider. Choose a configured provider or check its server setup.');
        lists[kind]=modelList(p.models||[p.model].filter(Boolean));renderModels(kind,lists[kind]);
        if(!p.configured)throw Error('This provider is not configured on the gateway. Its owner must configure its credential, endpoint, and models.');
      }
      message(kind,`${lists[kind].length} configured model(s) reported. Select one and use these settings. This does not test generation, quota, or recognition quality.`);
    }catch(error){if(!dead&&!controller.signal.aborted)message(kind,error.message);}
    finally{if(requests[kind]===controller){delete requests[kind];if(!dead)sync(kind);}}
  }
  function save(kind){
    abort(kind);try{
      const f=fields[kind],p=f.provider.value,config=draft(kind);if(!local(kind)&&config.endpoint)config.endpoint=validateEndpoint(config.endpoint);
      if(kind==='ocr'){config.model=normalizeOCRModel(p,config.model);ocr.provider=p;ocr.profiles[p]=config;if(!saveOCRSettings(ocr))throw Error('OCR settings could not be saved on this device.');}
      if(kind==='asr'){asr.provider=p;asr.profiles[p]=config;if(saveASRSettings(language,asr)===false)throw Error('ASR settings could not be saved on this device.');}
      if(kind==='tts'){
        if(p==='recording'){if(audio.active.kind!=='recording')audio.choose('human');}
        else if(p==='device'){
          const id=$('#connection-tts-device').value;
          if(id==='default')audio.choose('device');else{const voice=audio.voices.find(v=>(v.voiceURI||v.name)===id);if(!voice)throw Error('Refresh the available device voices first.');const existing=audio.profiles.find(v=>v.kind==='device'&&v.voice===id);if(existing)audio.choose(existing.id);else audio.add({kind:'device',name:voice.name.slice(0,150),provider:'device',model:'speech-synthesis',voice:id,gender:'unspecified'});}
        }else{
          validateEndpoint(config.endpoint);if(!config.model||!config.voice)throw Error('Discover and select a speech model and voice, or enter their exact IDs.');
          const existing=audio.profiles.find(v=>v.kind==='service'&&v.provider===p&&v.model===config.model&&v.voice===config.voice&&v.endpoint===config.endpoint);
          if(existing)audio.choose(existing.id);else audio.add({kind:'service',name:`${p} · ${config.model} · ${config.voice}`.slice(0,150),provider:p,model:config.model,voice:config.voice,endpoint:config.endpoint,gender:'unspecified'});
          if(p==='openai')audio.openaiPreset={...audio.openaiPreset,endpoint:config.endpoint,model:config.model,voice:config.voice};
        }
      }
      message(kind,kind==='tts'?'Voice selected. Use Listen on a lesson or phrase to try it.':`${kind.toUpperCase()} settings saved on this device.${!local(kind)&&!config.endpoint?' Cloud models are not connected until you add a gateway.':''}`);notify(`${kind.toUpperCase()} settings updated.`);
    }catch(error){message(kind,error.message);}finally{sync(kind);}
  }
  for(const kind of kinds){const f=fields[kind];f.provider.onchange=()=>{draft(kind,previous[kind]);abort(kind);previous[kind]=f.provider.value;show(kind);if(kind==='tts'&&f.provider.value==='device')deviceVoices();};f.models.onchange=()=>{f.model.value=f.models.value;if(kind==='tts')renderVoices();};f.model.oninput=()=>{renderModels(kind,lists[kind]);if(kind==='tts')renderVoices();};f.endpoint.oninput=()=>{abort(kind);lists[kind]=[];renderModels(kind);sync(kind);};f.discover.onclick=()=>discover(kind);f.save.onclick=()=>save(kind);show(kind);}
  $('#connection-tts-voices').onchange=()=>{$('#connection-tts-voice').value=$('#connection-tts-voices').value;};
  $('#connection-fill').onclick=()=>{try{const base=validateEndpoint($('#connection-base').value);if(/\/api\/(ocr|speech|transcribe)$/.test(new URL(base).pathname))throw Error('Enter the gateway base address, without /api/ocr, /api/speech, or /api/transcribe.');baseAddress=base;for(const kind of kinds)if(!local(kind)){abort(kind);fields[kind].endpoint.value=base+'/api/'+({ocr:'ocr',tts:'speech',asr:'transcribe'}[kind]);lists[kind]=[];renderModels(kind);sync(kind);}$('#connection-base-status').textContent='Gateway fields filled for the selected cloud providers. Discover models and use each connection’s settings to save them.';}catch(error){$('#connection-base-status').textContent=error.message;}};
  $('#connection-tts-device').onchange=()=>{deviceSelection=$('#connection-tts-device').value;};
  deviceVoices();const voicesChanged=()=>deviceVoices();globalThis.speechSynthesis?.addEventListener('voiceschanged',voicesChanged);
  return ()=>{dead=true;for(const kind of kinds)abort(kind);globalThis.speechSynthesis?.removeEventListener('voiceschanged',voicesChanged);};
}
