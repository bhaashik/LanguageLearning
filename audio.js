import {clipKey,validateEndpoint,listClips,saveClip,deleteClip,exportAudio,importAudio} from './audio-store.js';
const PREF='bhaasa.voices.v1';
const defaults=[{id:'device',kind:'device',name:'Device Malayalam voice',provider:'device',model:'speech-synthesis',voice:'default',gender:'unspecified'},{id:'human',kind:'recording',name:'My recordings',provider:'human',model:'microphone-or-file',voice:'my-voice',gender:'unspecified'}];
export class AudioLibrary {
  constructor(notify){
    this.notify=notify;this.profiles=structuredClone(defaults);this.activeId='device';this.autoSave=true;this.clips=[];this.voices=[];this.playback=null;this.playURL=null;this.busy=false;this.recorder=null;this.stream=null;this.recordTarget=null;this.onChange=()=>{};
    try{const p=JSON.parse(localStorage.getItem(PREF));if(p&&Array.isArray(p.profiles)){
      this.profiles=[...defaults,...p.profiles.filter(p=>!['device','human'].includes(p.id)&&['device','service','recording'].includes(p.kind)&&['id','name','provider','model','voice'].every(k=>typeof p[k]==='string'&&p[k].length<250)&&(!p.endpoint||validateEndpoint(p.endpoint))).slice(0,50)];
      if(this.profiles.some(v=>v.id===p.activeId))this.activeId=p.activeId;this.autoSave=p.autoSave!==false;
    }}catch{/* Fall back to local defaults without blocking lessons. */}
  }
  get active(){return this.profiles.find(p=>p.id===this.activeId)||this.profiles[0];}
  async load(){try{this.clips=await listClips();}catch(e){this.storageError=e.message;}this.refreshVoices();}
  refreshVoices(){this.voices=(window.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.toLowerCase().replace('_','-').startsWith('ml'));}
  persist(){try{localStorage.setItem(PREF,JSON.stringify({profiles:this.profiles,activeId:this.activeId,autoSave:this.autoSave}));}catch{this.notify('Voice preferences could not be saved in this browser.');}}
  choose(id){if(this.profiles.some(p=>p.id===id)){this.activeId=id;this.persist();}}
  add(profile){
    if(!['service','recording','device'].includes(profile.kind)||!['name','provider','model','voice'].every(k=>typeof profile[k]==='string'&&profile[k].trim()&&profile[k].length<200))throw Error('Give this voice a name, provider, model, and voice identifier.');
    if(profile.kind==='service')profile.endpoint=validateEndpoint(profile.endpoint);
    profile.id=crypto.randomUUID();this.profiles.push(profile);this.activeId=profile.id;this.persist();return profile;
  }
  cached(target,profile=this.active){return this.clips.find(c=>c.key===clipKey(target,profile)&&c.text===target.ml);}
  async refresh(){this.clips=await listClips();this.onChange();}
  async store(target,profile,blob,origin){const clip=await saveClip(target,profile,blob,origin);await this.refresh();return clip;}
  stopPlayback(){this.playback?.pause();if(this.playURL)URL.revokeObjectURL(this.playURL);this.playURL=null;window.speechSynthesis?.cancel();}
  async playBlob(blob){this.stopPlayback();this.playURL=URL.createObjectURL(blob);this.playback=new Audio(this.playURL);await this.playback.play();}
  async play(target){
    const cached=this.cached(target);if(cached){await this.playBlob(cached.blob);return;}
    const p=this.active;
    if(p.kind==='device'){
      this.refreshVoices();const voice=p.voice==='default'?this.voices[0]:this.voices.find(v=>v.voiceURI===p.voice||v.name===p.voice);
      if(!voice||!window.SpeechSynthesisUtterance)throw Error('No Malayalam voice found. Open Voices & recordings to choose or add audio.');
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
    this.busy=true;this.onChange();
    try{
      const response=await fetch(validateEndpoint(p.endpoint),{method:'POST',headers:{'Content-Type':'application/json','Accept':'audio/*'},body:JSON.stringify({input:target.ml,language:'ml-IN',provider:p.provider,model:p.model,voice:p.voice,response_format:'mp3'}),signal:AbortSignal.timeout(45000)});
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
    const count=await importAudio(file,targets,overwrite);this.clips=await listClips();
    const active=this.activeId;
    for(const clip of this.clips)if(!this.profiles.some(p=>p.provider===clip.provider&&p.model===clip.model&&p.voice===clip.voice)){
      this.add({kind:'recording',name:`${clip.profileName} (imported audio)`,provider:clip.provider,model:clip.model,voice:clip.voice,gender:clip.gender});
    }
    this.activeId=active;this.persist();this.onChange();return count;
  }
}
