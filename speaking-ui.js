import {firebaseClient} from './firebase-client.js';
import {ASR_PROVIDERS,loadASRSettings,saveASRSettings,transcribeAudio} from './asr.js';
import {compareSpeech} from './speech-learning.js';
import {helpLinkAttributes,isNativeApp,isPagesApp} from './platform.js';
import {gatewayJSON} from './gateway.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function speakingPanel(item,saved){return `<section class="panel speaking-panel" aria-labelledby="speech-heading"><p class="eyebrow">LISTEN · SAY IT · CHECK THE WORDS</p><h2 id="speech-heading">Try saying the whole phrase.</h2><p>Listen to the model, then read or recall the phrase aloud. ASR checks the words it heard. It cannot certify pronunciation, accent, or silent French agreement endings.</p><div class="button-row"><button class="button primary" id="speech-record">Start speaking</button><button class="button secondary" id="speech-stop" disabled>Stop recording</button><button class="button secondary" id="speech-check" disabled>Check my speech</button><button class="button secondary" id="speech-cancel" disabled>Cancel</button><label class="button secondary file-button">Use audio file<input id="speech-file" type="file" accept="audio/*"></label></div><p id="speech-status" role="status"></p><div id="speech-result" aria-live="polite">${saved?`<p><strong>Last saved transcript:</strong> ${esc(saved.lastTranscript)}</p><p>${Math.round(saved.lastCoverage*100)}% word overlap · ${saved.matches}/${saved.attempts} transcript matches. This is separate from grammar-quiz accuracy.</p>`:''}</div><div class="button-row"><button class="button secondary small" id="speech-play" disabled>Play my recording</button><button class="button secondary small" id="speech-save" disabled>Save to My recordings</button></div><p><a href="#connections">Connections &amp; models · choose OCR, TTS, and ASR</a></p><details class="speech-settings" ${isPagesApp()?'open':''}><summary>Recognition provider &amp; connection</summary><p>Device/browser ASR may use its vendor’s online service. Gateway mode records locally and sends audio only when you press Check my speech. No expected answer is sent. Failed/empty requests are not scored or retried automatically.</p><div class="form-grid"><label>ASR provider<select id="speech-provider">${ASR_PROVIDERS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label>Model ID · blank uses server default<input id="speech-model" maxlength="150" placeholder="Gateway default"></label></div><label class="stacked">ASR gateway<input type="url" id="speech-endpoint" maxlength="1000" placeholder="https://your-gateway.example/api/transcribe"></label><p>${isNativeApp()||isPagesApp()?'Use an HTTPS gateway reachable by this device. GitHub Pages has no transcription API; localhost on this device is not your desktop computer.':'The local Bhaasa server provides /api/transcribe. Keep provider keys on the server, never in this page.'}</p><button class="button secondary small" id="speech-connection">Check ASR connection</button><p id="speech-connection-status" role="status"></p><a href="./docs/SPEAKING.html" ${helpLinkAttributes()}>Speech and spaced-review setup guide</a></details></section>`;}

