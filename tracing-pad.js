import {fitGuide,smoothPath,resample,pathLength,bounds,meaningfulInk,evaluateTrace,recognitionMatches} from './tracing.js';
import {validateEndpoint} from './audio-store.js';
import {isNativeApp,isPagesApp,exportFile as download,helpLinkAttributes,randomId} from './platform.js';
import {gatewayJSON} from './gateway.js';
import {OCR_PROVIDERS,loadOCRSettings,saveOCRSettings,ocrSelection,ocrRecognitionKey,recognitionPayload,providerLabel,normalizeOCRModel,ocrErrorMessage} from './ocr-settings.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let guideData;
const loadGuides=()=>guideData||=fetch(new URL('./data/tracing-guides.json',import.meta.url),{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('Practice guide unavailable');return r.json();}).catch(error=>{guideData=null;throw error;});
export function tracingPanel(item,script,saved){const settings=loadOCRSettings(),ocr=ocrSelection(settings);return `<section class="writing-card ${script?'tracing-card':''}"><div class="card-topline"><h2>${script?'Trace. Flow. Remember.':'A space to write'}</h2><span class="small-label">FINGER, PEN, OR MOUSE</span></div><p>${script?'Follow the curved path, then try it from memory. Lift your pen only between separate strokes.':'Try the shape, then try it from memory.'}</p>
  ${script?`<div class="trace-toolbar"><button type="button" class="button secondary small" id="demo-trace" disabled>Watch the strokes</button><label class="checkbox"><input id="show-stroke-markers" type="checkbox" checked> Numbers & arrows</label></div><p id="trace-plan" class="trace-plan" role="status">Loading practice guide…</p><button type="button" class="button secondary small" id="retry-trace-guide" hidden>Retry loading practice guide</button>`:''}
  <div class="canvas-wrap"><canvas id="writing-canvas" width="800" height="${script?600:400}" aria-label="Writing pad for ${esc(item.ml)}. Draw with a finger, pen, or mouse. Tracing and OCR feedback are optional."></canvas></div>
  <div class="writing-controls"><label class="checkbox"><input id="show-guide" type="checkbox" checked> Show guide</label><div><button type="button" class="button secondary small" data-action="undo-stroke">Undo</button><button type="button" class="button secondary small" data-action="clear-canvas">Clear</button></div></div>
  ${script?`<p><a href="#connections">Connections &amp; models · selectable model lists and gateway setup</a></p><div class="ocr-choice form-grid"><label>Handwriting recognition<select id="ocr-provider">${OCR_PROVIDERS.map(p=>`<option value="${p.id}" ${p.id===ocr.provider?'selected':''}>${p.label}</option>`).join('')}</select></label><label>Model ID · leave blank for server default<input id="ocr-model" maxlength="150" list="ocr-model-options" value="${esc(ocr.model)}" placeholder="Use gateway default"><datalist id="ocr-model-options"></datalist></label></div><p id="ocr-service-note" class="section-note"></p><div class="trace-actions button-row"><button type="button" class="button primary" id="check-trace" aria-describedby="trace-status" disabled>Check my tracing</button><button type="button" class="button secondary" id="check-handwriting" disabled>Recognize my handwriting</button></div><p id="trace-status" class="section-note" role="status"></p><div id="trace-feedback" aria-live="polite"></div><div id="ocr-feedback" aria-live="polite"></div><p class="section-note">Tracing fit, smoothness, and pen lifts are checked offline. Font-derived stroke paths are practice suggestions, not teacher-verified Malayalam stroke order. Separate marks can need extra strokes. OCR checks only your ink and may misread handwriting.</p>
  <details class="trace-settings"><summary>Teacher guides, OCR connection & exports</summary><p><a class="text-link" href="./docs/PROVIDERS.html#ocr" ${helpLinkAttributes()}>Help: set up OCR providers and models</a></p><p>For a teacher’s preferred stroke order, import a Bhaasa stroke-guide JSON. You can export your own strokes for review and reuse as a guide.</p><div class="button-row"><button type="button" class="button secondary small" id="export-trace" disabled>Export my strokes</button><label class="button secondary small file-button">Import stroke guide<input id="import-stroke-guide" type="file" accept=".json,application/json"></label><button type="button" class="button secondary small" id="use-font-guide">Use font guide</button></div><label class="stacked">OCR gateway / custom endpoint<input id="ocr-endpoint" type="url" maxlength="1000" aria-describedby="ocr-gateway-help" value="${esc(ocr.endpoint)}" placeholder="https://your-gateway.example/api/ocr"></label><p id="ocr-gateway-help" class="section-note">For a local installation on the default port, use <code>http://127.0.0.1:4173/api/ocr</code> and open Bhaasa at <code>http://127.0.0.1:4173</code>. The gateway is the Bhaasa server that holds your provider key. Set its key and model in <code>.env.local</code>, then restart the server. Offline tracing needs no gateway.</p><button type="button" class="button secondary small" id="ocr-check-connection">Check OCR connection</button><button type="button" class="button secondary small" id="ocr-list-gemini-models" hidden>List models from Gemini</button><p id="ocr-connection-status" role="status"></p><label class="checkbox"><input id="ocr-force-recheck" type="checkbox"> Request a fresh reading instead of reusing the saved one</label><p>Choose a provider supported by your gateway, or a custom/local OCR endpoint that can read Malayalam. Provider keys belong on that server, not in this page. A local vision model can run without a cloud API. Only your ink is sent when recognition is requested; tracing always stays available offline.</p></details><p id="writing-history" class="section-note">${saved?.attempts?`${saved.attempts} tracing checks · best fit ${Math.round((saved.bestFit||0)*100)}%.`:''}</p>`:'<p class="section-note">Freehand practice for whole words. Open a writing-system symbol for stroke guidance and handwriting recognition.</p>'}</section>`;}

function drawPath(ctx,points){if(!points.length)return;ctx.beginPath();if(points.length===1){ctx.arc(points[0].x,points[0].y,ctx.lineWidth/2,0,2*Math.PI);ctx.fill();return;}const p=smoothPath(points);ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.stroke();}
function cleanDraft(strokes){return strokes.map(p=>resample(p,2).map(({x,y})=>({x:Math.round(x*10)/10,y:Math.round(y*10)/10})));}
export function createTracingPad({item,script,saved,onDraft,onCheck,onRecognition,onGuide,notify}){
  const find=s=>document.querySelector(s),canvas=find('#writing-canvas'),ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
  let draftId=saved?.draftId||randomId();
  const ocrSettings=loadOCRSettings();let readings=[...(saved?.ocr?.readings||[])];
  if(!readings.length&&saved?.ocr?.lastDrawingId)readings.push({drawingId:saved.ocr.lastDrawingId,recognitionKey:ocrRecognitionKey({provider:'openai',...ocrSettings.profiles.openai}),text:saved.ocr.lastText,matched:saved.ocr.lastMatched,provider:'openai',model:saved.ocr.lastModel||null});
  let strokes=(saved?.draft||[]).map(p=>p.map(q=>({...q}))),current=null,alive=true,guide=null,fontGuide=null,guideLoading=false,guideError=null,custom=saved?.customGuide?.ml===item.ml?saved.customGuide:null,pointer=null,revision=0,checkedRevision=-1,animation=0,abort=null,recognizing=false,catalogBusy=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(width,(e.clientX-r.left)/r.width*width)),y:Math.max(0,Math.min(height,(e.clientY-r.top)/r.height*height))};};
  function marker(p,text){ctx.fillStyle='#214d3c';ctx.beginPath();ctx.arc(p.x,p.y,15,0,2*Math.PI);ctx.fill();ctx.fillStyle='white';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,p.y+1);}
  function draw(){
    if(!alive)return;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#fcfbf7';ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#e4e5da';ctx.lineWidth=1;ctx.setLineDash([7,9]);
    for(const y of script?[height*.25,height*.5,height*.75]:[100,200,300]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}ctx.setLineDash([]);
    if(find('#show-guide').checked){
      if(guide){
        if(!custom){ctx.fillStyle='#e1e3d7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${guide.fontSize}px Malayalam`;ctx.fillText(item.ml,guide.anchor.x,guide.anchor.y,720*guide.fontSize/200);}
        ctx.strokeStyle='#b5c3a875';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=18;ctx.lineCap='round';ctx.lineJoin='round';guide.paths.forEach(p=>drawPath(ctx,p));
        ctx.strokeStyle='#8c9d7c';ctx.lineWidth=2;ctx.setLineDash([4,7]);guide.paths.forEach(p=>drawPath(ctx,p));ctx.setLineDash([]);
        if(find('#show-stroke-markers').checked)guide.paths.forEach((p,i)=>{
          marker(p[0],String(i+1));const smooth=resample(smoothPath(p),8),j=Math.min(smooth.length-2,Math.max(1,Math.round(smooth.length*.2)));
          const a=smooth[j],b=smooth[j+1];if(a&&b){const angle=Math.atan2(b.y-a.y,b.x-a.x);ctx.save();ctx.translate(a.x,a.y);ctx.rotate(angle);ctx.fillStyle='#54754c';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-5,-6);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();}
        });
      }else{ctx.fillStyle='#dedfd3';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${item.ml.length>12?48:item.ml.length>5?90:200}px Malayalam`;ctx.fillText(item.ml,400,height/2+5,740);}
    }
    ctx.strokeStyle='#214d3c';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=script?7:5;ctx.lineCap='round';ctx.lineJoin='round';
    [...strokes,...(current?[current]:[])].forEach(p=>drawPath(ctx,p));
  }
  function update(){
    const ink=meaningfulInk(strokes);for(const id of ['check-trace','check-handwriting','export-trace'])if(find('#'+id))find('#'+id).disabled=!!current||!ink||(id==='check-trace'&&!guide)||(id==='check-handwriting'&&(recognizing||ocrSettings.provider==='none'));
    if(find('#trace-plan')&&guide)find('#trace-plan').textContent=`${custom?'Custom':'Suggested'} guide: ${guide.paths.length} continuous ${guide.paths.length===1?'stroke':'strokes'} · ${strokes.length} drawn. ${find('#show-guide').checked?'Start at the numbered dots and follow the arrows.':'Guide hidden: write from memory.'}`;
    if(script){
      find('#demo-trace').disabled=!guide;
      find('#retry-trace-guide').hidden=!guideError;find('#retry-trace-guide').disabled=guideLoading;
      if(!guide)find('#trace-plan').textContent=guideLoading?'Loading practice guide…':guideError||'Waiting for the practice guide.';
      find('#trace-status').textContent=current?'Finish this stroke and lift your finger, pen, or mouse button to check it.':!guide?(guideLoading?'Loading the practice guide. You can draw while you wait.':'The practice guide is unavailable. Retry loading it; your drawing is kept.'):
        !ink?(strokes.length?'Keep drawing the full symbol at the guide’s size. A tap or short line is too small to check.':'Draw over the pale guide, then lift your finger, pen, or mouse button. Watching the demonstration does not add your own ink.'):'Ready to check your tracing offline. No API key or gateway is needed.';
    }
  }
  function showOCRReading(reading,cached){
    find('#ocr-feedback').innerHTML=`<section class="trace-result ${reading.matched===true?'trace-good':''}"><h3>${cached?'Saved OCR reading':reading.matched===null?'The drawing could not be read reliably.':reading.matched?'OCR read the symbol you were practising.':'OCR read a different symbol.'}</h3>${reading.text?`<p class="ocr-reading">Read as <span lang="ml" class="ml">${esc(reading.text)}</span>${reading.matched===false?` · practising <span lang="ml" class="ml">${esc(item.ml)}</span>`:''}</p>`:''}<p>Source: ${esc(providerLabel(reading.provider||'openai'))}${reading.model?` · ${esc(reading.model)}`:''}. ${cached?'Reused for this unchanged drawing and provider settings.':'Only your ink was sent; the guide and expected answer were excluded.'} OCR can make mistakes.</p></section>`;
  }
  function syncOCRControls(){
    if(!script)return;
    const config=ocrSelection(ocrSettings),off=config.provider==='none';
    find('#ocr-provider').value=config.provider;find('#ocr-model').value=config.model;find('#ocr-model').disabled=off||config.provider==='custom';
    find('#ocr-model').placeholder='Use gateway default';find('#ocr-model-options').replaceChildren();
    find('#ocr-endpoint').value=config.endpoint;find('#ocr-endpoint').disabled=off;find('#ocr-check-connection').disabled=off;
    if(isNativeApp()||isPagesApp())find('#ocr-gateway-help').textContent='Cloud recognition needs a reachable HTTPS gateway. GitHub Pages serves the app but no model API; localhost/127.0.0.1 on this device is not your desktop computer. Open Connections & models to choose a gateway and its configured models. Provider keys stay on that server.';
    find('#ocr-list-gemini-models').hidden=config.provider!=='gemini';find('#ocr-list-gemini-models').disabled=catalogBusy;
    find('#ocr-service-note').textContent=off?'Recognition is off. Offline tracing, smoothness checks, and saved drawings still work.':config.provider==='custom'?'Use an OCR endpoint that supports Malayalam. A local engine can run without cloud APIs.':`${providerLabel(config.provider)} needs a configured gateway and an image-capable model. Only your ink is sent when you request recognition.`;
    find('#ocr-connection-status').textContent='';find('#ocr-force-recheck').checked=false;
    find('#ocr-feedback').replaceChildren();
    const cached=readings.find(r=>r.drawingId===draftId&&r.recognitionKey===ocrRecognitionKey(config));if(cached)showOCRReading(cached,true);
    update();
  }
  function changeOCRSettings(switchProvider){
    const previous=ocrSettings.provider,profile=ocrSettings.profiles[previous];
    try{
      const value=find('#ocr-endpoint').value.trim();const endpoint=value?validateEndpoint(value):'';
      profile.endpoint=endpoint;profile.model=find('#ocr-model').value.trim().slice(0,150);
      if(switchProvider)ocrSettings.provider=find('#ocr-provider').value;
      saveOCRSettings(ocrSettings);abort?.abort();syncOCRControls();
    }catch(error){find('#ocr-provider').value=previous;find('#ocr-endpoint').value=profile.endpoint;notify(error.message);}
  }
  function clearResult(selector){
    const element=find(selector);if(!element)return;
    // Keep the page from shrinking underneath the pad between pen lifts.
    // This matters when clearing a tall result near the document's bottom.
    if(element.childElementCount)element.style.minHeight=`${element.getBoundingClientRect().height}px`;
    element.replaceChildren();
  }
  function changed(){revision++;draftId=randomId();checkedRevision=-1;clearResult('#trace-feedback');clearResult('#ocr-feedback');onDraft(cleanDraft(strokes),draftId);draw();update();}
  function stopDemo(){cancelAnimationFrame(animation);animation=0;if(find('#demo-trace'))find('#demo-trace').textContent='Watch the strokes';}
  canvas.onpointerdown=e=>{if(e.button!==0||pointer!==null)return;e.preventDefault();stopDemo();pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);current=[point(e)];draw();update();};
  canvas.onpointermove=e=>{if(pointer!==e.pointerId||!current)return;e.preventDefault();let events=e.getCoalescedEvents?.()||[];if(!events.length)events=[e];for(const event of events){const p=point(event);if(distanceEnough(current.at(-1),p))current.push(p);}if(current.length>4000)current=current.filter((_,i)=>i%2===0);draw();};
  function end(e){if(pointer!==e.pointerId||!current)return;if(e.type==='pointerup'){const p=point(e);if(distanceEnough(current.at(-1),p))current.push(p);}strokes.push(current);current=null;pointer=null;changed();}
  canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
  find('#show-guide').onchange=()=>{stopDemo();draw();update();};
  if(find('#show-stroke-markers'))find('#show-stroke-markers').onchange=draw;
  function selectGuide(value){guide=fitGuide(value,width,height);draw();update();}
  async function loadPracticeGuide(){
    if(guideLoading)return;
    guideLoading=true;guideError=null;update();
    try{
      const data=await loadGuides();if(!alive)return;
      fontGuide=data.guides?.[item.id];if(!fontGuide)throw Error('Missing guide');
      selectGuide(custom||fontGuide);
    }catch{
      guideData=null;
      if(alive)guideError='The practice guide could not load. Reconnect or restart the local server, then retry.';
    }finally{if(alive){guideLoading=false;update();}}
  }
  if(script){
    if(custom)selectGuide(custom);
    find('#retry-trace-guide').onclick=loadPracticeGuide;
    loadPracticeGuide();
    find('#check-trace').onclick=()=>{
      stopDemo();if(!guide)return;const result=evaluateTrace(strokes,guide);if(!result.assessable){notify(result.message);return;}
      find('#trace-feedback').innerHTML=`<section class="trace-result ${result.passed?'trace-good':''}"><h3>${result.passed?'A good trace of this guide.':'A few curves to revisit.'}</h3><div class="trace-metrics"><span><strong>${Math.round(result.fit*100)}%</strong>Guide fit</span><span><strong>${Math.round(result.smoothness*100)}%</strong>Smoothness</span><span><strong>${result.strokeCount} / ${result.suggestedStrokes}</strong>Strokes / suggested</span></div><p>Coverage ${Math.round(result.coverage*100)}% · ink near path ${Math.round(result.onPath*100)}%. This measures tracing, not OCR recognition.</p><ul>${result.feedback.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>`;
      if(checkedRevision!==revision){checkedRevision=revision;onCheck({...result,drawingId:draftId});}
    };
    find('#demo-trace').onclick=()=>{
      if(animation){stopDemo();draw();return;}if(!guide)return;
      find('#show-guide').checked=true;find('#demo-trace').textContent='Stop demonstration';
      const paths=guide.paths.map(p=>resample(smoothPath(p),4)),total=paths.reduce((n,p)=>n+p.length+25,0),start=performance.now();
      const frame=now=>{if(!alive)return;draw();let visible=Math.floor((now-start)/15);ctx.strokeStyle='#bd6f3f';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=8;
        for(const p of paths){if(visible<=0)break;const n=Math.min(p.length,visible);drawPath(ctx,p.slice(0,n));if(n){ctx.beginPath();ctx.arc(p[n-1].x,p[n-1].y,8,0,2*Math.PI);ctx.fill();}visible-=p.length+25;}
        if((now-start)/15>total){stopDemo();draw();}else animation=requestAnimationFrame(frame);
      };animation=requestAnimationFrame(frame);
    };
    find('#ocr-provider').onchange=()=>changeOCRSettings(true);
    find('#ocr-model').onchange=()=>changeOCRSettings(false);
    find('#ocr-endpoint').onchange=()=>changeOCRSettings(false);
    find('#ocr-list-gemini-models').onclick=async()=>{
      if(catalogBusy||ocrSettings.provider!=='gemini')return;
      const config=ocrSelection(ocrSettings),key=ocrRecognitionKey(config),status=find('#ocr-connection-status'),button=find('#ocr-list-gemini-models');
      catalogBusy=true;button.disabled=true;status.textContent='Asking Google for its model list. No drawing is being sent…';
      try{
        const url=new URL(validateEndpoint(config.endpoint));url.searchParams.set('action','models');url.searchParams.set('provider','gemini');
        const response=await fetch(url,{signal:AbortSignal.timeout(25000)});let data;try{data=await response.json();}catch{}
        if(!alive||ocrRecognitionKey(ocrSelection(ocrSettings))!==key)return;
        if(!response.ok)throw Error(ocrErrorMessage(response.status,data,'gemini'));
        if(data?.provider!=='gemini'||!Array.isArray(data.models)||typeof data.configuredModelListed!=='boolean')throw Error('This gateway cannot list Gemini API models. Update and restart the local Bhaasa server.');
        const models=data.models.filter(m=>typeof m==='string'&&m.length<=150),currentModel=config.model?normalizeOCRModel('gemini',config.model):data.configuredModel;
        const listed=models.includes(currentModel),result=currentModel?`Google ${listed?'lists':'did not list'} ${currentModel}${data.complete===false?' in these partial results':''}. `:'';
        status.textContent=`${result}Generation model IDs returned by Google: ${models.slice(0,100).join(', ')||'none'}${models.length>100?` (+${models.length-100} more)`:''}. To change the server default, set BHAASA_OCR_GEMINI_MODEL in .env.local to an exact listed image-capable model ID and restart the server. Leave the optional Model ID field blank to use it. Listing models does not change settings or test image/JSON support, recognition, quota, or pricing.`;
      }catch(error){if(alive&&ocrRecognitionKey(ocrSelection(ocrSettings))===key)status.textContent=error.message;}
      finally{catalogBusy=false;if(alive)button.disabled=false;}
    };
    find('#ocr-check-connection').onclick=async()=>{
      const config=ocrSelection(ocrSettings),key=ocrRecognitionKey(config),status=find('#ocr-connection-status');
      if(config.provider==='none')return;
      try{
        status.textContent='Checking the selected OCR connection…';
        const data=await gatewayJSON(config.endpoint);
        if(!alive||ocrRecognitionKey(ocrSelection(ocrSettings))!==key)return;
        if(config.provider==='custom'){status.textContent=data.configured===false?'The custom endpoint reports that it is not configured.':'The endpoint responded. Test a drawing to verify recognition and Malayalam support.';return;}
        const entry=Array.isArray(data.providers)?data.providers.find(p=>p.id===config.provider||p.provider===config.provider):data.provider===config.provider?data:null;
        if(!entry){status.textContent='This gateway does not report the selected provider. Update its configuration, or choose another OCR endpoint.';return;}
        const models=Array.isArray(entry.models)?entry.models.filter(m=>typeof m==='string'&&m.length<=150):entry.model?[entry.model]:[];
        find('#ocr-model-options').innerHTML=models.map(model=>`<option value="${esc(model)}"></option>`).join('');
        find('#ocr-model').placeholder=entry.model?`Gateway default: ${entry.model}`:'Use gateway default';
        const summary=`${entry.model?` Server default: ${entry.model}.`:''}${models.length?` Enabled models: ${models.join(', ')}.`:''}`;
        if(entry.configurationError==='invalid_model_id')status.textContent=ocrErrorMessage(503,{error:'invalid_model_id'},config.provider);
        else if(!entry.configured)status.textContent=`${providerLabel(config.provider)} is not configured on this gateway. Set its provider-specific credential, model, and endpoint as needed in the local .env.local file.${summary}`;
        else if(config.model&&!models.some(model=>normalizeOCRModel(config.provider,model)===normalizeOCRModel(config.provider,config.model)))status.textContent=`The Model field does not match this Bhaasa server’s enabled models. Clear the optional Model field to use the server default, or choose a listed model.${summary} No provider request was made.`;
        else status.textContent=`${providerLabel(config.provider)} is configured on the gateway.${summary} No recognition request was made; account access and Malayalam accuracy still need a sample check.`;
      }catch(error){if(alive&&ocrRecognitionKey(ocrSelection(ocrSettings))===key)status.textContent=error.name==='AbortError'?'Connection check timed out.':error.message;}
    };
    find('#check-handwriting').onclick=async()=>{
      if(recognizing||ocrSettings.provider==='none')return;
      if(!meaningfulInk(strokes)){notify('Draw a complete symbol first.');return;}
      const config=ocrSelection(ocrSettings),key=ocrRecognitionKey(config),force=find('#ocr-force-recheck').checked;
      const cached=readings.find(r=>r.drawingId===draftId&&r.recognitionKey===key);
      if(cached&&!force){showOCRReading(cached,true);return;}
      const submitted=revision,button=find('#check-handwriting'),previousReadings=readings;recognizing=true;button.disabled=true;button.textContent='Reading your ink…';
      try{
        if(!config.endpoint)throw Error('Set the OCR gateway in the connection settings first.');
        const endpoint=validateEndpoint(config.endpoint);
        abort=new AbortController();const timer=setTimeout(()=>abort?.abort(),45000);
        let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(recognitionPayload(inkImage(strokes,width,height),config)),signal:abort.signal});}finally{clearTimeout(timer);}
        if(!response.ok){let body;try{body=await response.json();}catch{}throw Error(ocrErrorMessage(response.status,body,config.provider));}
        const result=await response.json();if(!alive)return;
        if(submitted!==revision){notify('Your drawing changed during recognition. Check the new drawing again.');return;}
        if(key!==ocrRecognitionKey(ocrSelection(ocrSettings))){notify('The OCR provider settings changed. Check with the newly selected service.');return;}
        if(typeof result.legible!=='boolean'||!(typeof result.text==='string'||result.text===null)||(result.legible&&(!result.text?.trim()||result.text.length>80||!/^[\u0d00-\u0d7f\u200c\u200d\s]+$/.test(result.text))))throw Error('The OCR service returned an invalid recognition result.');
        if(config.provider!=='custom'&&result.provider!==undefined&&result.provider!==config.provider)throw Error('The gateway returned a different provider. Check its routing configuration.');
        const text=result.legible?result.text.trim():null,matched=result.legible?recognitionMatches(text,item.ml):null;
        const reading={text,matched,drawingId:draftId,recognitionKey:key,provider:config.provider==='custom'&&typeof result.provider==='string'?result.provider.slice(0,64):config.provider,model:typeof result.model==='string'?result.model.slice(0,150):config.model||null};
        readings=[...readings.filter(r=>r.drawingId!==draftId||r.recognitionKey!==key),reading].slice(-20);
        find('#ocr-force-recheck').checked=false;showOCRReading(reading,false);onRecognition({...reading,previousReadings,force});
      }catch(e){if(alive){
        if(key!==ocrRecognitionKey(ocrSelection(ocrSettings)))notify('The OCR provider settings changed. Your drawing is kept.');
        else find('#ocr-feedback').innerHTML=`<p class="notice" role="status">${esc(e.name==='AbortError'?'OCR timed out. Try again when the gateway is available.':e.message)} Your drawing and offline tracing checks are still available.</p>`;
      }}
      finally{abort=null;recognizing=false;if(alive){button.textContent='Recognize my handwriting';update();}}
    };
    find('#export-trace').onclick=async()=>{try{await download(new Blob([JSON.stringify({format:'bhaasa-trace-v1',itemId:item.id,ml:item.ml,width,height,paths:cleanDraft(strokes).map(p=>p.map(({x,y})=>[x,y]))},null,2)],{type:'application/json'}),`bhaasa-${item.id}-strokes.json`);}catch(error){notify(error.message);}};
    find('#import-stroke-guide').onchange=async e=>{
      try{const f=e.target.files[0];if(!f)return;if(f.size>200000)throw Error('Choose a stroke guide smaller than 200 KB.');const data=JSON.parse(await f.text());
        if(data.format!=='bhaasa-trace-v1'||data.itemId!==item.id||data.ml!==item.ml||!Array.isArray(data.paths)||!data.paths.length||data.paths.length>12||data.paths.flat().length>5000||!data.paths.every(p=>Array.isArray(p)&&p.length>1&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(n=>Number.isFinite(n)&&n>=0&&n<=2000))))throw Error('Choose a valid Bhaasa stroke guide for this exact symbol.');
        custom={ml:item.ml,paths:data.paths,source:'imported practice guide',reviewed:false};onGuide(custom);selectGuide(custom);changed();notify('Custom stroke guide loaded. Its shape and order need human review.');
      }catch(error){notify(error.message);}finally{e.target.value='';}
    };
    find('#use-font-guide').onclick=()=>{custom=null;onGuide(null);if(fontGuide)selectGuide(fontGuide);else{guide=null;loadPracticeGuide();}changed();};
  }
  draw();update();
  if(script&&saved?.last?.drawingId===draftId)find('#trace-feedback').innerHTML=`<section class="trace-result"><h3>Saved tracing check</h3><p>Guide fit ${Math.round(saved.last.fit*100)}% · smoothness ${Math.round(saved.last.smoothness*100)}% · ${saved.last.strokeCount} strokes. You can check the unchanged drawing again without adding another attempt.</p></section>`;
  if(script)syncOCRControls();
  document.fonts.load('200px Malayalam').then(()=>{if(alive)draw();});
  return {undo:()=>{stopDemo();strokes.pop();changed();},clear:()=>{stopDemo();strokes=[];current=null;pointer=null;changed();},cleanup:()=>{alive=false;stopDemo();abort?.abort();}};
}
function distanceEnough(a,b){return Math.hypot(a.x-b.x,a.y-b.y)>.6;}
export function inkImage(strokes,width=800,height=600){
  if(!meaningfulInk(strokes))throw Error('Draw a complete symbol first.');
  const ink=document.createElement('canvas');ink.width=width;ink.height=height;const ctx=ink.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.strokeStyle='black';ctx.fillStyle='black';ctx.lineWidth=7;ctx.lineCap='round';ctx.lineJoin='round';strokes.forEach(p=>drawPath(ctx,p));
  const box=bounds(strokes),padding=25,x=Math.max(0,Math.floor(box.x-padding)),y=Math.max(0,Math.floor(box.y-padding)),w=Math.min(width-x,Math.ceil(box.width+2*padding)),h=Math.min(height-y,Math.ceil(box.height+2*padding));
  const out=document.createElement('canvas');out.width=512;out.height=512;const o=out.getContext('2d');o.fillStyle='white';o.fillRect(0,0,512,512);const scale=Math.min(472/w,472/h),dw=w*scale,dh=h*scale;o.drawImage(ink,x,y,w,h,(512-dw)/2,(512-dh)/2,dw,dh);return out.toDataURL('image/png');
}
