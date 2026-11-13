import {firebaseSettingsPanel,setupFirebaseSettings} from './firebase-settings-ui.js';
import {settingsStatusPanel,setupSettingsStatus} from './settings-status.js';
import {FIREBASE_MODELS,FIREBASE_VOICES,firebaseModel} from './firebase-client.js';
import {OCR_PROVIDERS,loadOCRSettings,saveOCRSettings,normalizeOCRModel} from './ocr-settings.js';
import {ASR_PROVIDERS,loadASRSettings,saveASRSettings} from './asr.js';
import {gatewayJSON,gatewayConnection,saveGatewayConnection,setGatewayAccess,clearGatewayAccess,validateGatewayBase} from './gateway.js';
import {gatewayModels as modelList,gatewayServiceSettings,forgetGatewayEndpoints} from './connection-discovery.js';
import {validateEndpoint} from './audio-store.js';
import {defaultGateway,helpLinkAttributes} from './platform.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ttsProviders=[['device','Device voices · free'],['recording','Saved / imported recordings'],['openai','OpenAI'],['gemini','Google Gemini · gateway'],['firebase','Firebase AI Logic · direct Gemini'],['elevenlabs','ElevenLabs'],['custom','Custom speech service'],['local','Local speech service']];
const choices=list=>list.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
function card(kind,title,description,providers){return `<section class="panel connection-card" id="connection-${kind}"><h2>${title}</h2><p>${description}</p><div class="form-grid"><label>Provider<select id="connection-${kind}-provider">${choices(providers)}</select></label><label>Configured model<select id="connection-${kind}-models"><option value="">Gateway default</option></select></label></div><label class="stacked">${kind.toUpperCase()} gateway URL<input type="url" id="connection-${kind}-endpoint" maxlength="1000" placeholder="https://your-gateway.example/api/${kind==='tts'?'speech':kind==='asr'?'transcribe':'ocr'}" autocomplete="url" spellcheck="false"></label><details class="connection-manual"><summary>Enter an exact model ID manually</summary><label>Model ID<input id="connection-${kind}-model" maxlength="150" placeholder="Leave blank for gateway default" spellcheck="false"></label></details>${kind==='tts'?'<div class="form-grid"><label>Service voice<select id="connection-tts-voices"><option value="">Enter a voice ID manually</option></select></label><label>Voice ID<input id="connection-tts-voice" maxlength="190" placeholder="Discover voices or enter their exact ID" spellcheck="false"></label></div><label id="connection-device-choice">Available device voice<select id="connection-tts-device"><option value="default">Automatic matching voice</option></select></label>':''}<div class="button-row"><button type="button" class="button secondary" id="connection-${kind}-discover">Discover gateway models</button><button type="button" class="button primary" id="connection-${kind}-save">Use these settings</button></div><p class="section-note" id="connection-${kind}-status" role="status" aria-live="polite"></p></section>`;}
export function connectionsPage(languageName){return `<div id="connections-page">
<div class="page-heading"><div><p class="eyebrow">OCR · TEXT-TO-SPEECH · SPEECH RECOGNITION</p><h1>Connections &amp; models</h1><p class="description">Connect once for handwriting, listening and speaking in ${esc(languageName)}. Your preferences stay in this browser on this device.</p></div></div>
<section class="panel connection-intro"><h2>Connect your gateway</h2><p>Use the address and access code for your model gateway. It supplies the configured providers, models and speech voice. Provider API keys stay on its server.</p>
<label>Gateway address<input type="url" id="connection-base" maxlength="1000" placeholder="https://your-gateway.example" autocomplete="url" spellcheck="false"></label>
<label>Gateway access code<input type="password" id="connection-token" maxlength="256" autocomplete="off" spellcheck="false" placeholder="Enter your gateway access code"></label>
<label class="remember-choice"><input type="checkbox" id="connection-remember">Remember on this device</label>
<p class="section-note">Remembering stores the address and access code in this browser across restarts. Leave it off for this tab/session only. Leave the code blank to keep a saved code for the same address, or for a gateway that needs no code.</p>
<div class="button-row"><button type="button" class="button primary" id="connection-connect">Connect &amp; check</button><button type="button" class="button secondary" id="connection-access-clear">Forget connection</button></div>
<p id="connection-access-status" class="section-note" role="status"></p><p id="connection-base-status" class="section-note" role="status">Connect &amp; check discovers and saves the three services together. It reads configuration only; no drawing, text or recording is sent for generation.</p></section>
<div class="gateway-service-grid">${[['ocr','Handwriting · OCR'],['tts','Listening · TTS'],['asr','Speaking · ASR']].map(([kind,label])=>`<section class="panel gateway-service"><h2>${label}</h2><p id="connection-${kind}-summary" role="status" aria-live="polite" data-state="idle">Not checked in this session.</p></section>`).join('')}</div>
${settingsStatusPanel()}
<details id="connection-advanced" class="panel connection-advanced"><summary>Advanced: providers, models, device voices and direct Firebase</summary>
<p>Use these controls for individual connections, device voices, imported recordings, or direct Firebase AI Logic. The gateway connection above does not need a Firebase web API key or Gemini API key.</p>
<div class="button-row"><button type="button" class="button secondary" id="connection-fill">Fill the three gateway addresses</button><button type="button" class="button secondary" id="connection-access-save">Save access for this session</button></div>
${card('ocr','Handwriting recognition (OCR)','For Malayalam drawings. Offline tracing and stroke checks always remain available.',OCR_PROVIDERS.map(p=>[p.id,p.label]))}
${card('tts','Listening (TTS)','Use a matching device voice or saved audio for free, or connect a speech service.',ttsProviders)}
${card('asr','Speaking checks (ASR)','Choose browser recognition when supported, or a server model for recorded/imported speech.',ASR_PROVIDERS)}
${firebaseSettingsPanel()}<p class="section-note">Your gateway must allow this app’s exact origin. For GitHub Pages this is <code>https://bhaashik.github.io</code>. Configuration checks do not test billing, quota or recognition quality.</p>
<p><a href="./docs/PROVIDERS.html" ${helpLinkAttributes()}>Gateway setup guide</a> · <a href="./docs/FIREBASE.html" ${helpLinkAttributes()}>Direct Firebase and server setup</a> · <a href="#audio">Voices &amp; recordings</a> · <a href="#speaking">Speak &amp; listen</a></p></details></div>`;}

