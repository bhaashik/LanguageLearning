import {nextReview} from './repetition.js';
export const STORAGE_KEY = 'bhaasa.progress.v2';
export const LEGACY_STORAGE_KEY = 'aksharam.progress.v1';
export const SESSION_GAP=30*60*1000;
export const emptyProgress = (language='ml') => ({version:2,language,items:{},lessons:{},activity:{},session:null,ui:null,recent:[],writing:{},speaking:{}});
const emptyRecognition=()=>({requests:0,judged:0,correct:0,lastText:null,lastMatched:null,lastDrawingId:null,lastRecognitionKey:null,lastProvider:null,lastModel:null,readings:[]});
const emptyWriting=()=>({attempts:0,bestFit:0,last:null,draft:[],draftId:null,customGuide:null,ocr:emptyRecognition()});
const writingSession=()=>({checks:0,totalFit:0,ocrRequests:0,ocrJudged:0,ocrCorrect:0});
const unit=n=>Number.isFinite(n)&&n>=0&&n<=1;
const counter=n=>Number.isSafeInteger(n)&&n>=0;
const cleanReadings=readings=>Array.isArray(readings)?readings.filter(r=>r&&typeof r.drawingId==='string'&&r.drawingId.length<80&&typeof r.recognitionKey==='string'&&r.recognitionKey.length<1600&&(r.text===null||typeof r.text==='string'&&r.text.length<=80)&&(r.matched===null||typeof r.matched==='boolean')).slice(-20).map(r=>({drawingId:r.drawingId,recognitionKey:r.recognitionKey,text:r.text,matched:r.matched,provider:typeof r.provider==='string'?r.provider.slice(0,64):null,model:typeof r.model==='string'?r.model.slice(0,150):null})):[];
const validDraft=paths=>Array.isArray(paths)&&paths.length<=80&&paths.reduce((n,p)=>n+(Array.isArray(p)?p.length:20000),0)<=12000&&paths.every(p=>Array.isArray(p)&&p.length&&p.every(q=>q&&Number.isFinite(q.x)&&q.x>=0&&q.x<=800&&Number.isFinite(q.y)&&q.y>=0&&q.y<=600));

