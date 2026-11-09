import {firebaseClient} from './firebase-client.js';
import {clipKey,validateEndpoint,listClips,saveClip,deleteClip,exportAudio,importAudio} from './audio-store.js';
import {OPENAI_DEFAULT_MODEL,OPENAI_DEFAULT_VOICE} from './speech-presets.js';
import {nativeBridge,defaultGateway,randomId} from './platform.js';
import {restoreGateway,gatewayHeaders} from './gateway.js';
const PREF='bhaasa.voices.v1';
const defaults=[{id:'device',kind:'device',name:'Device Malayalam voice',provider:'device',model:'speech-synthesis',voice:'default',gender:'unspecified'},{id:'human',kind:'recording',name:'My recordings',provider:'human',model:'microphone-or-file',voice:'my-voice',gender:'unspecified'}];
export class AudioLibrary {
  constructor(notify,language='ml'){
    this.language=language;this.languageName=language==='fr'?'French':'Malayalam';this.locale=language==='fr'?'fr-FR':'ml-IN';this.prefKey=language==='ml'?PREF:`bhaasa.voices.${language}.v1`;this.defaults=structuredClone(defaults);this.defaults[0].name=`Device ${this.languageName} voice`;
    this.notify=notify;this.profiles=structuredClone(this.defaults);this.activeId='device';this.autoSave=true;this.clips=[];this.voices=[];this.playback=null;this.playURL=null;this.busy=false;this.recorder=null;this.stream=null;this.recordTarget=null;this.onChange=()=>{};
    this.openaiPreset={model:OPENAI_DEFAULT_MODEL,voice:OPENAI_DEFAULT_VOICE,endpoint:defaultGateway('speech'),status:''};
    try{const p=JSON.parse(localStorage.getItem(this.prefKey));if(p&&Array.isArray(p.profiles)){
      this.profiles=[...this.defaults,...p.profiles.filter(p=>!['device','human'].includes(p.id)&&['device','service','recording'].includes(p.kind)&&['id','name','provider','model','voice'].every(k=>typeof p[k]==='string'&&p[k].length<250)).slice(0,50).map(p=>({...p,...(p.kind==='service'?{endpoint:p.provider==='firebase'?'':restoreGateway(p.endpoint,'speech')}:{})}))];
      if(this.profiles.some(v=>v.id===p.activeId))this.activeId=p.activeId;this.autoSave=p.autoSave!==false;
    }}catch{/* Fall back to local defaults without blocking lessons. */}
    const selected=this.active,openai=selected.kind==='service'&&selected.provider==='openai'?selected:[...this.profiles].reverse().find(p=>p.kind==='service'&&p.provider==='openai');
    if(openai)this.openaiPreset={...this.openaiPreset,endpoint:openai.endpoint||'',model:openai.model,voice:openai.voice};
  }
  get active(){return this.profiles.find(p=>p.id===this.activeId)||this.profiles[0];}
  async languageClips(){return (await listClips()).filter(c=>(c.language||'ml')===this.language);}
  async load(){try{this.clips=await this.languageClips();}catch(e){this.storageError=e.message;}await this.refreshVoices();}
  async refreshVoices(){
    const bridge=nativeBridge();
    try{const voices=bridge?await bridge.getVoices():window.speechSynthesis?.getVoices()||[];this.voices=voices.filter(v=>v.lang.toLowerCase().replace('_','-').split('-')[0]===this.language);}catch{this.voices=[];}
    return this.voices;
  }
  persist(){try{localStorage.setItem(this.prefKey,JSON.stringify({profiles:this.profiles,activeId:this.activeId,autoSave:this.autoSave}));}catch{this.notify('Voice preferences could not be saved in this browser.');}}
  choose(id){if(this.profiles.some(p=>p.id===id)){this.activeId=id;this.persist();}}
  add(profile){
    if(!['service','recording','device'].includes(profile.kind)||!['name','provider','model','voice'].every(k=>typeof profile[k]==='string'&&profile[k].trim()&&profile[k].length<200))throw Error('Give this voice a name, provider, model, and voice identifier.');
    if(profile.kind==='service')profile.endpoint=profile.provider==='firebase'?'':validateEndpoint(profile.endpoint);
    profile.id=randomId();this.profiles.push(profile);this.activeId=profile.id;this.persist();return profile;
  }
  cached(target,profile=this.active){return this.clips.find(c=>c.key===clipKey(target,profile)&&c.text===target.ml);}
  async refresh(){this.clips=await this.languageClips();this.onChange();}
  async store(target,profile,blob,origin){const clip=await saveClip(target,profile,blob,origin);await this.refresh();return clip;}
  stopPlayback(){this.playback?.pause();if(this.playURL)URL.revokeObjectURL(this.playURL);this.playURL=null;window.speechSynthesis?.cancel();return nativeBridge()?.stopSpeech().catch(()=>{});}
  async playBlob(blob){await this.stopPlayback();this.playURL=URL.createObjectURL(blob);this.playback=new Audio(this.playURL);await this.playback.play();}
  async play(target){
    const cached=this.cached(target);if(cached){await this.playBlob(cached.blob);return;}
    const p=this.active;
    if(p.kind==='device'){
      await this.refreshVoices();const voice=p.voice==='default'?this.voices[0]:this.voices.find(v=>v.voiceURI===p.voice||v.name===p.voice);
      if(nativeBridge()){
        if(!voice)throw Error(`No ${this.languageName} device voice is installed. Install one in the device speech settings, or use recordings/a speech gateway.`);
        await this.stopPlayback();await nativeBridge().speak({text:target.ml,voice:voice.voiceURI||voice.name,lang:voice.lang});return;
      }
      if(!voice||!window.SpeechSynthesisUtterance)throw Error(`No ${this.languageName} voice found. Open Voices & recordings to choose or add audio.`);
      this.stopPlayback();const u=new SpeechSynthesisUtterance(target.ml);u.lang=voice.lang;u.voice=voice;u.rate=.8;u.onerror=()=>this.notify('Speech could not play. This device voice may require internet.');window.speechSynthesis.speak(u);return;
    }
    if(p.kind==='recording')throw Error('No recording for this item and voice yet. Open Voices & recordings to record or import one.');
    const blob=await this.generate(target,false,this.autoSave);await this.playBlob(blob);
  }
  async generate(target,replace=false,save=true){
    if(this.busy)throw Error('An audio request is already running.');
    if(!replace&&this.cached(target))return this.cached(target).blob;
    const p={...this.active};if(p.kind!=='service')throw Error('Device speech cannot be captured as an audio file by this browser. Use a connected speech service or a recording.');
    if(target.ml.length>10000)throw Error('This text is too long for one request. Choose a lesson or a smaller item.');
    if(p.provider==='openai'&&target.ml.length>4096)throw Error('Choose a smaller item or lesson: OpenAI generation is limited to 4096 characters per request.');
    this.busy=true;this.onChange();
    try{
      if(p.provider==='firebase'){const blob=await firebaseClient.speech(target.ml,{model:p.model,voice:p.voice,language:this.locale});if(save)await this.store(target,p,blob,'generated');return blob;}
      const endpoint=validateEndpoint(p.endpoint),response=await fetch(endpoint,{method:'POST',headers:gatewayHeaders(endpoint,{'Content-Type':'application/json','Accept':'audio/*'}),redirect:'error',body:JSON.stringify({input:target.ml,language:this.locale,provider:p.provider,model:p.model,voice:p.voice,response_format:'mp3'}),signal:AbortSignal.timeout(45000)});
      if(response.status===401)throw Error('Save the gateway access token in Connections & models, then try again.');
      if(!response.ok)throw Error(`The speech service returned HTTP ${response.status}. Check its provider, model, voice, and server-side credentials.`);
      if(!response.headers.get('content-type')?.startsWith('audio/'))throw Error('The speech service did not return an audio file.');
      const blob=await response.blob();if(save)await this.store(target,p,blob,'generated');return blob;
    } finally{this.busy=false;this.onChange();}
  }
  async startRecording(target){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Microphone recording needs a supported browser over HTTPS or localhost. You can still import audio files.');
    if(this.recorder)throw Error('Stop the current recording first.');
    if(this.active.kind!=='recording')this.choose('human');
    const profile={...this.active};
    this.stream=await navigator.mediaDevices.getUserMedia({audio:true});
    try{
      const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
      const recorder=new MediaRecorder(this.stream,type?{mimeType:type}:{}),chunks=[];
      this.recorder=recorder;this.recordTarget=target;
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=async()=>{
        this.releaseMicrophone();
        try{const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});await this.store(target,profile,blob,'microphone');this.notify('Recording saved for this item and voice.');}catch(e){this.notify(e.message);}
      };
      recorder.onerror=()=>{this.releaseMicrophone();this.notify('Recording failed. Check microphone permission or import a file.');};
      recorder.start();this.onChange();
      this.recordTimer=setTimeout(()=>this.stopRecording(),120000);
    }catch(e){this.releaseMicrophone();throw e;}
  }
  releaseMicrophone(){clearTimeout(this.recordTimer);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.recorder=null;this.recordTarget=null;this.onChange();}
  stopRecording(){if(this.recorder?.state==='recording')this.recorder.stop();}
  async remove(key){await deleteClip(key);await this.refresh();}
  async export(scope='all',target){
    const selected=this.clips.filter(c=>scope==='all'||(scope==='section'&&c.section===target.section)||(scope==='item'&&c.itemId===target.id)||(scope==='voice'&&c.provider===this.active.provider&&c.model===this.active.model&&c.voice===this.active.voice));
    if(!selected.length)throw Error('No saved clips match this export selection.');
    if(selected.reduce((n,c)=>n+c.blob.size,0)>100*1024*1024)throw Error('Export a smaller selection: choose a section, voice, or item to keep the backup under 100 MB.');
    return exportAudio(selected);
  }
  async import(file,targets,overwrite){
    const count=await importAudio(file,targets,overwrite);this.clips=await this.languageClips();
    const active=this.activeId;
    for(const clip of this.clips)if(!this.profiles.some(p=>p.provider===clip.provider&&p.model===clip.model&&p.voice===clip.voice)){
      this.add({kind:'recording',name:`${clip.profileName} (imported audio)`,provider:clip.provider,model:clip.model,voice:clip.voice,gender:clip.gender});
    }
    this.activeId=active;this.persist();this.onChange();return count;
  }
}