export function setupSpeaking({item,locale,audio,onResult,notify}){
  const find=id=>document.getElementById(id),settings=loadASRSettings(item.language||'ml');
  let recorder,stream,recognition,blob,url,player,timer,request,dead=false,recording=false,busy=false,judged=false,completed=false,operation=0;
  const profile=()=>({provider:settings.provider,...settings.profiles[settings.provider]});
  const status=text=>{if(!dead)find('speech-status').textContent=text;};
  const persist=()=>saveASRSettings(item.language||'ml',settings);
  function sync(){if(dead)return;const browser=settings.provider==='browser',supported=Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);
    find('speech-record').disabled=recording||busy||browser&&!supported;
    find('speech-stop').disabled=!recording;find('speech-cancel').disabled=!recording&&!busy;find('speech-check').disabled=recording||busy||browser||!blob||judged||settings.provider!=='firebase'&&!profile().endpoint.trim();
    find('speech-play').disabled=!blob||recording||busy;find('speech-save').disabled=!blob||recording||busy;
    find('speech-model').disabled=browser;find('speech-endpoint').disabled=browser||settings.provider==='firebase';find('speech-connection').disabled=browser||busy;
  }
  function release(){clearTimeout(timer);stream?.getTracks().forEach(track=>track.stop());stream=null;recording=false;recorder=null;}
  function cancel(){operation++;request?.abort();request=null;if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition.abort();recognition=null;}if(recorder){recorder.onstop=null;recorder.onerror=null;recorder.ondataavailable=null;if(recorder.state==='recording')recorder.stop();}release();busy=false;}
  function result(text,source){
    if(dead)return;if(!text.trim()){status('No readable speech was recognized. Nothing was scored; try again or choose another provider.');return;}
    const answer=compareSpeech(text,item);find('speech-result').innerHTML=`<h3>${answer.matched?'The transcript matches.':'Compare what was heard.'}</h3><p><strong>ASR heard:</strong> ${esc(text)}</p><p><strong>Target:</strong> <span lang="${item.language||'ml'}">${esc(item.ml)}</span></p><p>${Math.round(answer.coverage*100)}% word overlap · ${answer.matched?'same words after punctuation/case normalization':'different words or spelling'}. Review recognition errors before treating this as a learning error.</p><p>${item.language==='fr'?'Written grammar practice is needed for silent inflections.':''}</p>`;
    if(!judged){onResult({...answer,source});judged=true;}status('Result saved once for this attempt. Record again for another attempt.');
  }
  async function start(){
    cancel();const current=operation;busy=true;sync();player?.pause();await audio.stopPlayback();if(dead||current!==operation)return;judged=false;completed=false;blob=null;find('speech-result').innerHTML='';
    if(settings.provider==='browser'){
      const API=window.SpeechRecognition||window.webkitSpeechRecognition;if(!API)return;
      recognition=new API();recognition.lang=locale;recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
      recognition.onresult=event=>{if(completed||dead)return;completed=true;recording=false;clearTimeout(timer);result(event.results[event.resultIndex||0][0].transcript,'browser');sync();};
      recognition.onerror=event=>{if(dead)return;recording=false;clearTimeout(timer);status(event.error==='not-allowed'?'Microphone/recognition permission was denied. Change device/browser permissions or choose a gateway and import audio.':`Browser recognition could not complete (${event.error}). Nothing was scored.`);sync();};
      recognition.onend=()=>{recording=false;clearTimeout(timer);if(!completed)status('Recognition ended without a transcript. Nothing was scored.');sync();};
      recording=true;busy=false;recognition.start();timer=setTimeout(()=>recognition?.stop(),60000);status('Listening… Speak the phrase, then pause or press Stop recording.');sync();return;
    }
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Recording needs microphone access on HTTPS/localhost. You can import an audio file instead.');
    let candidate;try{candidate=await navigator.mediaDevices.getUserMedia({audio:true});}catch(error){if(dead||current!==operation)return;throw error;}
    if(dead||current!==operation){candidate.getTracks().forEach(track=>track.stop());return;}stream=candidate;
    try{
      const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t)),chunks=[];
      const active=new MediaRecorder(stream,type?{mimeType:type}:{});recorder=active;
      active.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      active.onstop=()=>{blob=new Blob(chunks,{type:active.mimeType||'audio/webm'});release();if(dead)return;if(blob.size>10*1024*1024){blob=null;status('That recording exceeded 10 MB. Make a shorter recording.');}else status((settings.provider==='firebase'||profile().endpoint.trim())?'Recording ready. Press Check my speech to send it.':'Recording ready. Enter a reachable ASR gateway in connection settings to check it.');sync();};
      active.onerror=()=>{release();status('Recording failed. Check microphone access or import a file.');sync();};
      active.start();recording=true;busy=false;timer=setTimeout(()=>recorder?.state==='recording'&&recorder.stop(),60000);status('Recording locally… Stop when you finish the phrase.');sync();
    }catch(error){release();throw error;}
  }
  find('speech-provider').value=settings.provider;
  function showProfile(){find('speech-endpoint').value=profile().endpoint;find('speech-model').value=profile().model;status(settings.provider==='browser'?(window.SpeechRecognition||window.webkitSpeechRecognition?'Ready for device/browser recognition. It may need internet.':'This browser has no recognition API. Choose a gateway provider to record or import audio.'):settings.provider==='firebase'?'Record or import a phrase, then check it directly with Firebase AI Logic. Configure Firebase in Connections & models. Maximum one minute / 10 MB.':'Record or import a phrase, then check it with your ASR gateway. Maximum one minute / 10 MB.');sync();}
  find('speech-provider').onchange=()=>{cancel();settings.provider=find('speech-provider').value;persist();showProfile();};
  for(const [id,key] of [['speech-endpoint','endpoint'],['speech-model','model']])find(id).oninput=()=>{settings.profiles[settings.provider][key]=find(id).value;persist();sync();};
  find('speech-record').onclick=()=>start().catch(error=>{busy=false;release();status(error.message);sync();});
  find('speech-stop').onclick=()=>{if(recognition)recognition.stop();else if(recorder?.state==='recording')recorder.stop();};
  find('speech-cancel').onclick=()=>{cancel();status('Speech request cancelled. Nothing was scored.');sync();};
  find('speech-check').onclick=async()=>{
    if(!blob||judged||busy)return;const current=operation;busy=true;request=new AbortController();sync();status('Transcribing your recording…');
    try{const data=await transcribeAudio(blob,profile(),item.language||'ml',request.signal);if(!dead&&current===operation)result(data.text,settings.provider);}catch(error){if(!dead&&current===operation)status(error.name==='AbortError'?'Transcription cancelled; nothing scored.':error.message);}finally{if(current===operation){busy=false;if(!dead)sync();}}
  };
  find('speech-file').onchange=event=>{cancel();const file=event.target.files[0];event.target.value='';if(!file)return;blob=null;judged=false;find('speech-result').innerHTML='';if(!file.type.startsWith('audio/')||file.size>10*1024*1024){status('Choose an audio file under 10 MB.');sync();return;}blob=file;status('Audio file ready. Press Check my speech to send it.');sync();};
  find('speech-play').onclick=async()=>{try{await audio.stopPlayback();player?.pause();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);player=new Audio(url);await player.play();}catch(error){notify(error.message);}};
  find('speech-save').onclick=async()=>{try{await audio.store(item,audio.profiles.find(p=>p.id==='human'),blob,'speaking-practice');notify('Your practice audio was saved under My recordings.');}catch(error){notify(error.message);}};
  find('speech-connection').onclick=async()=>{const label=find('speech-connection-status');try{if(settings.provider==='firebase'){await firebaseClient.check();if(!dead)label.textContent='Firebase App Check token obtained. No recording was sent; model access and quota still need an explicit sample.';return;}const data=await gatewayJSON(profile().endpoint),p=data.providers?.find(p=>p.id===settings.provider);label.textContent=p?.configured?`Provider configured. Enabled models: ${p.models.join(', ')||'adapter default'}. No recording was sent; access, quota, and accuracy still need an explicit sample.`:'This provider is not configured. Set its BHAASA_ASR variables on the server and restart.';}catch(error){label.textContent=error.message;}};
  showProfile();return {cleanup:()=>{dead=true;cancel();player?.pause();if(url)URL.revokeObjectURL(url);},pause:()=>{cancel();player?.pause();status('Speech practice paused. Start again when you are ready.');sync();}};
}