export function setupConnections({audio,language,languageName,notify}){
  const root=document.querySelector('#connections-page'),$=selector=>root.querySelector(selector),kinds=['ocr','tts','asr'];
  const fields=Object.fromEntries(kinds.map(kind=>[kind,Object.fromEntries(['provider','models','endpoint','model','discover','save','status'].map(id=>[id,$(`#connection-${kind}-${id}`)]))]));
  const saveStatus=setupSettingsStatus(root,language);
  const firebaseCleanup=setupFirebaseSettings(root,saveStatus);
  const ocr=loadOCRSettings(),asr=loadASRSettings(language),profiles={ocr:ocr.profiles,asr:asr.profiles,tts:{}};
  for(const p of audio.profiles)if(p.kind==='service')profiles.tts[p.provider]={endpoint:p.endpoint||'',model:p.model,voice:p.voice};
  const active=audio.active;if(active.kind==='service')profiles.tts[active.provider]={endpoint:active.endpoint||'',model:active.model,voice:active.voice};
  fields.ocr.provider.value=ocr.provider;fields.asr.provider.value=asr.provider;
  const selected=active.kind==='service'?active.provider:active.kind==='recording'?'recording':'device';
  if(!ttsProviders.some(([id])=>id===selected))fields.tts.provider.add(new Option(selected,selected));fields.tts.provider.value=selected;
  let dead=false,baseAddress='',combinedRequest,deviceSelection=active.kind==='device'?active.voice:'default';const requests={},lists={},previous={ocr:ocr.provider,asr:asr.provider,tts:selected};
  function local(kind){const p=fields[kind].provider.value;return kind==='ocr'&&p==='none'||kind==='asr'&&p==='browser'||kind==='tts'&&['device','recording'].includes(p);}
  function message(kind,text){if(!dead)fields[kind].status.textContent=text;}
  function draft(kind,provider=fields[kind].provider.value){profiles[kind][provider]={endpoint:fields[kind].endpoint.value.trim(),model:fields[kind].model.value.trim(),...(kind==='tts'?{voice:$('#connection-tts-voice').value.trim()}:{})};return profiles[kind][provider];}
  function serviceStatus(kind,text,state='idle',at){
    if(dead)return;const node=$(`#connection-${kind}-summary`);node.dataset.state=state;node.textContent=text;
    if(at){const time=document.createElement('time');time.dateTime=new Date(at).toISOString();time.textContent=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'long'}).format(new Date(at));node.append(document.createTextNode(' · '),time);}
  }
  function selectionText(kind){const f=fields[kind];return `${f.provider.selectedOptions[0]?.textContent||f.provider.value}${f.model.value?' · '+f.model.value:''}${kind==='tts'&&$('#connection-tts-voice').value?' · '+$('#connection-tts-voice').value:''}`;}
  function cancelConnect(){
    if(!combinedRequest)return;const controller=combinedRequest;combinedRequest=null;controller.abort();
    for(const kind of kinds){if(requests[kind]===controller)delete requests[kind];sync(kind);serviceStatus(kind,'Check cancelled. Your previous service preferences are kept.');}
    $('#connection-connect').disabled=false;$('#connection-base-status').textContent='Check cancelled. Choose Connect & check to use the edited settings.';
  }
  function abort(kind){if(combinedRequest&&requests[kind]===combinedRequest)cancelConnect();requests[kind]?.abort();delete requests[kind];}
  function sync(kind){
    const f=fields[kind],isLocal=local(kind),direct=f.provider.value==='firebase';f.endpoint.disabled=isLocal||direct;f.model.disabled=isLocal;f.models.disabled=isLocal;
    f.discover.disabled=Boolean(requests[kind])||kind==='ocr'&&f.provider.value==='none'||kind==='tts'&&f.provider.value==='recording';
    f.discover.textContent=kind==='tts'&&f.provider.value==='device'?'Refresh device voices':kind==='asr'&&f.provider.value==='browser'?'Check browser support':direct?'Show Firebase model presets':'Discover gateway models';
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
    const f=fields[kind],p=f.provider.value,saved=profiles[kind][p]||(p==='firebase'?{endpoint:'',model:FIREBASE_MODELS[kind],voice:'Kore'}:null)||{endpoint:defaultGateway(kind==='tts'?'speech':kind==='asr'?'transcribe':'ocr'),model:'',voice:''};
    f.endpoint.value=local(kind)||p==='firebase'?'':saved.endpoint||(baseAddress?baseAddress+'/api/'+({ocr:'ocr',tts:'speech',asr:'transcribe'}[kind]):'');f.model.value=saved.model||'';lists[kind]=[];renderModels(kind);
    if(kind==='tts'){$('#connection-tts-voice').value=saved.voice||'';renderVoices();}
    message(kind,p==='firebase'?'Uses the Firebase configuration above and App Check directly. No gateway URL is needed. Show presets or enter a supported exact model ID; availability and quota are checked only on an explicit request.':local(kind)?kind==='tts'?(p==='device'?'Device voices need no gateway. Only matching language voices reported by this device are listed.':'Manage imported audio in Voices & recordings. No model API is used.'):kind==='asr'?'Browser recognition support depends on Safari/iPadOS and permissions. No cloud model ID is exposed by this API.':'OCR is off; tracing checks still work offline.':f.endpoint.value?'Discover this gateway’s configured models, then choose a model and use these settings.':'Not connected. Enter an HTTPS gateway to discover or use cloud models.');sync(kind);
  }
  async function deviceVoices(){
    await audio.refreshVoices();if(dead)return;const select=$('#connection-tts-device'),value=deviceSelection;
    select.innerHTML='<option value="default">Automatic matching voice</option>';
    for(const voice of audio.voices)select.add(new Option(`${voice.name} · ${voice.lang}`,voice.voiceURI||voice.name));
    if([...select.options].some(o=>o.value===value))select.value=value;
    if(fields.tts.provider.value==='device')message('tts',audio.voices.length?`${audio.voices.length} ${languageName} device voice(s) reported. Select one and use these settings.`:`No ${languageName} voice is currently reported. Install that language’s speech data in device settings and refresh, or use saved recordings / a speech gateway.`);
  }

  async function discover(kind){
    if(fields[kind].provider.value==='firebase'){lists[kind]=[{id:FIREBASE_MODELS[kind],...(kind==='tts'?{voices:FIREBASE_VOICES.map(id=>({id}))}:{})}];renderModels(kind,lists[kind]);if(kind==='tts')renderVoices();message(kind,'Suggested Firebase model presets, not a live model list. Exact model availability, billing and quota depend on your project. No content was sent.');return;}
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
    finally{if(requests[kind]===controller){delete requests[kind];if(!dead){sync(kind);saveStatus.refresh(kind);}}}
  }
  function save(kind,{quiet=false}={}){
    abort(kind);saveStatus.begin(kind);try{
      const f=fields[kind],p=f.provider.value,config=draft(kind);if(p==='firebase'){config.endpoint='';config.model=firebaseModel(kind,config.model);}else if(!local(kind)&&config.endpoint)config.endpoint=validateEndpoint(config.endpoint);
      if(kind==='ocr'){config.model=normalizeOCRModel(p,config.model);ocr.provider=p;ocr.profiles[p]=config;if(!saveOCRSettings(ocr))throw Error('OCR settings could not be saved on this device.');}
      if(kind==='asr'){asr.provider=p;asr.profiles[p]=config;if(saveASRSettings(language,asr)===false)throw Error('ASR settings could not be saved on this device.');}
      if(kind==='tts'){
        if(p==='recording'){if(audio.active.kind!=='recording')audio.choose('human');}
        else if(p==='device'){
          const id=$('#connection-tts-device').value;
          if(id==='default')audio.choose('device');else{const voice=audio.voices.find(v=>(v.voiceURI||v.name)===id);if(!voice)throw Error('Refresh the available device voices first.');const existing=audio.profiles.find(v=>v.kind==='device'&&v.voice===id);if(existing)audio.choose(existing.id);else audio.add({kind:'device',name:voice.name.slice(0,150),provider:'device',model:'speech-synthesis',voice:id,gender:'unspecified'});}
        }else{
          if(p!=='firebase')validateEndpoint(config.endpoint);if(!config.model||!config.voice)throw Error('Discover and select a speech model and voice, or enter their exact IDs.');
          const existing=audio.profiles.find(v=>v.kind==='service'&&v.provider===p&&v.model===config.model&&v.voice===config.voice&&v.endpoint===config.endpoint);
          if(existing)audio.choose(existing.id);else audio.add({kind:'service',name:`${p} · ${config.model} · ${config.voice}`.slice(0,150),provider:p,model:config.model,voice:config.voice,endpoint:config.endpoint,gender:'unspecified'});
          if(p==='openai')audio.openaiPreset={...audio.openaiPreset,endpoint:config.endpoint,model:config.model,voice:config.voice};
        }
      }
      if(kind==='tts'&&audio.persist()===false)throw Error('Voice settings could not be saved on this device.');
      saveStatus.saved(kind);
      message(kind,kind==='tts'?'Voice selected. Use Listen on a lesson or phrase to try it.':`${kind.toUpperCase()} settings saved on this device.${p!=='firebase'&&!local(kind)&&!config.endpoint?' Cloud models are not connected until you add a gateway.':''}`);
      serviceStatus(kind,`${selectionText(kind)} · Saved. Not checked by this save action.`);if(!quiet)notify(`${kind.toUpperCase()} settings updated.`);return true;
    }catch(error){saveStatus.failed(kind);message(kind,error.message);serviceStatus(kind,error.message,'failed');return false;}finally{sync(kind);}
  }
  async function connect(){
    cancelConnect();for(const kind of kinds)abort(kind);saveStatus.begin('gateway');
    let base;
    try{base=validateGatewayBase($('#connection-base').value.trim());saveGatewayConnection(base,$('#connection-token').value.trim(),{remember:$('#connection-remember').checked});}
    catch(error){saveStatus.failed('gateway');$('#connection-base-status').textContent=error.message;return;}
    baseAddress=base;$('#connection-base').value=base;$('#connection-token').value='';accessStatus();saveStatus.saved('gateway');
    const controller=new AbortController();combinedRequest=controller;$('#connection-connect').disabled=true;
    $('#connection-base-status').textContent='Connection saved. Checking OCR, listening and speaking configuration…';
    const choices={};
    for(const kind of kinds){
      const current={provider:fields[kind].provider.value,...draft(kind)};
      try{const stored=kind==='tts'?audio.active:JSON.parse(localStorage.getItem(kind==='ocr'?'bhaasa.ocr.preferences.v1':`bhaasa.asr.${language}.v1`));current.preserve=stored?.provider===current.provider||Boolean(current.model);}catch{current.preserve=Boolean(current.model);}
      choices[kind]=current;requests[kind]=controller;sync(kind);serviceStatus(kind,'Checking gateway configuration…','checking');
    }
    try{
      const results=await Promise.allSettled(kinds.map(async kind=>{
        const endpoint=base+'/api/'+({ocr:'ocr',tts:'speech',asr:'transcribe'}[kind]);
        const data=await gatewayJSON(endpoint,{models:kind==='tts',signal:controller.signal});
        return gatewayServiceSettings(kind,data,{endpoint,current:choices[kind],profiles:profiles[kind]});
      }));
      if(dead||combinedRequest!==controller||controller.signal.aborted)return;
      for(const kind of kinds)if(requests[kind]===controller)delete requests[kind];
      let configured=0;
      results.forEach((result,index)=>{
        const kind=kinds[index],at=Date.now();
        if(result.status==='rejected'){serviceStatus(kind,result.reason.message,'failed',at);message(kind,result.reason.message);return;}
        const config=result.value,f=fields[kind];
        f.provider.value=config.provider;previous[kind]=config.provider;f.endpoint.value=config.endpoint;f.model.value=config.model;lists[kind]=config.models;renderModels(kind,lists[kind]);
        if(kind==='tts'){$('#connection-tts-voice').value=config.voice;renderVoices();}
        sync(kind);
        if(save(kind,{quiet:true})){configured++;serviceStatus(kind,`Configured · ${selectionText(kind)}`,'configured',at);}
      });
      $('#connection-base-status').textContent=configured===3?'All three services configured and saved. These checks read configuration only. Try handwriting, Listen and a speaking recording to check generation.':`${configured} of 3 services configured and saved. Review each service’s status. Previous preferences are kept for services that could not be discovered.`;
      if(configured===3)notify('Gateway settings saved for all three services.');
    }finally{
      if(combinedRequest===controller){combinedRequest=null;for(const kind of kinds){if(requests[kind]===controller)delete requests[kind];if(!dead)sync(kind);}if(!dead)$('#connection-connect').disabled=false;}
    }
  }
  for(const kind of kinds){const f=fields[kind];f.provider.onchange=()=>{draft(kind,previous[kind]);abort(kind);previous[kind]=f.provider.value;show(kind);if(kind==='tts'&&f.provider.value==='device')deviceVoices();};f.models.onchange=()=>{f.model.value=f.models.value;if(kind==='tts')renderVoices();};f.model.oninput=()=>{renderModels(kind,lists[kind]);if(kind==='tts')renderVoices();};f.endpoint.oninput=()=>{abort(kind);lists[kind]=[];renderModels(kind);sync(kind);};f.discover.onclick=()=>discover(kind);f.save.onclick=()=>save(kind);show(kind);}
  $('#connection-tts-voices').onchange=()=>{$('#connection-tts-voice').value=$('#connection-tts-voices').value;};
  $('#connection-fill').onclick=()=>{try{const base=validateEndpoint($('#connection-base').value);if(/\/api\/(ocr|speech|transcribe)$/.test(new URL(base).pathname))throw Error('Enter the gateway base address, without /api/ocr, /api/speech, or /api/transcribe.');baseAddress=base;for(const kind of kinds)if(!local(kind)&&fields[kind].provider.value!=='firebase'){abort(kind);fields[kind].endpoint.value=base+'/api/'+({ocr:'ocr',tts:'speech',asr:'transcribe'}[kind]);lists[kind]=[];renderModels(kind);sync(kind);saveStatus.refresh(kind);}saveStatus.refresh('gateway');$('#connection-base-status').textContent='Gateway fields filled for the selected cloud providers. Discover models and use each connection’s settings to save them.';}catch(error){$('#connection-base-status').textContent=error.message;}};
  function accessStatus(){
    const saved=gatewayConnection();
    $('#connection-access-status').textContent=saved.base?`Connection saved for ${saved.base} ${saved.remember?'on this device':'for this session'}.${saved.configured?' Access code saved; leave it blank to reuse it for this address.':' No access code saved.'}`:'No gateway connection saved. Offline lessons, tracing and saved audio remain available.';
    $('#connection-token').placeholder=saved.configured?'Saved code · leave blank to keep it':'Enter your gateway access code';return saved;
  }
  const savedAccess=accessStatus();if(savedAccess.base){$('#connection-base').value=savedAccess.base;baseAddress=savedAccess.base;}$('#connection-remember').checked=savedAccess.remember;
  $('#connection-connect').onclick=connect;
  $('#connection-access-save').onclick=()=>{cancelConnect();saveStatus.begin('gateway');try{if(setGatewayAccess($('#connection-base').value.trim(),$('#connection-token').value.trim())===false)throw Error('This browser could not save access for session reloads.');$('#connection-token').value='';$('#connection-remember').checked=false;accessStatus();saveStatus.saved('gateway');}catch(error){saveStatus.failed('gateway');$('#connection-access-status').textContent=error.message;}};
  $('#connection-access-clear').onclick=()=>{
    cancelConnect();for(const kind of kinds)abort(kind);saveStatus.begin('gateway');const base=gatewayConnection().base;
    try{
      if(!clearGatewayAccess())throw Error('Saved access could not be completely cleared. Allow browser storage and retry Forget connection.');
      if(base)forgetGatewayEndpoints(base);
      const endpoints=new Set(['/api/ocr','/api/speech','/api/transcribe'].map(path=>base+path));
      for(const kind of kinds){for(const p of Object.values(profiles[kind]))if(endpoints.has(p.endpoint))p.endpoint='';if(endpoints.has(fields[kind].endpoint.value)){fields[kind].endpoint.value='';saveStatus.saved(kind);}else saveStatus.refresh(kind);serviceStatus(kind,'Gateway connection forgotten. Provider, model and voice preferences are kept.');}
      for(const profile of audio.profiles)if(endpoints.has(profile.endpoint))profile.endpoint='';if(endpoints.has(audio.openaiPreset.endpoint))audio.openaiPreset.endpoint='';
      $('#connection-base').value='';baseAddress='';$('#connection-token').value='';$('#connection-remember').checked=false;accessStatus();saveStatus.saved('gateway',{forgotten:true});
      $('#connection-base-status').textContent='Connection forgotten on this device and in this session. Learning progress, recordings, models and voices are kept.';
    }catch(error){saveStatus.failed('gateway');$('#connection-access-status').textContent=error.message;}
  };
  const editConnection=event=>{if(event.target.matches('input,select'))cancelConnect();};root.addEventListener('input',editConnection);root.addEventListener('change',editConnection);
  for(const kind of kinds)serviceStatus(kind,`${selectionText(kind)} · Not checked in this session.`);
  $('#connection-tts-device').onchange=()=>{deviceSelection=$('#connection-tts-device').value;};
  saveStatus.captureAll();deviceVoices();const voicesChanged=()=>deviceVoices();globalThis.speechSynthesis?.addEventListener('voiceschanged',voicesChanged);
  return ()=>{cancelConnect();dead=true;root.removeEventListener('input',editConnection);root.removeEventListener('change',editConnection);saveStatus.destroy();firebaseCleanup();for(const kind of kinds)abort(kind);globalThis.speechSynthesis?.removeEventListener('voiceschanged',voicesChanged);};
}