export function validateProgress(value, validIds, lessonIds,language=value?.language||'ml') {
  if (!value || ![1,2].includes(value.version) || !value.items || typeof value.items !== 'object' || !value.lessons || typeof value.lessons !== 'object' || !value.activity || typeof value.activity !== 'object') throw new Error('Not a Bhaasa progress file.');
  if(!['ml','fr'].includes(language)||(value.language||'ml')!==language)throw Error('This backup belongs to a different learning language. Switch languages before importing it.');
  const clean = emptyProgress(language);
  for (const [id,item] of Object.entries(value.items || {})) {
    if (!validIds.has(id)) continue;
    if (!item || !Number.isSafeInteger(item.attempts) || item.attempts < 1 || !Number.isSafeInteger(item.correct) || item.correct < 0 || item.correct > item.attempts || !Number.isInteger(item.stage) || item.stage < 0 || item.stage > 5 || !Number.isFinite(item.due) || item.due < 0) throw new Error('Invalid review data.');
    clean.items[id] = {attempts:item.attempts,correct:item.correct,stage:item.stage,due:item.due};
  }
  for (const [id, score] of Object.entries(value.lessons || {})) {
    if (lessonIds.has(id) && typeof score === 'number' && score >= 0 && score <= 1) clean.lessons[id]=score;
  }
  for (const [day, count] of Object.entries(value.activity || {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isSafeInteger(count) && count > 0) clean.activity[day]=count;
  }
  if(value.version===2) {
    clean.recent=Array.isArray(value.recent)?value.recent.filter(id=>validIds.has(id)).slice(-8):[];
    const s=value.session;
    if(s&&Number.isFinite(s.startedAt)&&Number.isFinite(s.lastAt)&&s.lastAt>=s.startedAt&&s.sections&&typeof s.sections==='object'){
      const counters={};
      for(const id of ['script','phonetics','words','phrases','grammar','constructions']){
        const count=s.sections[id];
        if(count&&Number.isSafeInteger(count.total)&&Number.isSafeInteger(count.correct)&&count.total>=0&&count.correct>=0&&count.correct<=count.total)counters[id]={total:count.total,correct:count.correct};
      }
      clean.session={startedAt:s.startedAt,lastAt:s.lastAt,sections:counters};
      const sp=s.speaking;if(sp&&counter(sp.attempts)&&counter(sp.matches)&&sp.matches<=sp.attempts&&Number.isFinite(sp.totalCoverage)&&sp.totalCoverage>=0&&sp.totalCoverage<=sp.attempts)clean.session.speaking={attempts:sp.attempts,matches:sp.matches,totalCoverage:sp.totalCoverage};
      const w=s.writing;clean.session.writing=w&&counter(w.checks)&&Number.isFinite(w.totalFit)&&w.totalFit>=0&&w.totalFit<=w.checks&&counter(w.ocrRequests)&&counter(w.ocrJudged)&&counter(w.ocrCorrect)&&w.ocrCorrect<=w.ocrJudged&&w.ocrJudged<=w.ocrRequests?{checks:w.checks,totalFit:w.totalFit,ocrRequests:w.ocrRequests,ocrJudged:w.ocrJudged,ocrCorrect:w.ocrCorrect}:writingSession();
    }
    if(value.ui&&typeof value.ui==='object'&&typeof value.ui.route==='string'&&/^[a-z]+(?:\/[a-z0-9-]+)?$/.test(value.ui.route)&&value.ui.route.length<100){
      clean.ui={route:value.ui.route,studyIndex:Number.isInteger(value.ui.studyIndex)?Math.max(0,Math.min(value.ui.studyIndex,100)):0,activeScript:String(value.ui.activeScript||'Vowels').slice(0,30),wordGroup:String(value.ui.wordGroup||'All words').slice(0,40),search:String(value.ui.search||'').slice(0,200),quiz:value.ui.quiz&&typeof value.ui.quiz==='object'?value.ui.quiz:null};
      for(const key of ['syllableBase','syllablePattern'])if(typeof value.ui[key]==='string'&&/^[a-z0-9-]{1,40}$/.test(value.ui[key]))clean.ui[key]=value.ui[key];
      if(['Vowels','Consonants','Vowel signs','Chillus','Conjuncts'].includes(value.ui.soundFeatureGroup))clean.ui.soundFeatureGroup=value.ui.soundFeatureGroup;
    }
    for(const [id,w] of Object.entries(value.writing||{})){
      if(!validIds.has(id)||!w||!counter(w.attempts)||!unit(w.bestFit))continue;
      const cleanItem=emptyWriting();cleanItem.attempts=w.attempts;cleanItem.bestFit=w.bestFit;
      if(typeof w.draftId==='string'&&w.draftId.length<80)cleanItem.draftId=w.draftId;
      if(validDraft(w.draft))cleanItem.draft=w.draft.map(p=>p.map(({x,y})=>({x,y})));
      if(w.last&&unit(w.last.fit)&&unit(w.last.smoothness)&&counter(w.last.strokeCount))cleanItem.last={fit:w.last.fit,smoothness:w.last.smoothness,strokeCount:w.last.strokeCount,passed:w.last.passed===true,drawingId:typeof w.last.drawingId==='string'?w.last.drawingId.slice(0,80):null};
      const g=w.customGuide;
      if(g&&typeof g.ml==='string'&&Array.isArray(g.paths)&&g.paths.length>0&&g.paths.length<=12&&g.paths.flat().length<=5000&&g.paths.every(p=>Array.isArray(p)&&p.length>1&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(n=>Number.isFinite(n)&&n>=0&&n<=2000))))cleanItem.customGuide={ml:g.ml,paths:g.paths,source:'imported practice guide',reviewed:false};
      const o=w.ocr;
      if(o&&counter(o.requests)&&counter(o.judged)&&counter(o.correct)&&o.correct<=o.judged&&o.judged<=o.requests){
        const readings=cleanReadings(o.readings);
        cleanItem.ocr={requests:o.requests,judged:o.judged,correct:o.correct,lastText:typeof o.lastText==='string'?o.lastText.slice(0,80):null,lastMatched:typeof o.lastMatched==='boolean'?o.lastMatched:null,lastDrawingId:typeof o.lastDrawingId==='string'?o.lastDrawingId.slice(0,80):null,lastRecognitionKey:typeof o.lastRecognitionKey==='string'?o.lastRecognitionKey.slice(0,1600):null,lastProvider:typeof o.lastProvider==='string'?o.lastProvider.slice(0,64):null,lastModel:typeof o.lastModel==='string'?o.lastModel.slice(0,150):null,readings};
      }
      clean.writing[id]=cleanItem;
    }
    for(const [id,s] of Object.entries(value.speaking||{})){
      if(validIds.has(id)&&s&&counter(s.attempts)&&counter(s.matches)&&s.matches<=s.attempts&&Number.isInteger(s.stage)&&s.stage>=0&&s.stage<=5&&Number.isFinite(s.due)&&s.due>=0&&typeof s.lastTranscript==='string'&&s.lastTranscript.length<=2000&&unit(s.lastCoverage)&&Number.isFinite(s.lastAt))clean.speaking[id]={attempts:s.attempts,matches:s.matches,stage:s.stage,due:s.due,lastTranscript:s.lastTranscript,lastCoverage:s.lastCoverage,lastAt:s.lastAt,source:String(s.source||'asr').slice(0,64)};
    }
  }
  return clean;
}
export function startSession(progress,now=Date.now()) {return {...progress,session:{startedAt:now,lastAt:now,sections:{},writing:writingSession(),speaking:{attempts:0,matches:0,totalCoverage:0}}};}
export function ensureSession(progress,now=Date.now()) {return !progress.session||now-progress.session.lastAt>SESSION_GAP?startSession(progress,now):progress;}
export function sectionFromId(id){if(/^(ml|fr)-use-/.test(id))return 'constructions';const local=id.replace(/^fr-/,'');return local.startsWith('sound-')?'phonetics':local.startsWith('grammar-')?'grammar':local.startsWith('phrase-')?'phrases':/^(v|vel|pal|ret|den|lab|oth|letter|sign|ch|cj)-/.test(local)?'script':'words';}
export function sectionScores(progress,lookup) {
  const result={};
  for(const [id,item] of Object.entries(progress.items)){
    const section=lookup[id]?.section||sectionFromId(id);
    const old=result[section]||{total:0,correct:0};
    result[section]={total:old.total+item.attempts,correct:old.correct+item.correct};
  }
  return result;
}
export function updateWriting(progress,id,patch){return {...progress,writing:{...(progress.writing||{}),[id]:{...emptyWriting(),...progress.writing?.[id],...patch}}};}
export function recordTrace(progress,id,result,now=Date.now()){
  if(!result.assessable||!unit(result.fit)||!unit(result.smoothness)||!counter(result.strokeCount))return progress;
  progress=ensureSession(progress,now);const old=progress.writing?.[id]||emptyWriting(),s=progress.session.writing||writingSession();
  if(result.drawingId&&old.last?.drawingId===result.drawingId)return progress;
  progress=updateWriting(progress,id,{attempts:old.attempts+1,bestFit:Math.max(old.bestFit,result.fit),last:{fit:result.fit,smoothness:result.smoothness,strokeCount:result.strokeCount,passed:result.passed===true,drawingId:result.drawingId||null}});
  return {...progress,session:{...progress.session,lastAt:now,writing:{...s,checks:s.checks+1,totalFit:s.totalFit+result.fit}}};
}
export function recordHandwritingRecognition(progress,id,{text,matched,drawingId,recognitionKey,provider,model,previousReadings=[],force=false},now=Date.now()){
  progress=ensureSession(progress,now);const old=progress.writing?.[id]||emptyWriting(),o=old.ocr,s=progress.session.writing||writingSession(),judged=typeof matched==='boolean';
  const key=recognitionKey||'legacy',readings=cleanReadings([...(o.readings||[]),...previousReadings]);
  if(!force&&drawingId&&(readings.some(r=>r.drawingId===drawingId&&r.recognitionKey===key)||(!recognitionKey&&o.lastDrawingId===drawingId)))return progress;
  const reading={drawingId:drawingId||null,recognitionKey:key,text:typeof text==='string'?text.slice(0,80):null,matched:judged?matched:null,provider:typeof provider==='string'?provider.slice(0,64):null,model:typeof model==='string'?model.slice(0,150):null};
  const unique=readings.filter((r,i)=>readings.findIndex(v=>v.drawingId===r.drawingId&&v.recognitionKey===r.recognitionKey)===i);
  progress=updateWriting(progress,id,{ocr:{requests:o.requests+1,judged:o.judged+Number(judged),correct:o.correct+Number(matched===true),lastText:reading.text,lastMatched:reading.matched,lastDrawingId:reading.drawingId,lastRecognitionKey:key,lastProvider:reading.provider,lastModel:reading.model,readings:drawingId?[...unique.filter(r=>r.drawingId!==drawingId||r.recognitionKey!==key),reading].slice(-20):unique}});
  return {...progress,session:{...progress.session,lastAt:now,writing:{...s,ocrRequests:s.ocrRequests+1,ocrJudged:s.ocrJudged+Number(judged),ocrCorrect:s.ocrCorrect+Number(matched===true)}}};
}

