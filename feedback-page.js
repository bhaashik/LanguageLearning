import {APP_VERSION,FEEDBACK_COLLECTOR_URL} from './feedback-config.js';
import {FEATURES,RESULTS,EASE,AGAIN,ISSUES,blankFeedback,validateAnswers,createReport,readReports,saveReport,updateDelivery,deleteReport,reportText} from './feedback.js';
import {collectorURL,sendToAppsScript} from './feedback-transport.js';
import {nativeBridge,isDesktopApp,exportFile,helpLinkAttributes} from './platform.js';

const ENDPOINT_KEY='bhaasa.feedback.collector.v1';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const draftKey=language=>`bhaasa.feedback.draft.${language}.v1`;
const options=(items,selected)=>items.map(([id,label])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(label)}</option>`).join('');
function configuredCollector(){const value=localStorage.getItem(ENDPOINT_KEY)??FEEDBACK_COLLECTOR_URL;return value?collectorURL(value):'';}
function context(language){
  const ua=navigator.userAgent,bridge=nativeBridge();
  const system=/Android/i.test(ua)?'android':/iPhone|iPad|iPod/.test(ua)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1?'ios':/Win/.test(ua)?'windows':/Mac/.test(ua)?'macos':/Linux/.test(ua)?'linux':'other';
  return {appVersion:APP_VERSION,language,system,platform:bridge?(bridge.platform==='ios'?'ios-app':'android-app'):isDesktopApp()?'desktop':'web'};
}
export function feedbackPage(language,languageName){
  let draft=blankFeedback(),notice='',destination='';
  try{const raw=localStorage.getItem(draftKey(language));if(raw)draft=validateAnswers(JSON.parse(raw),language,{draft:true});}catch{notice='The previous draft could not be read. Saved reports have not been changed.';}
  try{destination=configuredCollector();}catch(error){notice+=` ${error.message}`;}
  return `<div id="feedback-page"><header class="page-heading"><div><p class="eyebrow">HELP IMPROVE BHAASA</p><h1>Give feedback</h1><p class="description">Tell us how your ${esc(languageName)} practice went. Choose options; typing is optional.</p></div></header>
  <section class="panel feedback-panel"><form id="feedback-form">
  <fieldset><legend>What did you try?</legend><p>Choose a result for at least one feature. Everything starts at “Did not try”.</p><div class="feedback-features">${FEATURES.filter(([id])=>language!=='fr'||id!=='tracing').map(([id,label])=>`<label for="feedback-feature-${id}">${esc(label)}<select id="feedback-feature-${id}" name="feature-${id}">${options(RESULTS,draft.features[id])}</select></label>`).join('')}</div></fieldset>
  <div class="form-grid"><label for="feedback-ease">How easy was Bhaasa to use? (required)<select id="feedback-ease" name="ease" required><option value="">Choose an option</option>${options(EASE,draft.ease)}</select></label><label for="feedback-again">Would you use it again? (optional)<select id="feedback-again" name="again"><option value="">Prefer not to answer</option>${options(AGAIN,draft.again)}</select></label></div>
  <fieldset><legend>Any problems? (optional)</legend><div class="feedback-issues">${ISSUES.filter(([id])=>language!=='fr'||id!=='tracing').map(([id,label])=>`<label><input type="checkbox" name="issue" value="${id}" ${draft.issues.includes(id)?'checked':''}> ${esc(label)}</label>`).join('')}</div></fieldset>
  <label for="feedback-comment">Anything else? (optional, up to 1,500 characters)<textarea id="feedback-comment" name="comment" maxlength="1500" rows="3" placeholder="For example, which screen or phrase needs attention?">${esc(draft.comment)}</textarea></label>
  <p class="section-note">A report includes these answers, app version, language, device category, date, and a random report ID. It includes no account details, recordings, drawings, API keys, or learning history. Avoid putting personal information in your comment. Drafts and reports stay on this device until you choose to send or share them.</p>
  <p id="feedback-destination" class="feedback-destination"></p><p class="section-note" id="feedback-draft-status" role="status"></p>
  <div class="button-row"><button class="button primary" type="submit" id="feedback-save">${destination?'Save & send feedback':'Save feedback on this device'}</button><button class="button secondary" type="button" data-feedback="cancel" hidden>Cancel sending</button><button class="text-button" type="button" data-feedback="clear-draft">Clear draft</button></div>
  <p class="notice" id="feedback-status" role="status" aria-live="polite" ${notice?'':'hidden'}>${esc(notice)}</p>
  </form></section>
  <details class="panel feedback-settings"><summary>Feedback collection settings</summary><p>For testers: use the collector supplied by the app owner. For the owner: deploy the supplied Google Apps Script to collect responses in a private Google Sheet, then add its public web-app URL here or in the release configuration.</p><form id="feedback-settings-form"><label for="feedback-collector">Google Apps Script web-app URL (optional)<input id="feedback-collector" type="url" value="${esc(destination)}" placeholder="https://script.google.com/macros/s/DEPLOYMENT_ID/exec" autocomplete="off" spellcheck="false"></label><div class="button-row"><button class="button secondary" type="submit">Save collector setting</button><button class="text-button" type="button" data-feedback="default-collector">Use release setting</button></div></form><p><a href="./docs/FEEDBACK.html" ${helpLinkAttributes()}>Google Sheet setup and troubleshooting</a></p></details>
  <section class="feedback-history"><div class="section-title"><h2>Saved feedback on this device</h2><button class="text-button" type="button" data-feedback="export-all">Export all as JSON</button></div><p class="section-note">Retry uses the same report ID to prevent duplicate rows. Removing a local copy does not delete a response already stored by the collector.</p><div id="feedback-reports"></div></section></div>`;
}
export function setupFeedback(language){
  const root=document.querySelector('#feedback-page'),form=root.querySelector('#feedback-form');
  const $=selector=>root.querySelector(selector);
  let active=null,disposed=false;
  function status(message){if(disposed)return;$('#feedback-status').textContent=message;$('#feedback-status').hidden=false;$('#feedback-status').scrollIntoView({block:'nearest'});}
  function destination(){try{return configuredCollector();}catch(error){status(error.message);return '';}}
  function refresh(){
    if(disposed)return;const url=destination();
    $('#feedback-save').textContent=url?'Save & send feedback':'Save feedback on this device';$('#feedback-save').disabled=Boolean(active);
    $('[data-feedback="cancel"]').hidden=!active;
    $('#feedback-destination').textContent=url?`Sending is optional. Save & send sends your response to the app owner’s Google Sheet via: ${url}`:'No collector is configured. Save here, then export/share your report with the app owner.';
    try{const reports=readReports();$('#feedback-reports').innerHTML=reports.length?reports.map(report=>{
      const confirmed=report.delivery.status==='confirmed',pending=active?.id===report.id;
      return `<article class="panel feedback-report" data-report="${report.id}"><h3>${report.language==='fr'?'French':'Malayalam'} · ${esc(new Date(report.createdAt).toLocaleString())}</h3><p class="feedback-delivery ${confirmed?'confirmed':''}">${pending?'Sending; awaiting confirmation…':confirmed?`Collector confirmed receipt · ${esc(report.delivery.receivedAt||'')}`:report.delivery.status==='local'?'Saved on this device; not sent':'Receipt not confirmed. Retry or export this saved report.'}</p>${report.delivery.destination?`<p class="section-note feedback-url">Collector: ${esc(report.delivery.destination)}</p>`:''}<div class="button-row">${!confirmed?`<button type="button" class="button secondary" data-feedback="retry" data-id="${report.id}" ${!url||active?'disabled':''}>Send / retry</button>`:''}<button type="button" class="text-button" data-feedback="export" data-id="${report.id}">Export / share report</button><button type="button" class="text-button danger" data-feedback="delete" data-id="${report.id}" ${pending?'disabled':''}>Remove local copy</button></div></article>`;
    }).join(''):'<p>No saved reports yet.</p>';}
    catch(error){$('#feedback-reports').textContent=error.message;}
  }
  function answers(){const data=new FormData(form),value=blankFeedback();for(const [id] of FEATURES)value.features[id]=data.get(`feature-${id}`)||'not_tried';return {...value,ease:data.get('ease'),again:data.get('again'),issues:data.getAll('issue'),comment:data.get('comment')};}
  function clearDraft(){for(const select of form.querySelectorAll('select'))select.value=select.name.startsWith('feature-')?'not_tried':'';for(const box of form.querySelectorAll('[name="issue"]'))box.checked=false;form.elements.comment.value='';localStorage.removeItem(draftKey(language));$('#feedback-draft-status').textContent='';}
  function draft(){try{localStorage.setItem(draftKey(language),JSON.stringify(validateAnswers(answers(),language,{draft:true})));$('#feedback-draft-status').textContent='Draft saved on this device.';}catch(error){$('#feedback-draft-status').textContent=`Draft not saved: ${error.message}`;}}
  async function send(report,url){
    if(active)throw Error('Finish or cancel the current submission first.');
    const controller=new AbortController();active={id:report.id,controller};
    try{
      updateDelivery(report.id,{status:'pending',destination:url});refresh();status('Saved locally. Sending to Google; waiting for confirmation…');
      const receipt=await sendToAppsScript(report,url,{signal:controller.signal});
      try{updateDelivery(report.id,{status:'confirmed',destination:url,receivedAt:receipt.receivedAt});}
      catch(error){status(`The collector confirmed receipt, but its status could not be saved on this device. ${error.message}`);return;}
      status('The Google Sheet collector confirmed receipt. Thank you.');
    }catch(error){
      try{updateDelivery(report.id,{status:'unconfirmed',destination:url});}catch(storageError){status(`${error.message} ${storageError.message}`);return;}
      status(error.message);
    }finally{active=null;refresh();}
  }
  async function submit(event){
    if(!['feedback-form','feedback-settings-form'].includes(event.target.id))return;event.preventDefault();
    try{
      if(event.target.id==='feedback-settings-form'){
        if(active)throw Error('Finish or cancel sending before changing the collector.');
        const value=$('#feedback-collector').value.trim();localStorage.setItem(ENDPOINT_KEY,value?collectorURL(value):'');refresh();status('Collector setting saved on this device. No response has been sent.');return;
      }
      if(active)throw Error('Finish or cancel the current submission first.');
      const report=createReport(answers(),context(language));saveReport(report);
      try{clearDraft();}catch{}
      const url=destination();refresh();if(url)await send(report,url);else status('Feedback saved on this device. Export / share it with the app owner.');
    }catch(error){status(error.message);}
  }
  async function click(event){
    const button=event.target.closest('[data-feedback]');if(!button)return;
    try{const action=button.dataset.feedback;
      if(action==='cancel'){active?.controller.abort();return;}
      if(action==='clear-draft'){clearDraft();$('#feedback-draft-status').textContent='Draft cleared.';return;}
      if(action==='default-collector'){if(active)throw Error('Finish or cancel sending before changing the collector.');localStorage.removeItem(ENDPOINT_KEY);$('#feedback-collector').value=destination();refresh();status('Using the collector configured in this app release.');return;}
      const reports=readReports();
      if(action==='export-all'){await exportFile(new Blob([JSON.stringify({format:'bhaasa-feedback-v1',reports},null,2)],{type:'application/json'}),'bhaasa-feedback.json');return;}
      const report=reports.find(r=>r.id===button.dataset.id);if(!report)throw Error('This saved report was not found.');
      if(action==='export')await exportFile(new Blob([reportText(report)],{type:'text/plain;charset=utf-8'}),`bhaasa-feedback-${report.id}.txt`);
      if(action==='retry'){const url=destination();if(!url)throw Error('Configure a collector first, or export / share this report.');await send(report,url);}
      if(action==='delete'){if(active?.id===report.id)throw Error('Cancel sending before removing its local copy.');if(confirm('Remove this local feedback copy? A response already in Google Sheets will remain there.')){deleteReport(report.id);refresh();status('Local copy removed.');}}
    }catch(error){status(error.message);}
  }
  function change(event){
    if(!form.contains(event.target))return;
    if(event.target.name==='issue'&&event.target.checked){for(const box of form.querySelectorAll('[name="issue"]'))if(box!==event.target&&(event.target.value==='none'||box.value==='none'))box.checked=false;}
    draft();
  }
  root.addEventListener('submit',submit);root.addEventListener('click',click);root.addEventListener('input',change);root.addEventListener('change',change);refresh();
  return {pause:()=>active?.controller.abort(),cleanup:()=>{disposed=true;active?.controller.abort();root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.removeEventListener('input',change);root.removeEventListener('change',change);}};
}
