import {numbers,numbersCSV,numberSettings,numberPlaylist} from './numbers.js';
import {NumbersAudio,runNumberSequence,deviceVoices,numberProfile,checkStopped} from './numbers-audio.js';
import {AudioLibrary} from './audio.js';
import {exportFile,nativeBridge} from './platform.js';
const KEY='bhaasa.numbers.v1';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadSettings(){try{return numberSettings(JSON.parse(localStorage.getItem(KEY))||{});}catch{return numberSettings();}}
export function numbersPage(){
  const s=loadSettings();
  return `<section id="numbers-section"><header class="page-heading"><div><p class="eyebrow">MALAYALAM + ENGLISH</p><h1>Numbers 1–100</h1><p class="description">Learn the words, compare the sounds, and listen in two voices.</p></div><button class="text-button" data-numbers="list">Download the full list (CSV)</button></header>
  <section class="panel numbers-controls" aria-labelledby="numbers-audio-heading"><h2 id="numbers-audio-heading">Listen &amp; save recordings</h2>
  <p>Malayalam male → Malayalam female → English male → English female. Saved recordings play offline. Missing recordings are generated with your connected Gemini service and saved on this device.</p>
  <form id="numbers-settings"><div class="numbers-fields"><label>Audio source<select name="source"><option value="service" ${s.source==='service'?'selected':''}>Gemini service &amp; saved recordings</option><option value="device" ${s.source==='device'?'selected':''}>Device voices (read aloud)</option></select></label>
  <label>First number<input name="from" type="number" min="1" max="100" step="1" value="${s.from}" required></label><label>Last number<input name="to" type="number" min="1" max="100" step="1" value="${s.to}" required></label></div>
  <div class="numbers-service"><p><strong>Male: Charon · Female: Kore.</strong> Uses your Malayalam speech connection. <a href="#connections">Connections &amp; models</a></p><p id="numbers-connection"></p></div>
  <div class="numbers-device" ${s.source==='device'?'':'hidden'}><p>Select each voice after checking its sound. Device voice gender is not reported reliably. Device speech cannot be saved as a recording by this app.</p><div class="numbers-fields">${[['mlMale','Malayalam male'],['mlFemale','Malayalam female'],['enMale','English male'],['enFemale','English female']].map(([key,label])=>`<label>${label}<select name="${key}" data-device-language="${key.slice(0,2)}"><option value="">Choose a voice</option></select></label>`).join('')}</div><button type="button" class="text-button" data-numbers="voices">Refresh device voices</button></div>
  <details><summary>Pauses &amp; playback settings</summary><div class="numbers-fields">${[['voicePause','Between male & female',.2,5],['languagePause','Between Malayalam & English',.2,5],['numberPause','Between numbers',.5,10]].map(([key,label,min,max])=>`<label>${label} (seconds)<input name="${key}" type="number" step="0.1" min="${min}" max="${max}" value="${s[key]}" required></label>`).join('')}</div><p>The pause between numbers must be longer than the other pauses.</p></details>
  <button class="text-button" type="submit">Save playback settings</button><p id="numbers-settings-status" role="status"></p></form>
  <div class="numbers-actions"><button class="button primary" data-numbers="play">Play selected range</button><button class="button secondary" data-numbers="generate">Generate &amp; save range</button><button class="button secondary" data-numbers="stop" disabled>Stop</button><button class="button secondary" data-numbers="wav">Download range WAV</button><button class="button secondary" data-numbers="export">Export recordings ZIP</button><label class="button secondary">Import recordings ZIP<input type="file" accept=".zip,application/zip" id="numbers-import" hidden></label></div>
  <p>Four clips per number, up to 400 for the full list. Generation uses your service quota. Completed clips are kept if you stop or a request fails. WAV includes all voices and pauses; ZIP contains separate recordings. Generate a range once before downloading it.</p>
  <p id="numbers-status" role="status" aria-live="polite">Loading saved recordings…</p><p id="numbers-saved"></p></section>
  <details class="panel numbers-notes"><summary>Pronunciation, glosses &amp; sources</summary><p>IPA is a broad teaching approximation; Malayalam pronunciation varies by speaker and region. IAST uses Malayalam extensions: ḻ = ഴ, ṟ = റ, and ŭ = the short reduced final vowel, shown here as /ɯ/. This vowel may sound more central. Plain Roman is a pronunciation aid: doubled vowels are long; doubled consonants are held longer; “th” is a dental t, not English “thin”; “zh” approximates ഴ. Listen for the actual sounds.</p><p>Glosses show meaning: a hyphen separates parts and LINK marks a joining sound. The full linking forms (such as ഇരുപത്തിയൊന്ന്) are used consistently; shorter forms (ഇരുപത്തൊന്ന്) are also common. The irregular teens are shown as whole words. Synthetic voices and transcriptions need Malayalam speaker review.</p><p><a href="https://morph.smc.org.in/cardinals.html" target="_blank" rel="noopener">SMC: Malayalam number formation</a> · <a href="https://docs.cloud.google.com/text-to-speech/docs/gemini-tts" target="_blank" rel="noopener">Google: Gemini voices</a> · <a href="./docs/NUMBERS.md" target="_blank" rel="noopener">Numbers &amp; gateway setup guide</a></p></details>
  <div class="numbers-list">${numbers.map(n=>`<article class="panel number-card" id="number-${n.value}" aria-labelledby="number-heading-${n.value}"><header><h2 id="number-heading-${n.value}">${n.digits}<span lang="ml">${n.malayalamDigits}</span></h2><p lang="en">${n.english}</p></header><p class="number-malayalam" lang="ml">${n.ml}</p><dl><dt>IPA</dt><dd class="number-ipa">${n.ipa}</dd><dt>IAST</dt><dd>${n.iast}</dd><dt>Plain Roman</dt><dd>${n.roman}</dd><dt>IAST gloss</dt><dd>${n.gloss.map(g=>g.iast).join('-')}<br><small>${n.gloss.map(g=>g.meaning).join('-')}</small></dd><dt>Roman gloss</dt><dd>${n.gloss.map(g=>g.roman).join('-')}<br><small>${n.gloss.map(g=>g.meaning).join('-')}</small></dd></dl><div class="numbers-actions"><button class="button secondary" data-numbers="one" data-number="${n.value}">Listen to ${n.value}</button><button class="text-button" data-numbers="one-wav" data-number="${n.value}">Download WAV</button></div></article>`).join('')}</div></section>`;
}
export function setupNumbers({audio,notify}){
  const root=document.querySelector('#numbers-section'),form=root.querySelector('form'),status=root.querySelector('#numbers-status'),library=new NumbersAudio();
  // The number course always teaches Malayalam + English, including from the French UI.
  const connection=audio.language==='ml'?audio:new AudioLibrary(notify,'ml');
  let settings=loadSettings(),controller=null,alive=true,loading;
  const say=text=>{if(alive)status.textContent=text;};
  const read=()=>{
    if(!form.reportValidity())throw Error('Check the number range and pause values.');
    const value=Object.fromEntries(new FormData(form));for(const key of ['from','to','voicePause','languagePause','numberPause'])value[key]=Number(value[key]);
    const next=numberSettings({...value,male:'Charon',female:'Kore'});numberPlaylist(next.from,next.to,next);return next;
  };
  const base=()=>connection.active;
  const count=()=>{
    if(!alive)return;
    let matching=0;try{matching=numberPlaylist(1,100,settings).filter(step=>library.cached(step,base(),settings)).length;}catch{/* No speech connection selected yet. */}
    root.querySelector('#numbers-saved').textContent=`${matching} of 400 recordings saved for the selected model and voices. ${library.clips.length} number recordings in total on this device.`;
    const p=base();root.querySelector('#numbers-connection').textContent=p.kind==='service'?`Speech connection: ${p.provider} · ${p.model}`:'Choose a Gemini speech connection, or select installed device voices.';
  };
  const save=()=>{
    settings=read();const at=new Date();localStorage.setItem(KEY,JSON.stringify({...settings,savedAt:at.toISOString()}));
    root.querySelector('#numbers-settings-status').textContent=`Saved on this device · ${at.toLocaleString()}`;count();
  };
  const toggle=()=>{root.querySelector('.numbers-device').hidden=settings.source!=='device';root.querySelector('.numbers-service').hidden=settings.source==='device';};
  const refreshVoices=async()=>{
    const voices=await deviceVoices();if(!alive)return;
    for(const select of root.querySelectorAll('[data-device-language]')){
      const previous=select.value||settings[select.name]||'';select.replaceChildren(new Option('Choose a voice',''));
      for(const voice of voices.filter(v=>v.lang.toLowerCase().replace('_','-').split('-')[0]===select.dataset.deviceLanguage))select.add(new Option(`${voice.name} · ${voice.lang}`,voice.voiceURI||voice.name));
      select.value=previous;
    }
  };
  const stop=()=>{controller?.abort();globalThis.speechSynthesis?.cancel();void nativeBridge()?.stopSpeech().catch(()=>{});};
  const busy=value=>{
    for(const button of root.querySelectorAll('button[data-numbers]'))button.disabled=button.dataset.numbers==='stop'?!value:value;
    for(const input of form.elements)input.disabled=value;
    root.querySelector('#numbers-import').disabled=value;
  };
  async function operate(action,number){
    if(controller)return;
    const task=new AbortController();controller=task;
    try{
      save();const s={...settings},from=number||s.from,to=number||s.to,playlist=numberPlaylist(from,to,s),profile={...base()};
      busy(true);await loading;checkStopped(task.signal);
      if(action==='play'||action==='one'){
        if(s.source==='service')numberProfile(profile,playlist[0],s);
        else for(const lang of ['ml','en']){
          if(!s[lang+'Male']||!s[lang+'Female']||s[lang+'Male']===s[lang+'Female'])throw Error(`Choose two different ${lang==='ml'?'Malayalam':'English'} device voices and assign male and female.`);
        }
        audio.stopPlayback();
        await runNumberSequence(playlist,{signal:task.signal,onStep:(step,i,total)=>say(`${step.value} · ${step.target.language==='ml'?'Malayalam':'English'} · ${step.gender} · ${i+1}/${total}`),play:(step,signal)=>library.play(step,profile,s,signal)});
        say(`Finished numbers ${from}–${to}.`);
      }else if(action==='generate'){
        if(s.source==='device')throw Error('Select the Gemini service to generate files. Device read-aloud cannot be recorded by this app.');
        for(const [index,step] of playlist.entries()){
          checkStopped(task.signal);say(`Saving ${index+1}/${playlist.length} · ${step.value} · ${step.target.language.toUpperCase()} · ${step.gender}`);
          await library.generate(step,profile,s,task.signal);count();
        }
        say(`Saved all ${playlist.length} recordings for numbers ${from}–${to}.`);
      }else if(action==='export'){
        const blob=await library.export(playlist,profile,s);checkStopped(task.signal);await exportFile(blob,`bhaasa-numbers-${from}-${to}.zip`);say('Recordings ZIP exported.');
      }else{
        say('Preparing WAV with voices and pauses…');const blob=await library.recording(playlist,profile,s,task.signal);checkStopped(task.signal);await exportFile(blob,`bhaasa-numbers-${from}-${to}.wav`);say('WAV downloaded with the selected pauses.');
      }
    }catch(error){say(task.signal.aborted?'Stopped. Completed recordings are saved.':error.message);}
    finally{if(controller===task)controller=null;if(alive){busy(false);count();}if(audio.language==='ml')await audio.refresh().catch(()=>{});}
  }
  const onClick=e=>{const button=e.target.closest('[data-numbers]');if(!button)return;const action=button.dataset.numbers;if(action==='list')void exportFile(new Blob([numbersCSV()],{type:'text/csv;charset=utf-8'}),'bhaasa-numbers-1-100.csv').catch(error=>say(error.message));else if(action==='stop')stop();else if(action==='voices')refreshVoices().catch(e=>say(e.message));else void operate(action,Number(button.dataset.number)||undefined);};
  const onSubmit=e=>{e.preventDefault();try{save();}catch(error){root.querySelector('#numbers-settings-status').textContent=`Not saved: ${error.message}`;}};
  const onChange=e=>{
    if(e.target.id==='numbers-import'){
      const file=e.target.files[0];if(!file||controller)return;const task=new AbortController();controller=task;busy(true);
      loading.then(()=>library.import(file)).then(count=>say(`Imported ${count} recordings.`)).catch(error=>say(error.message)).finally(()=>{controller=null;if(alive){busy(false);count();e.target.value='';}});return;
    }
    if(form.contains(e.target))try{save();toggle();}catch(error){root.querySelector('#numbers-settings-status').textContent=`Not saved: ${error.message}`;}
  };
  loading=library.load().then(()=>{say('Ready. Choose a number or a range.');count();}).catch(error=>{say(`Saved audio is unavailable: ${error.message}`);throw error;});
  // Handle startup failure without an unhandled rejection; actions still report it.
  loading.catch(()=>{});toggle();void refreshVoices().catch(error=>say(error.message));
  try{const at=JSON.parse(localStorage.getItem(KEY))?.savedAt;if(at&&Number.isFinite(Date.parse(at)))root.querySelector('#numbers-settings-status').textContent=`Saved on this device · ${new Date(at).toLocaleString()}`;}catch{/* No saved playback settings. */}
  root.addEventListener('click',onClick);root.addEventListener('change',onChange);form.addEventListener('submit',onSubmit);
  globalThis.speechSynthesis?.addEventListener('voiceschanged',refreshVoices);
  const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);
  return {pause:stop,cleanup(){alive=false;stop();root.removeEventListener('click',onClick);root.removeEventListener('change',onChange);form.removeEventListener('submit',onSubmit);document.removeEventListener('visibilitychange',visibility);globalThis.speechSynthesis?.removeEventListener('voiceschanged',refreshVoices);}};
}
