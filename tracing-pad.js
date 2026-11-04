import {fitGuide,smoothPath,resample,pathLength,bounds,meaningfulInk,evaluateTrace,recognitionMatches} from './tracing.js';
import {validateEndpoint} from './audio-store.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let guideData;
const loadGuides=()=>guideData||=fetch(new URL('./data/tracing-guides.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Tracing guides could not load. Reopen the app online once to cache them.');return r.json();});
function ocrEndpoint(){try{return localStorage.getItem('bhaasa.ocr.gateway')||new URL('./api/ocr',location.href).href;}catch{return new URL('./api/ocr',location.href).href;}}
export function tracingPanel(item,script,saved){return `<section class="writing-card ${script?'tracing-card':''}"><div class="card-topline"><h2>${script?'Trace. Flow. Remember.':'A space to write'}</h2><span class="small-label">FINGER, PEN, OR MOUSE</span></div><p>${script?'Follow the curved path, then try it from memory. Lift your pen only between separate strokes.':'Try the shape, then try it from memory.'}</p>
  ${script?`<div class="trace-toolbar"><button type="button" class="button secondary small" id="demo-trace">Watch the strokes</button><label class="checkbox"><input id="show-stroke-markers" type="checkbox" checked> Numbers & arrows</label></div><p id="trace-plan" class="trace-plan" role="status">Loading practice guide…</p>`:''}
  <div class="canvas-wrap"><canvas id="writing-canvas" width="800" height="${script?600:400}" aria-label="Writing pad for ${esc(item.ml)}. Draw with a finger, pen, or mouse. Tracing and OCR feedback are optional."></canvas></div>
  <div class="writing-controls"><label class="checkbox"><input id="show-guide" type="checkbox" checked> Show guide</label><div><button type="button" class="button secondary small" data-action="undo-stroke">Undo</button><button type="button" class="button secondary small" data-action="clear-canvas">Clear</button></div></div>
  ${script?`<div class="trace-actions button-row"><button type="button" class="button primary" id="check-trace" disabled>Check my tracing</button><button type="button" class="button secondary" id="check-handwriting" disabled>Check with OpenAI OCR (online)</button></div><div id="trace-feedback" aria-live="polite"></div><div id="ocr-feedback" aria-live="polite"></div><p class="section-note">Tracing fit, smoothness, and pen lifts are checked offline. Font-derived stroke paths are practice suggestions, not teacher-verified Malayalam stroke order. Separate marks can need extra strokes. OCR checks only your ink and may misread handwriting.</p>
  <details class="trace-settings"><summary>Teacher guides, OCR connection & exports</summary><p>For a teacher’s preferred stroke order, import a Bhaasa stroke-guide JSON. You can export your own strokes for review and reuse as a guide.</p><div class="button-row"><button type="button" class="button secondary small" id="export-trace" disabled>Export my strokes</button><label class="button secondary small file-button">Import stroke guide<input id="import-stroke-guide" type="file" accept=".json,application/json"></label><button type="button" class="button secondary small" id="use-font-guide">Use font guide</button></div><label class="stacked">OpenAI OCR gateway<input id="ocr-endpoint" type="url" value="${esc(ocrEndpoint())}"></label><p>The local gateway uses your existing BHAASA_TTS_API_KEY, or a separate BHAASA_OCR_API_KEY. OCR sends your drawing to OpenAI only when you click its button. GitHub Pages needs a separate gateway; offline tracing needs no API key.</p></details><p id="writing-history" class="section-note">${saved?.attempts?`${saved.attempts} tracing checks · best fit ${Math.round((saved.bestFit||0)*100)}%.`:''}</p>`:'<p class="section-note">Freehand practice for whole words. Open a writing-system symbol for stroke guidance and handwriting recognition.</p>'}</section>`;}

