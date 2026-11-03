export const STORAGE_KEY = 'bhaasa.progress.v2';
export const LEGACY_STORAGE_KEY = 'aksharam.progress.v1';
export const SESSION_GAP=30*60*1000;
export const emptyProgress = () => ({version:2, items:{}, lessons:{}, activity:{},session:null,ui:null,recent:[]});

export function validateProgress(value, validIds, lessonIds) {
  if (!value || ![1,2].includes(value.version) || !value.items || typeof value.items !== 'object' || !value.lessons || typeof value.lessons !== 'object' || !value.activity || typeof value.activity !== 'object') throw new Error('Not a Bhaasa progress file.');
  const clean = emptyProgress();
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
      for(const id of ['script','phonetics','words','phrases','grammar']){
        const count=s.sections[id];
        if(count&&Number.isSafeInteger(count.total)&&Number.isSafeInteger(count.correct)&&count.total>=0&&count.correct>=0&&count.correct<=count.total)counters[id]={total:count.total,correct:count.correct};
      }
      clean.session={startedAt:s.startedAt,lastAt:s.lastAt,sections:counters};
    }
    if(value.ui&&typeof value.ui==='object'&&typeof value.ui.route==='string'&&/^[a-z]+(?:\/[a-z0-9-]+)?$/.test(value.ui.route)&&value.ui.route.length<100){
      clean.ui={route:value.ui.route,studyIndex:Number.isInteger(value.ui.studyIndex)?Math.max(0,Math.min(value.ui.studyIndex,100)):0,activeScript:String(value.ui.activeScript||'Vowels').slice(0,30),wordGroup:String(value.ui.wordGroup||'All words').slice(0,40),search:String(value.ui.search||'').slice(0,200),quiz:value.ui.quiz&&typeof value.ui.quiz==='object'?value.ui.quiz:null};
    }
  }
  return clean;
}
export function startSession(progress,now=Date.now()) {return {...progress,session:{startedAt:now,lastAt:now,sections:{}}};}
export function ensureSession(progress,now=Date.now()) {return !progress.session||now-progress.session.lastAt>SESSION_GAP?startSession(progress,now):progress;}
export function sectionFromId(id){return id.startsWith('sound-')?'phonetics':id.startsWith('grammar-')?'grammar':id.startsWith('phrase-')?'phrases':/^(v|vel|pal|ret|den|lab|oth|sign|ch|cj)-/.test(id)?'script':'words';}
export function sectionScores(progress,lookup) {
  const result={};
  for(const [id,item] of Object.entries(progress.items)){
    const section=lookup[id]?.section||sectionFromId(id);
    const old=result[section]||{total:0,correct:0};
    result[section]={total:old.total+item.attempts,correct:old.correct+item.correct};
  }
  return result;
}

export function localDay(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function recordAnswer(progress, id, correct, now=Date.now(), section=sectionFromId(id)) {
  progress=ensureSession(progress,now);
  const old=progress.items[id] || {attempts:0,correct:0,stage:0};
  const stage=correct ? Math.min(old.stage+1,5) : 0;
  const days=[0,1,3,7,14,30];
  return {...progress,
    items:{...progress.items,[id]:{attempts:old.attempts+1,correct:old.correct+Number(correct),stage,due:now+days[stage]*86400000}},
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
