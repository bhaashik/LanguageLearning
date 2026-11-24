import {clipKey,listClips,saveClip,exportAudio,importAudio,validateEndpoint} from './audio-store.js';
import {firebaseClient} from './firebase-client.js';
import {gatewayHeaders,requestTimeout} from './gateway.js';
import {nativeBridge} from './platform.js';
import {numberTargets} from './numbers.js';

const abortError=()=>new DOMException('Stopped','AbortError');
export function checkStopped(signal){if(signal?.aborted)throw abortError();}
export function pause(seconds,signal){
  checkStopped(signal);
  return new Promise((resolve,reject)=>{
    const finish=()=>{signal?.removeEventListener('abort',stop);resolve();};
    const timer=setTimeout(finish,seconds*1000);
    const stop=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);reject(abortError());};
    signal?.addEventListener('abort',stop,{once:true});
  });
}
export async function runNumberSequence(playlist,{play,wait=pause,onStep=()=>{},signal}){
  for(const [index,step] of playlist.entries()){
    checkStopped(signal);onStep(step,index,playlist.length);await play(step,signal);checkStopped(signal);
    if(step.pauseAfter)await wait(step.pauseAfter,signal);
  }
}
export function numberProfile(base,step,settings){
  if(!base||base.kind!=='service'||!['gemini','firebase'].includes(base.provider))throw Error('Connect a Gemini speech service in Connections & models, or choose device voices below.');
  if(!base.model)throw Error('Choose a Gemini speech model in Connections & models.');
  if(settings.male===settings.female)throw Error('Choose two different male and female voices.');
  return {...base,voice:step.voice,gender:step.gender,name:`Numbers · ${step.gender} · ${step.voice}`};
}
function playFile(blob,signal){
  checkStopped(signal);
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob),audio=new Audio(url);let finished=false;
    const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);audio.onended=audio.onerror=null;signal?.removeEventListener('abort',stop);audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url);error?reject(error):resolve();};
    const stop=()=>finish(abortError());
    const timer=setTimeout(()=>finish(Error('Audio playback timed out. Try this number again.')),90000);
    audio.onended=()=>finish();audio.onerror=()=>finish(Error('This saved audio could not play. Try another browser or import a different recording.'));
    signal?.addEventListener('abort',stop,{once:true});audio.play().catch(finish);
  });
}
export async function deviceVoices(){
  const bridge=nativeBridge();return bridge?await bridge.getVoices():globalThis.speechSynthesis?.getVoices()||[];
}
async function deviceSpeak(step,settings,signal){
  const key=step.target.language+(step.gender==='male'?'Male':'Female'),voices=await deviceVoices();checkStopped(signal);
  const voice=voices.find(v=>(v.voiceURI||v.name)===settings[key]&&v.lang.toLowerCase().replace('_','-').split('-')[0]===step.target.language);
  if(!voice)throw Error(`Select a ${step.gender} ${step.target.language==='ml'?'Malayalam':'English'} device voice. Voice gender must be selected by you; it cannot be detected reliably.`);
  if(nativeBridge()){
    const stop=()=>{void nativeBridge().stopSpeech().catch(()=>{});};signal?.addEventListener('abort',stop,{once:true});
    try{await nativeBridge().speak({text:step.target.ml,voice:voice.voiceURI||voice.name,lang:voice.lang});checkStopped(signal);}finally{signal?.removeEventListener('abort',stop);}return;
  }
  if(!globalThis.SpeechSynthesisUtterance)throw Error('Device speech is unavailable in this browser.');
  await new Promise((resolve,reject)=>{
    const u=new SpeechSynthesisUtterance(step.target.ml);
    const finish=error=>{signal?.removeEventListener('abort',stop);u.onend=u.onerror=null;error?reject(error):resolve();};
    const stop=()=>{globalThis.speechSynthesis.cancel();finish(abortError());};
    u.lang=voice.lang;u.voice=voice;u.rate=.8;u.onend=()=>finish();u.onerror=()=>finish(Error('Device speech failed. This voice may need internet.'));
    signal?.addEventListener('abort',stop,{once:true});globalThis.speechSynthesis.speak(u);
  });
}
export class NumbersAudio{
  constructor(){this.clips=[];}
  async load(){this.clips=(await listClips()).filter(c=>c.section==='numbers');}
  cached(step,base,settings){const profile=numberProfile(base,step,settings);return this.clips.find(c=>c.key===clipKey(step.target,profile)&&c.text===step.target.ml);}
  async generate(step,base,settings,signal){
    checkStopped(signal);const existing=this.cached(step,base,settings);if(existing)return existing.blob;
    const p=numberProfile(base,step,settings);let blob;
    if(p.provider==='firebase')blob=await firebaseClient.speech(step.target.ml,{model:p.model,voice:p.voice,language:step.target.language==='en'?'en-US':'ml-IN',signal});
    else{
      const endpoint=validateEndpoint(p.endpoint),request=requestTimeout(signal,45000);
      try{const response=await fetch(endpoint,{method:'POST',headers:gatewayHeaders(endpoint,{'Content-Type':'application/json','Accept':'audio/*'}),redirect:'error',signal:request.signal,body:JSON.stringify({input:step.target.ml,language:step.target.language==='en'?'en-US':'ml-IN',provider:p.provider,model:p.model,voice:p.voice,response_format:'mp3'})});
      if(response.status===401)throw Error('Connect with your gateway access code in Connections & models, then try again.');
      if(response.status===400&&step.target.language==='en')throw Error('The gateway rejected English speech. Update the Firebase gateway using the Numbers setup guide, then try again.');
      if(!response.ok)throw Error(`Speech returned HTTP ${response.status}. Completed recordings are saved; retry the range to resume. Check the gateway model and quota.`);
      if(!response.headers.get('content-type')?.startsWith('audio/'))throw Error('The speech service did not return audio.');
      blob=await response.blob();}finally{request.cleanup();}
    }
    checkStopped(signal);const clip=await saveClip(step.target,p,blob,'generated');this.clips.push(clip);return blob;
  }
  async play(step,base,settings,signal){
    if(settings.source==='device')return deviceSpeak(step,settings,signal);
    const blob=await this.generate(step,base,settings,signal);checkStopped(signal);await playFile(blob,signal);
  }
  async export(playlist,base,settings){
    const clips=playlist.map(step=>this.cached(step,base,settings));
    if(clips.some(c=>!c))throw Error('Generate the selected range first. All four recordings per number are needed for this export.');
    if(clips.reduce((sum,c)=>sum+c.blob.size,0)>100*1024*1024)throw Error('Export a smaller range to keep the backup under 100 MB.');
    return exportAudio(clips);
  }
  async import(file){const count=await importAudio(file,numberTargets);await this.load();return count;}
  async recording(playlist,base,settings,signal){
    const context=new (globalThis.AudioContext||globalThis.webkitAudioContext)(),segments=[];
    try{
      for(const step of playlist){
        checkStopped(signal);const clip=this.cached(step,base,settings);if(!clip)throw Error('Generate the selected range first, then download its recording.');
        const audio=await context.decodeAudioData(await clip.blob.arrayBuffer());
        const length=Math.ceil(audio.duration*24000),samples=new Float32Array(length);
        for(let i=0;i<length;i++){
          const at=i*audio.sampleRate/24000,left=Math.floor(at),fraction=at-left;
          for(let channel=0;channel<audio.numberOfChannels;channel++){const data=audio.getChannelData(channel);samples[i]+=((data[left]||0)*(1-fraction)+(data[left+1]||0)*fraction)/audio.numberOfChannels;}
        }
        segments.push({samples,pauseAfter:step.pauseAfter});
        if(segments.reduce((sum,s)=>sum+s.samples.length+Math.round(s.pauseAfter*24000),0)>50*1024*1024)throw Error('Choose a smaller range for a recording under 100 MB.');
      }
      checkStopped(signal);return numberWav(segments);
    }finally{await context.close();}
  }
}
// Mono 24 kHz PCM WAV. Silence is included in the file, not just in playback.
export function numberWav(segments,rate=24000){
  const length=segments.reduce((sum,s)=>sum+s.samples.length+Math.round(s.pauseAfter*rate),0);
  if(length>50*1024*1024)throw Error('Choose a smaller range for a recording under 100 MB.');
  const buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);let at=44;
  const text=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
  for(const segment of segments){for(const sample of segment.samples){const value=Math.max(-1,Math.min(1,sample));view.setInt16(at,Math.round(value*(value<0?32768:32767)),true);at+=2;}at+=Math.round(segment.pauseAfter*rate)*2;}
  return new Blob([buffer],{type:'audio/wav'});
}
