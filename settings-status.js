const LOCAL_KEY='bhaasa.settings.save-times.v1',SESSION_KEY='bhaasa.settings.session-save-times.v1';
const kinds=['ocr','tts','asr','firebase','gateway'];
const labels={ocr:'Handwriting (OCR)',tts:'Listening (TTS)',asr:'Speaking (ASR)',firebase:'Direct Firebase',gateway:'Gateway access'};
const scopes={ocr:'#connection-ocr',tts:'#connection-tts',asr:'#connection-asr',firebase:'#firebase-settings',gateway:'.connection-intro'};
const keyFor=(kind,language)=>['tts','asr'].includes(kind)?`${kind}:${language}`:kind;
function read(kind,language){
  try{
    const storage=kind==='gateway'?sessionStorage:localStorage;
    const entry=JSON.parse(storage.getItem(kind==='gateway'?SESSION_KEY:LOCAL_KEY)||'{}')[keyFor(kind,language)];
    return entry&&Number.isFinite(entry.at)&&entry.at>0&&entry.at<=8640000000000000&&['saved','forgotten'].includes(entry.action)?{at:entry.at,action:entry.action}:null;
  }catch{return null;}
}
const formatTime=at=>new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(new Date(at));
export function settingsStatusPanel(){return `<section class="panel settings-save-panel" aria-labelledby="settings-save-heading"><h2 id="settings-save-heading">Settings status</h2><p>Last successful saves on this page, in this device’s local time. Provider preferences stay in this browser; gateway access lasts for this tab/session. A save does not verify that a model works.</p><ul class="settings-save-list">${kinds.map(kind=>`<li><strong>${labels[kind]}</strong><span id="settings-save-${kind}" role="status" aria-live="polite"></span></li>`).join('')}</ul></section>`;}
export function setupSettingsStatus(root,language){
  let dead=false;
  const states=Object.fromEntries(kinds.map(kind=>[kind,{entry:read(kind,language),phase:'clean'}]));
  const snapshot=kind=>JSON.stringify([...root.querySelector(scopes[kind]).querySelectorAll('input,select')].map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));
  const snapshots={};
  function render(kind){
    if(dead)return;
    const state=states[kind],node=root.querySelector(`#settings-save-${kind}`),time=state.entry?formatTime(state.entry.at):'';
    let label=state.entry?(state.entry.action==='forgotten'?'Forgotten':'Saved')+(kind==='gateway'?' for this session':' on this device'):'No save time recorded';
    let tone=state.entry?'saved':'neutral';
    if(state.phase==='dirty'){label='Unsaved changes';tone='dirty';}
    if(state.phase==='saving'){label='Saving…';tone='saving';}
    if(state.phase==='failed'){label='Save failed';tone='failed';}
    if(state.phase==='unrecorded'){label='Settings updated; save time could not be stored';tone='failed';}
    node.dataset.state=tone;node.replaceChildren(document.createTextNode(label));
    if(state.phase==='failed'||state.phase==='saving')node.append(document.createTextNode(` · ${formatTime(state.at)}`));
    if(time){node.append(document.createTextNode(state.phase==='clean'?' · ':' · Last successful update: '));const stamp=document.createElement('time');stamp.dateTime=new Date(state.entry.at).toISOString();stamp.textContent=time;node.append(stamp);}
  }
  function capture(kind){snapshots[kind]=snapshot(kind);}
  function refresh(kind){
    if(dead||states[kind].phase==='saving')return;
    states[kind].phase=snapshot(kind)===snapshots[kind]?'clean':'dirty';render(kind);
  }
  function saved(kind,{forgotten=false}={}){
    if(dead)return;
    const entry={at:Date.now(),action:forgotten?'forgotten':'saved'};
    try{
      const storage=kind==='gateway'?sessionStorage:localStorage,key=kind==='gateway'?SESSION_KEY:LOCAL_KEY;
      const entries=Object.fromEntries(kinds.filter(k=>(k==='gateway')===(kind==='gateway')).flatMap(k=>{
        const languages=['tts','asr'].includes(k)?['ml','fr']:[language];
        return languages.flatMap(l=>{const value=read(k,l);return value?[[keyFor(k,l),value]]:[];});
      }));
      entries[keyFor(kind,language)]=entry;storage.setItem(key,JSON.stringify(entries));
      states[kind]={entry,phase:'clean'};capture(kind);
    }catch{states[kind].phase='unrecorded';}
    render(kind);
  }
  function begin(kind){if(!dead){states[kind].phase='saving';states[kind].at=Date.now();render(kind);}}
  function failed(kind){if(!dead){states[kind].phase='failed';states[kind].at=Date.now();render(kind);}}
  const onEdit=event=>{const kind=kinds.find(k=>root.querySelector(scopes[k]).contains(event.target));if(kind)refresh(kind);};
  root.addEventListener('input',onEdit);root.addEventListener('change',onEdit);
  function captureAll(){for(const kind of kinds){capture(kind);render(kind);}}
  captureAll();
  return {begin,saved,failed,refresh,captureAll,destroy(){dead=true;root.removeEventListener('input',onEdit);root.removeEventListener('change',onEdit);}};
}