function drawPath(ctx,points){if(!points.length)return;ctx.beginPath();if(points.length===1){ctx.arc(points[0].x,points[0].y,ctx.lineWidth/2,0,2*Math.PI);ctx.fill();return;}const p=smoothPath(points);ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.stroke();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function cleanDraft(strokes){return strokes.map(p=>resample(p,2).map(({x,y})=>({x:Math.round(x*10)/10,y:Math.round(y*10)/10})));}
export function createTracingPad({item,script,saved,onDraft,onCheck,onRecognition,onGuide,notify}){
  const find=s=>document.querySelector(s),canvas=find('#writing-canvas'),ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;
  let draftId=saved?.draftId||crypto.randomUUID();
  let strokes=(saved?.draft||[]).map(p=>p.map(q=>({...q}))),current=null,alive=true,guide=null,fontGuide=null,custom=saved?.customGuide?.ml===item.ml?saved.customGuide:null,pointer=null,revision=0,checkedRevision=-1,ocrRevision=saved?.ocr?.lastDrawingId===draftId?0:-1,animation=0,abort=null,recognizing=false;
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
    const ink=meaningfulInk(strokes);for(const id of ['check-trace','check-handwriting','export-trace'])if(find('#'+id))find('#'+id).disabled=!ink||(id==='check-trace'&&!guide)||(id==='check-handwriting'&&recognizing);
    if(find('#trace-plan')&&guide)find('#trace-plan').textContent=`${custom?'Custom':'Suggested'} guide: ${guide.paths.length} continuous ${guide.paths.length===1?'stroke':'strokes'} · ${strokes.length} drawn. ${find('#show-guide').checked?'Start at the numbered dots and follow the arrows.':'Guide hidden: write from memory.'}`;
  }
  function changed(){revision++;draftId=crypto.randomUUID();checkedRevision=-1;ocrRevision=-1;if(find('#trace-feedback'))find('#trace-feedback').replaceChildren();if(find('#ocr-feedback'))find('#ocr-feedback').replaceChildren();onDraft(cleanDraft(strokes),draftId);draw();update();}
  function stopDemo(){cancelAnimationFrame(animation);animation=0;if(find('#demo-trace'))find('#demo-trace').textContent='Watch the strokes';}
  canvas.onpointerdown=e=>{if(e.button!==0||pointer!==null)return;e.preventDefault();stopDemo();pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);current=[point(e)];draw();};
  canvas.onpointermove=e=>{if(pointer!==e.pointerId||!current)return;e.preventDefault();let events=e.getCoalescedEvents?.()||[];if(!events.length)events=[e];for(const event of events){const p=point(event);if(distanceEnough(current.at(-1),p))current.push(p);}if(current.length>4000)current=current.filter((_,i)=>i%2===0);draw();};
  function end(e){if(pointer!==e.pointerId||!current)return;if(e.type==='pointerup'){const p=point(e);if(distanceEnough(current.at(-1),p))current.push(p);}strokes.push(current);current=null;pointer=null;changed();}
  canvas.onpointerup=end;canvas.onpointercancel=end;
  find('#show-guide').onchange=()=>{stopDemo();draw();update();};
  if(find('#show-stroke-markers'))find('#show-stroke-markers').onchange=draw;
  function selectGuide(value){guide=fitGuide(value,width,height);draw();update();}
  if(script){
    loadGuides().then(data=>{if(!alive)return;fontGuide=data.guides[item.id];if(!fontGuide)throw Error('No tracing guide for this symbol.');selectGuide(custom||fontGuide);}).catch(e=>{if(alive)find('#trace-plan').textContent=e.message;});
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
    find('#check-handwriting').onclick=async()=>{
      if(recognizing)return;
      if(!meaningfulInk(strokes)){notify('Draw a complete symbol first.');return;}
      if(ocrRevision===revision){notify('This drawing was already checked. Change it to make a new OCR request.');return;}
      const submitted=revision,button=find('#check-handwriting');recognizing=true;button.disabled=true;button.textContent='Reading your ink…';
      try{
        const endpoint=validateEndpoint(find('#ocr-endpoint').value);try{localStorage.setItem('bhaasa.ocr.gateway',endpoint);}catch{}
        abort=new AbortController();const timer=setTimeout(()=>abort?.abort(),45000);
        let response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:inkImage(strokes,width,height)}),signal:abort.signal});}finally{clearTimeout(timer);}
        if(!response.ok){const messages={503:'The OCR gateway has no OpenAI key configured. Run it locally with your .env.local file.',404:'No OCR gateway was found at this address. Update and restart your local Bhaasa server.'};throw Error(messages[response.status]||`OCR returned HTTP ${response.status}. Check the gateway, model access, and billing.`);}
        const result=await response.json();if(!alive)return;if(submitted!==revision){notify('Your drawing changed during recognition. Check the new drawing again.');return;}
        if(typeof result.legible!=='boolean'||!(typeof result.text==='string'||result.text===null))throw Error('The OCR service returned an invalid recognition result.');
        ocrRevision=submitted;const matched=result.legible&&result.text?recognitionMatches(result.text,item.ml):null;
        find('#ocr-feedback').innerHTML=`<section class="trace-result ${matched===true?'trace-good':''}"><h3>${matched===null?'The drawing could not be read reliably.':matched?'OCR read the symbol you were practising.':'OCR read a different symbol.'}</h3>${result.text?`<p class="ocr-reading">Read as <span lang="ml" class="ml">${esc(result.text)}</span>${matched===false?` · practising <span lang="ml" class="ml">${esc(item.ml)}</span>`:''}</p>`:''}<p>Only your ink was sent; the guide and expected answer were excluded. OCR can make mistakes. Use its reading alongside the tracing feedback.</p></section>`;
        onRecognition({text:result.text,matched,drawingId:draftId});
      }catch(e){if(alive)find('#ocr-feedback').innerHTML=`<p class="notice" role="status">${esc(e.name==='AbortError'?'OCR timed out. Try again when the gateway is available.':e.message)} Your drawing and offline tracing checks are still available.</p>`;}
      finally{abort=null;recognizing=false;if(alive){button.textContent='Check with OpenAI OCR (online)';update();}}
    };
    find('#export-trace').onclick=()=>download(new Blob([JSON.stringify({format:'bhaasa-trace-v1',itemId:item.id,ml:item.ml,width,height,paths:cleanDraft(strokes).map(p=>p.map(({x,y})=>[x,y]))},null,2)],{type:'application/json'}),`bhaasa-${item.id}-strokes.json`);
    find('#import-stroke-guide').onchange=async e=>{
      try{const f=e.target.files[0];if(!f)return;if(f.size>200000)throw Error('Choose a stroke guide smaller than 200 KB.');const data=JSON.parse(await f.text());
        if(data.format!=='bhaasa-trace-v1'||data.itemId!==item.id||data.ml!==item.ml||!Array.isArray(data.paths)||!data.paths.length||data.paths.length>12||data.paths.flat().length>5000||!data.paths.every(p=>Array.isArray(p)&&p.length>1&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(n=>Number.isFinite(n)&&n>=0&&n<=2000))))throw Error('Choose a valid Bhaasa stroke guide for this exact symbol.');
        custom={ml:item.ml,paths:data.paths,source:'imported practice guide',reviewed:false};onGuide(custom);selectGuide(custom);changed();notify('Custom stroke guide loaded. Its shape and order need human review.');
      }catch(error){notify(error.message);}finally{e.target.value='';}
    };
    find('#use-font-guide').onclick=()=>{custom=null;onGuide(null);if(fontGuide)selectGuide(fontGuide);changed();};
  }
  draw();update();
  if(script&&saved?.last?.drawingId===draftId)find('#trace-feedback').innerHTML=`<section class="trace-result"><h3>Saved tracing check</h3><p>Guide fit ${Math.round(saved.last.fit*100)}% · smoothness ${Math.round(saved.last.smoothness*100)}% · ${saved.last.strokeCount} strokes. You can check the unchanged drawing again without adding another attempt.</p></section>`;
  if(script&&saved?.ocr?.lastDrawingId===draftId)find('#ocr-feedback').innerHTML=`<section class="trace-result"><h3>Saved OCR reading</h3><p>${saved.ocr.lastText?`<span class="ml" lang="ml">${esc(saved.ocr.lastText)}</span>`:'Uncertain / unreadable'} · ${saved.ocr.lastMatched===true?'matched this symbol':saved.ocr.lastMatched===false?'read a different symbol':'not graded'}. Change the drawing to request a new reading.</p></section>`;
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