export function localDay(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function recordAnswer(progress, id, correct, now=Date.now(), section=sectionFromId(id)) {
  progress=ensureSession(progress,now);
  const old=progress.items[id] || {attempts:0,correct:0,stage:0};
  const review=nextReview(progress.items[id],correct,now);
  return {...progress,
    items:{...progress.items,[id]:{attempts:old.attempts+1,correct:old.correct+Number(correct),...review}},
    activity:{...progress.activity,[localDay(now)]:(progress.activity[localDay(now)]||0)+1},
    session:{...progress.session,lastAt:now,sections:{...progress.session.sections,[section]:{total:(progress.session.sections[section]?.total||0)+1,correct:(progress.session.sections[section]?.correct||0)+Number(correct)}}},
    recent:[...progress.recent.filter(previous=>previous!==id),id].slice(-8)
  };
}

export function dueItems(progress, items, now=Date.now()) {
  return items.filter(item=>progress.items[item.id]?.due<=now).sort((a,b)=>progress.items[a.id].due-progress.items[b.id].due);
}
export function shuffle(items, random=Math.random) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}
export const answerFor = item => item.answer || (item.kind==='word' || item.kind==='phrase' ? item.meaning : item.roman);
export function choicesFor(item, pool, random=Math.random) {
  if(item.options)return shuffle(item.options,random);
  const correct=answerFor(item);
  const distractors=[...new Set(pool.map(answerFor))].filter(answer=>answer!==correct);
  return shuffle([correct,...shuffle(distractors,random).slice(0,3)],random);
}
export function finishLesson(progress, id, correct, total) {
  const score=total>0 ? correct/total : 0;
  return {...progress, lessons:{...progress.lessons,[id]:Math.max(progress.lessons[id]||0,score)}};
}
