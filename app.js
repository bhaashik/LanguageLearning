import {vowels, consonants, signs, chillus, conjuncts, scriptItems, words, phrases, grammarItems, phoneticsItems, soundTopics, sections, lessons, allItems, byId} from './content.js';
import {STORAGE_KEY, LEGACY_STORAGE_KEY, emptyProgress, validateProgress, recordAnswer, dueItems, shuffle, answerFor, choicesFor, finishLesson, ensureSession, startSession, sectionScores, updateWriting,recordTrace,recordHandwritingRecognition} from './learning.js';
import {glossLegend} from './linguistics.js';
import {AudioLibrary} from './audio.js';
import {audioPage} from './audio-ui.js';
import {validateEndpoint} from './audio-store.js';
import {defaultOpenAIVoice} from './speech-presets.js';
import {tracingPanel,createTracingPad} from './tracing-pad.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids=new Set(allItems.map(i=>i.id));
const lessonIds=new Set(lessons.map(i=>i.id));
let storageOK=true;
let progress=emptyProgress();
let storageNotice='';
try { const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY); if(raw) progress=validateProgress(JSON.parse(raw),ids,lessonIds); }
catch { storageNotice='Saved progress could not be read. You can still learn; export any new progress to keep a backup.'; }
progress=ensureSession(progress);
const resumed=progress.ui;
let activeScript=resumed?.activeScript||'Vowels';
if(!['Vowels','Consonants','Vowel signs','Chillus','Conjuncts'].includes(activeScript))activeScript='Vowels';
let wordGroup=resumed?.wordGroup||'All words';
let search=resumed?.search||'';
let studyIndex=resumed?.studyIndex||0;
let quiz=null;
let showRecap=Boolean(resumed&&(progress.recent.length||resumed.route!=='learn'));
const initialRoute=location.hash.slice(1);
if(!initialRoute&&resumed?.route)history.replaceState(null,'',`#${resumed.route}`);
let audioVoices=[];
let offlineReady=false;
let installPrompt=null;
let traceCleanup=()=>{};
const audioTargets={...byId};
for(const l of lessons)audioTargets[`lesson-${l.id}`]={id:`lesson-${l.id}`,kind:'lesson',section:l.items[0].section,title:l.title,roman:l.title,ml:l.items.map(i=>i.ml).join(' … ')};
for(const s of sections)audioTargets[`section-${s.id}`]={id:`section-${s.id}`,kind:'section',section:s.id,title:s.title,roman:s.title,ml:allItems.filter(i=>i.section===s.id).map(i=>i.ml).join(' … ')};
let audioTargetId=Object.keys(byId)[0];
const audio=new AudioLibrary(toast);
const icons={
  learn:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 17h4"/>',
  script:'<path d="m4 20 5-1L20 8a2 2 0 0 0-4-4L5 15l-1 5ZM14 6l4 4M4 20h16"/>',
  words:'<path d="M3 5h7a3 3 0 0 1 3 3v13a4 4 0 0 0-4-3H3V5ZM21 5h-5a3 3 0 0 0-3 3v13a4 4 0 0 1 4-3h4V5Z"/>',
  grammar:'<path d="M4 4h16v12H9l-5 4V4ZM8 8h8M8 12h5"/>',
  review:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5M12 7v5l3 2"/>',
  progress:'<path d="M4 20h17M7 16V10M12 16V4M17 16V7"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  leaf:'<path d="M20 3C9 2 3 8 5 14s13 7 15-11ZM5 20 15 9"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'
};
icons.phonetics=icons.sound;icons.audio=icons.sound;
function icon(name,cls='') {return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.learn}</svg>`;}
function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('visible'); clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function save() {try {localStorage.setItem(STORAGE_KEY,JSON.stringify(progress));storageOK=true;} catch {storageOK=false;toast('This browser cannot save progress. Export a backup from Your progress.');}}
function packQuiz(){return quiz?{...quiz,items:quiz.items.map(i=>i.id),pool:quiz.pool.map(i=>i.id)}:null;}
function restoreQuiz(q){
  if(!q||!Array.isArray(q.items)||!q.items.length||q.items.length>8||!q.items.every(id=>ids.has(id))||new Set(q.items).size!==q.items.length||!Number.isInteger(q.index)||q.index<0||q.index>=q.items.length||typeof q.answered!=='boolean'||typeof q.done!=='boolean'||!Array.isArray(q.history)||q.history.length!==q.index+Number(q.answered)||!q.history.every(h=>h&&typeof h.choice==='string'&&h.choice.length<250)||!Array.isArray(q.options)||q.options.length>4||new Set(q.options).size!==q.options.length||!q.options.every(o=>typeof o==='string'&&o.length<250))return null;
  if(q.answered&&!q.options.includes(q.selection))return null;
  if(q.done&&(!q.answered||q.index!==q.items.length-1))return null;
  const items=q.items.map(id=>byId[id]),pool=Array.isArray(q.pool)?q.pool.filter(id=>ids.has(id)).map(id=>byId[id]):items;
  const history=q.history.map((h,i)=>({id:items[i].id,choice:String(h.choice||'').slice(0,250),correct:h.choice===answerFor(items[i])}));
  if(!q.options.includes(answerFor(items[q.index])))return null;
  return {...q,items,pool,history,score:history.filter(h=>h.correct).length,lessonId:lessonIds.has(q.lessonId)?q.lessonId:null};
}
if(route()==='review'&&(!initialRoute||initialRoute===resumed?.route))quiz=restoreQuiz(resumed?.quiz);
function savePosition(){progress=ensureSession(progress);progress={...progress,session:{...progress.session,lastAt:Date.now()},ui:{route:route(),studyIndex,activeScript,wordGroup,search,quiz:packQuiz()}};save();}
function completed(id) {return (progress.lessons[id]||0)>=0.8;}
function due() {return dueItems(progress,allItems);}
function nextLesson() {return lessons.find(l=>!completed(l.id))||lessons[0];}
function playButton(item,small=false) {return `<button type="button" class="${small?'sound-small':'button secondary'}" data-speak="${item.id}" aria-label="Hear ${esc(item.roman)} in Malayalam">${icon('sound')}${small?'':'<span>Listen</span>'}</button>`;}
function ml(text,cls='') {return `<span lang="ml" class="ml ${cls}">${esc(text)}</span>`;}
function route() {return location.hash.slice(1)||'learn';}
function linguistic(item,open=false){
  return `<details class="linguistic-details" ${open?'open':''}><summary>Roman · IPA · Devanagari · gloss</summary><dl><div><dt>Roman</dt><dd>${esc(item.roman)}</dd></div><div><dt>IPA</dt><dd>/${esc(item.ipa)}/ <small>${esc(item.ipaType)}</small></dd></div><div><dt>Extended Devanagari</dt><dd lang="hi" class="deva">${esc(item.devanagari)}</dd></div></dl><p class="gloss-label">${esc(item.glossType)}</p><div class="gloss-parts">${item.gloss.map(p=>`<div><span class="ml" lang="ml">${esc(p.ml)}</span><span>${esc(p.roman)}</span><strong>${esc(p.gloss)}</strong></div>`).join('')}</div><p class="gloss-help">Simplified analysis; joined surface forms can differ from these parts. Devanagari is a script correspondence, not exact Hindi pronunciation. <a href="#about">Gloss key & sound conventions</a></p></details>`;
}
function exampleFor(item){
  if(!item.example)return '';
  const e=item.example;
  if(e.type==='teaching')return `<div class="example-word"><small>TEACHING EXAMPLE · NOT AN EVERYDAY WORD</small><span class="ml" lang="ml">${esc(e.ml)}</span><p>${esc(e.note)}</p></div>`;
  const w=byId[e.itemId];return `<div class="example-word"><small>EXAMPLE WORD</small><a href="#item/${w.id}">${ml(w.ml)}<span>${esc(w.roman)} · ${esc(w.meaning)}</span></a>${linguistic(w)}</div>`;
}
function scoreBar(value,label){
  const score=value?.total?value.correct/value.total:null;
  return `<div class="section-score"><span>${label}</span><div class="score-meter ${score===null?'unscored':score>=.8?'good':score>=.5?'fair':'needs-practice'}" role="img" aria-label="${esc(label)}: ${score===null?'No answers yet':`${value.correct} of ${value.total} correct, ${Math.round(score*100)} percent`}"><i style="width:${score===null?0:score*100}%"></i></div><strong>${score===null?'Not practised':`${Math.round(score*100)}% · ${value.correct}/${value.total}`}</strong></div>`;
}
function scoresPanel(){const overall=sectionScores(progress,byId);return `<section class="section-scores"><div class="section-title"><h2>Each part of your Malayalam</h2><button class="text-button" data-action="new-session">Start a new session</button></div><p class="section-note">Colored bars show answer accuracy, not proficiency. This session survives reloads and restarts after 30 minutes without activity, or when you start a new one.</p><div class="section-score-grid">${sections.map(s=>`<article class="panel"><h3>${s.title}</h3>${scoreBar(progress.session?.sections[s.id],'This session')}${scoreBar(overall[s.id],'Overall')}</article>`).join('')}</div></section>`;}
function recap(){
  let recapIds=progress.recent.slice(-3);
  if(!recapIds.length&&resumed?.route.startsWith('lesson/')){const lesson=lessons.find(l=>l.id===resumed.route.split('/')[1]);const item=lesson?.items[Math.min(resumed.studyIndex,lesson.items.length-1)];if(item)recapIds=[item.id];}
  if(!recapIds.length&&resumed?.route.startsWith('item/')&&byId[resumed.route.split('/')[1]])recapIds=[resumed.route.split('/')[1]];
  return `<section class="recap panel"><div><p class="eyebrow">WELCOME BACK TO BHAASA</p><h2>Pick up where you left off.</h2><p>Your place, current exercise, and scores have been restored. You can still choose any section or lesson.</p></div><div class="recap-items">${recapIds.map(id=>`<div>${ml(byId[id].ml)}<span>${esc(byId[id].roman)} · ${esc(byId[id].meaning)}</span>${linguistic(byId[id])}</div>`).join('')}</div><button class="button primary" data-action="dismiss-recap">Continue here</button></section>`;
}

function shell(content,section) {
  const nav=[['learn','Learn'],['script','Writing system'],['phonetics','Sounds of Malayalam'],['words','Words & phrases'],['grammar','Grammar'],['review','Practice'],['audio','Voices & recordings'],['progress','Your progress']];
  return `<a class="skip" href="#main">Skip to content</a>
  <aside class="sidebar">
    <a class="brand" href="#learn" aria-label="Bhaasa home"><img src="./assets/icon.svg" alt="" width="38" height="38"><span>Bhaasa<small>A LITTLE, EVERY DAY</small></span></a>
    <div class="language"><span class="language-letter" lang="ml">മ</span><div><strong>Malayalam</strong><span>മലയാളം · Beginner</span></div><span class="language-dot"></span></div>
    <nav aria-label="Main navigation">${nav.map(([id,title])=>`<a href="#${id}" class="nav-link ${id===section?'active':''}" ${id===section?'aria-current="page"':''}>${icon(id)}<span>${title}</span>${id==='review'&&due().length?`<span class="nav-count">${due().length}</span>`:''}</a>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="quiet-note">${icon('leaf')}<p>Small steps.<br>A whole new language.</p></div><a href="#about" class="about-link">About & learning sources ${icon('arrow')}</a></div>
  </aside>
  <div class="workspace"><header class="topbar"><span class="breadcrumb">YOUR MALAYALAM JOURNEY</span><div class="topbar-right"><span id="offline-status" class="connection"><i></i>${offlineReady?'Available offline':navigator.onLine?'On this device':'Offline'}</span><span class="avatar" aria-label="Local learner profile">You</span></div></header>
  <main id="main" tabindex="-1">${storageNotice?`<p class="notice">${esc(storageNotice)}</p>`:''}${showRecap?recap():''}${content}</main>
  <footer><span>Made for a little learning, every day.</span><a href="#about">About & learning sources</a><span>Progress stays on this device ${icon('leaf')}</span></footer></div>`;
}
function pageHeading(eyebrow,title,description,extra='') {return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="description">${description}</p></div>${extra}</div>`;}
function dashboard() {
  const done=lessons.filter(l=>completed(l.id)).length;
  const next=nextLesson();
  const learned=Object.keys(progress.items).length;
  return `${pageHeading('സ്വാഗതം · WELCOME','A new language.<br>A little closer.','Find your way into Malayalam, one letter and one small lesson at a time.',`<div class="edition"><span class="edition-dot"></span> THE MALAYALAM EDITION</div>`)}
    <div class="dashboard-grid"><div class="dashboard-main">
    <section class="hero-card" aria-labelledby="hero-title"><div class="hero-copy"><span class="pill">${done?'YOUR NEXT SMALL STEP':'START WITH THE BASICS'}</span><h2 id="hero-title">${done?esc(next.title):'Every word begins<br>with a letter.'}</h2><p>${done?esc(next.subtitle):'Meet the curves, sounds, and little details <br>of the Malayalam writing system.'}</p><a class="button cream" href="#lesson/${next.id}">${done?'Continue learning':'Begin your first lesson'} ${icon('arrow')}</a><span class="hero-meta">5–8 minutes <span>·</span> At your own pace</span></div><div class="hero-art" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="hero-letter" lang="ml">അ</span><span class="art-caption">a / THE FIRST LETTER</span><span class="art-dot"></span></div></section>
    <div class="section-title"><h2>Your learning path</h2><span>${done} of ${lessons.length} lessons complete</span></div>
    <div class="path-list">${lessons.map((l,i)=>`<a href="#lesson/${l.id}" class="lesson-row ${l.id===next.id?'current':''}"><span class="lesson-number ${completed(l.id)?'done':''}">${completed(l.id)?icon('check'):String(i+1).padStart(2,'0')}</span><div class="lesson-label"><small>${l.tag}</small><h3>${l.title}</h3><p>${l.subtitle}</p></div><span class="lesson-duration">${l.items.length} cards</span><span class="round-arrow">${icon('arrow')}</span></a>`).join('')}</div>
    </div><aside class="dashboard-aside"><section class="progress-card"><div class="card-topline"><h2>Your small steps</h2>${icon('leaf')}</div><div class="progress-number">${done}<span> / ${lessons.length}</span></div><p>lessons completed</p><div class="progress-track"><span style="width:${done/lessons.length*100}%"></span></div><div class="mini-stats"><div><strong>${learned}</strong><span>items practised</span></div><div><strong>${Object.keys(progress.activity).length}</strong><span>learning days</span></div></div><a href="#progress" class="text-link">See your progress ${icon('arrow')}</a></section>
    <section class="letter-day"><span class="eyebrow">A LETTER TO GET TO KNOW</span>${ml('മ','featured-letter')}<div><strong>ma</strong><span>/m/ · A labial consonant</span></div><p>Two lips together.<br>A familiar sound, a new shape.</p><a href="#item/lab-4" class="text-link">Meet this letter ${icon('arrow')}</a></section>
    <section class="tip-card"><span class="tip-symbol">✳</span><h3>Let the letters sink in.</h3><p>You don’t need to remember everything at once. A few minutes of practice is a good beginning.</p></section></aside></div>`;
}
const scriptGroups={'Vowels':vowels,'Consonants':consonants,'Vowel signs':signs,'Chillus':chillus,'Conjuncts':conjuncts};
function scriptPage() {
  const descriptions={Vowels:'Independent vowels stand on their own. Compare short vowels with their longer partners.',Consonants:'Consonants normally carry an inherent a. The groups describe where and how you make the sound.','Vowel signs':'See how vowel signs change ക (ka). The full syllable is shown so combining signs stay readable.',Chillus:'Consonant endings without an inherent vowel. Compare ൻ (n) with ന (na).',Conjuncts:'Consonants join together. A doubled consonant is held longer, and can change a word’s meaning.'};
  const items=scriptGroups[activeScript];
  return `${pageHeading('THE BUILDING BLOCKS','A script full of curves.','Explore the letters. Notice the sounds. Make the shapes your own.')}
  <div class="tabs" role="group" aria-label="Script category">${Object.keys(scriptGroups).map(g=>`<button class="tab ${g===activeScript?'selected':''}" data-script="${g}" aria-pressed="${g===activeScript}">${g}<span>${scriptGroups[g].length}</span></button>`).join('')}</div><p class="section-note">${descriptions[activeScript]}</p>
  ${[...new Set(items.map(i=>i.group))].map(group=>`<section class="script-section"><div class="section-title"><h2>${group}</h2><span>Choose a card to explore & write</span></div><div class="alphabet-grid">${items.filter(i=>i.group===group).map(item=>`<article class="letter-tile"><a class="letter-main" href="#item/${item.id}">${ml(item.ml)}<strong>${item.roman}</strong><small>/${esc(item.ipa)}/</small></a>${item.note.startsWith('Rare')?'<span class="rare">Rare</span>':''}${linguistic(item)}${exampleFor(item)}</article>`).join('')}</div></section>`).join('')}
  <div class="notice">Roman spellings and IPA are guides, not recordings. Speech synthesis can misread isolated letters. Use native-speaker audio to refine fine sound distinctions.</div>`;
}
function wordsPage() {
  const groups=['All words',...new Set(words.map(i=>i.group)),'Phrases'];
  return `${pageHeading('A LITTLE EVERYDAY MALAYALAM','Words for the world around you.','From your first cup of tea to finding the right bus. Read first, then check the meaning.')}
  <div class="word-toolbar"><label class="search-field">${icon('search')}<input id="word-search" type="search" placeholder="Search Malayalam, Roman, or English" value="${esc(search)}" aria-label="Search words and phrases"></label><label class="select-label">Category<select id="word-group">${groups.map(g=>`<option ${g===wordGroup?'selected':''}>${g}</option>`).join('')}</select></label></div>
  <div id="word-results">${wordResults()}</div>`;
}
function wordResults() {
  const query=search.trim().normalize('NFC').toLocaleLowerCase();
  const items=[...words,...phrases].filter(i=>(wordGroup==='All words'||(wordGroup==='Phrases'?i.kind==='phrase':i.group===wordGroup)) && `${i.ml} ${i.roman} ${i.meaning}`.normalize('NFC').toLocaleLowerCase().includes(query));
  return `<div class="section-title"><h2>${esc(wordGroup)}</h2><span role="status">${items.length} ${items.length===1?'entry':'entries'}</span></div><div class="word-grid">${items.map(item=>`<article class="word-card"><div class="word-card-top"><span class="eyebrow">${item.kind==='phrase'?'PHRASE':item.group}</span>${playButton(item,true)}</div><a href="#item/${item.id}" class="word-main">${ml(item.ml,item.kind==='phrase'?'phrase':'')}<span class="roman">${item.roman}</span><strong>${item.meaning}</strong></a>${linguistic(item)}</article>`).join('')}</div>${items.length?'':'<div class="empty-state"><h2>No matches yet.</h2><p>Try another spelling or select All words.</p></div>'}`;
}
function grammarPage() {
  return `${pageHeading('PATTERNS, NOT PUZZLES','Make a little sense of it.','Six useful patterns to help the words fit together. Take them one at a time.')}
  <button class="button primary section-practice" data-practice="grammar">Practise grammar patterns ${icon('arrow')}</button><div class="grammar-grid">${grammarItems.map((g,i)=>`<article class="grammar-card"><span class="eyebrow">PATTERN ${String(i+1).padStart(2,'0')}</span><h2>${g.title}</h2><p>${g.body}</p><div class="grammar-example">${ml(g.ml)}<span class="roman">${g.roman}</span><strong>${g.meaning}</strong>${playButton(g,true)}</div>${linguistic(g)}<p class="grammar-note">${g.note}</p></article>`).join('')}</div><p class="section-note">Based on the supplied everyday vocabulary and grammar guide, §§4–6. These are practical starting points; endings and usage depend on the stem, context, and register.</p>`;
}
function phoneticsPage(){return `${pageHeading('PHONETICS & PHONOLOGY','Sounds of Malayalam','How a sound is made, how it contrasts with others, and what changes in connected speech.')}<button class="button primary section-practice" data-practice="phonetics">Practise sound contrasts ${icon('arrow')}</button><p class="notice">IPA is a broad guide, not a recording. Word-level IPA is a spelling-based approximation; natural speech can differ. Extended Devanagari uses ऎ, ऒ, ऴ, ऱ and does not imply these contrasts are ordinary Hindi sounds.</p><div class="grammar-grid sounds-grid">${soundTopics.map((t,i)=>`<article class="grammar-card"><span class="eyebrow">SOUND PATTERN ${i+1}</span><h2>${t.title}</h2><p>${t.body}</p><div class="sound-examples">${t.examples.map(text=>{const item=allItems.find(i=>i.ml===text&&i.kind==='word');return `<div><a href="#item/${item.id}">${ml(item.ml)}<strong>${item.meaning}</strong></a>${playButton(item,true)}${linguistic(item)}</div>`;}).join('')}</div></article>`).join('')}</div>`;}
function lessonPage(id) {
  const lesson=lessons.find(l=>l.id===id);if(!lesson)return notFound();
  studyIndex=Math.min(studyIndex,lesson.items.length-1);
  const item=lesson.items[studyIndex]||lesson.items[0];
  return `<a class="back-link" href="#learn">${icon('back')} Your learning path</a>${pageHeading(lesson.tag.toUpperCase(),lesson.title,lesson.note)}
  <div class="study-layout"><section class="study-card"><div class="card-topline"><span class="eyebrow">CARD ${studyIndex+1} OF ${lesson.items.length}</span>${playButton(item,true)}</div><div class="study-content">${ml(item.ml,item.kind==='phrase'?'phrase':'')}<span class="study-roman">${item.roman}</span>${item.kind==='word'||item.kind==='phrase'?`<h2>${item.meaning}</h2>`:`<p class="ipa">/${esc(item.ipa)}/</p>`}<p>${item.note||'Take a moment to notice the shape. Read it aloud, then try it without the Roman spelling.'}</p></div>${linguistic(item)}${exampleFor(item)}<div class="study-controls"><button class="button secondary" data-action="previous-card" ${studyIndex===0?'disabled':''}>${icon('back')} Previous</button><a class="text-link" href="#item/${item.id}">Explore & write</a><button class="button primary" data-action="next-card" data-lesson="${lesson.id}">${studyIndex===lesson.items.length-1?'Try the practice':'Next card'} ${icon('arrow')}</button></div></section>
  <aside class="lesson-aside"><h2>In this lesson</h2><div class="lesson-card-list">${lesson.items.map((i,n)=>`<button class="card-jump ${n===studyIndex?'selected':''}" data-card="${n}" ${n===studyIndex?'aria-current="step"':''}>${ml(i.ml)}<span>${i.roman}</span></button>`).join('')}</div><p class="section-note">Review these cards, then answer a short quiz. A score of 80% completes the lesson. You can revisit it anytime.</p><button class="button secondary full" data-quiz="${lesson.id}">Start practice ${icon('arrow')}</button></aside></div>`;
}
function itemPage(id) {
  const item=byId[id];if(!item)return notFound();
  const isWord=!['letter','sign','chillu','conjunct'].includes(item.kind);
  return `<a class="back-link" href="#${isWord?'words':'script'}">${icon('back')} ${isWord?'Words & phrases':'Writing system'}</a>${pageHeading(item.group.toUpperCase(),isWord?'Look. Read. Remember.':'Get a feel for the letter.','Take your time. Learning a new shape starts with noticing it.')}
  <div class="item-layout"><section class="detail-card">${ml(item.ml,item.kind==='phrase'?'phrase':'')}<div class="study-roman">${item.roman}</div>${isWord?`<h2>${item.meaning}</h2>`:`<p class="ipa">/${esc(item.ipa)}/</p>`}<p>${item.note||'Look at the curves and the relative size of each part. The Roman spelling helps you recognize the written form.'}</p>${playButton(item)}<a class="text-link audio-link" href="#audio/${item.id}">Choose a voice, generate, or record</a><p id="voice-note" class="audio-note">${voiceNote()}</p>${linguistic(item,true)}${exampleFor(item)}</section>
  ${tracingPanel(item,!isWord,progress.writing?.[item.id])}</div>`;
}
function reviewPage() {
  if(quiz)return quizPage();
  const review=due();
  const practised=Object.keys(progress.items).length;
  return `${pageHeading('MAKE IT FAMILIAR','A little practice goes a long way.','Come back to what you’ve learned, or give yourself a fresh set of questions.')}
  <div class="review-grid"><section class="review-card"><span class="pill light">YOUR REVIEW</span><div class="review-count">${review.length}<span>items due</span></div><h2>${review.length?'Ready for another look?':'A little space to remember.'}</h2><p>${review.length?'These items are ready to revisit. Missed answers return sooner; correct answers get more time.':practised?'Your reviews are up to date. You can practise learned items again whenever you like.':'Start with a lesson to build your review collection. Your answers will shape what comes back next.'}</p><button class="button primary" data-action="due-quiz" ${!practised?'disabled':''}>${review.length?'Review due items':'Practise learned items'} ${icon('arrow')}</button></section>
  <section class="practice-options"><h2>Or pick a starting point</h2>${[['vowels','Vowel recognition','Match a Malayalam vowel to its Roman spelling.'],['words','Everyday words','Read a word and choose its meaning.'],['phrases','Useful phrases','Make sense of a whole sentence.']].map(([id,t,d])=>`<button class="practice-option" data-practice="${id}"><span><strong>${t}</strong><small>${d}</small></span>${icon('arrow')}</button>`).join('')}<p class="section-note">These are reading and recall exercises. Listen buttons are optional pronunciation aids, not listening tests.</p></section></div>`;
}
function startQuiz(items,lessonId=null) {
  if(!items.length)return;
  const pool=items.length>3?items:allItems.filter(i=>i.kind===items[0].kind);
  quiz={items:shuffle(items).slice(0,Math.min(8,items.length)),pool,index:0,score:0,answered:false,selection:null,lessonId,done:false,history:[]};
  quiz.options=quizChoices(quiz.items[0],pool);
  if(route()==='review')render();else location.hash='review';
}
function quizChoices(item,pool) {
  const related=pool.filter(i=>i.kind===item.kind);
  return choicesFor(item,related.length>=4?related:allItems.filter(i=>i.kind===item.kind));
}
function quizPage() {
  if(quiz.done) {
    const passed=quiz.score/quiz.items.length>=.8;
    return `${pageHeading('A LITTLE MORE FAMILIAR',passed?'Look how far you’ve come.':'Every attempt is practice.','Take another look at anything that felt unfamiliar. There’s no rush.')}
    <section class="result-card"><div class="result-symbol">${icon(passed?'check':'leaf')}</div><h2>${quiz.score} out of ${quiz.items.length}</h2><p>${quiz.lessonId?(passed?'Lesson complete. You can revisit it anytime.':'A score of 80% completes this lesson. Your best score is saved; try again when you’re ready.'):'Your review schedule has been updated. Missed items are ready to revisit now.'}</p><div class="button-row"><button class="button primary" data-action="retry-quiz">Practise again ${icon('arrow')}</button><a class="button secondary" href="#learn">Back to learning</a></div></section><section class="answer-key-list"><div class="section-title"><h2>All correct answers for this exercise</h2><span>${quiz.items.length} answers</span></div>${quiz.items.map((item,i)=>`<article class="panel correct-answer"><span class="eyebrow">QUESTION ${i+1} · ${quiz.history[i]?.correct?'CORRECT':'REVISIT'}</span>${item.question?`<h3>${esc(item.question)}</h3>`:''}<div>${ml(item.ml)}<strong>${esc(answerFor(item))}</strong>${playButton(item,true)}</div><p>Your answer: ${esc(quiz.history[i]?.choice||'—')}</p>${linguistic(item)}</article>`).join('')}</section>`;
  }
  const item=quiz.items[quiz.index];
  const correct=answerFor(item);
  return `<button class="back-link plain" data-action="exit-quiz">${icon('back')} Leave practice</button><div class="quiz-header"><span class="eyebrow">${quiz.lessonId?'LESSON PRACTICE':'A LITTLE RECALL'}</span><span>${quiz.index+1} / ${quiz.items.length}</span></div><div class="progress-track quiz-track"><span style="width:${quiz.index/quiz.items.length*100}%"></span></div>
  <section class="quiz-card"><h1>${esc(item.question||(['word','phrase'].includes(item.kind)?'What does this mean?':'Which Roman spelling matches?'))}</h1><div class="quiz-prompt">${ml(item.ml,item.kind==='phrase'||item.kind==='grammar'?'phrase':'')}${playButton(item,true)}</div><div class="answers">${quiz.options.map((option,n)=>`<button class="answer ${quiz.answered&&option===correct?'correct':''} ${quiz.answered&&option===quiz.selection&&option!==correct?'incorrect':''}" data-answer="${n}" ${quiz.answered?'disabled':''}><span class="answer-key">${n+1}</span>${esc(option)}${quiz.answered&&option===correct?icon('check'):''}</button>`).join('')}</div>
  ${quiz.answered?`<div id="answer-feedback" tabindex="-1" class="answer-feedback ${quiz.selection===correct?'success':'retry'}" role="status"><strong>${quiz.selection===correct?'That’s right.':'A little reminder.'}</strong><p>Correct answer: ${esc(correct)}</p><p>${ml(item.ml)} · ${esc(item.roman)}${['word','phrase'].includes(item.kind)?` · ${esc(item.meaning)}`:''}</p>${item.note?`<p>${esc(item.note)}</p>`:''}${linguistic(item)}<button class="button primary" data-action="quiz-next">${quiz.index===quiz.items.length-1?'See how you did':'Continue'} ${icon('arrow')}</button></div>`:'<p class="quiz-hint">Take your time. Choose the answer that feels familiar.</p>'}</section>`;
}
function progressPage() {
  const entries=Object.values(progress.items);
  const answers=entries.reduce((n,i)=>n+i.attempts,0);
  const correct=entries.reduce((n,i)=>n+i.correct,0);
  const done=lessons.filter(l=>completed(l.id)).length;
  return `${pageHeading('YOUR JOURNEY, AT YOUR PACE','Small steps add up.','Your progress is saved in this browser. No account, subscription, or server needed.')}
  <div class="stats-grid">${[[done,'lessons completed'],[entries.length,'items practised'],[answers?`${Math.round(correct/answers*100)}%`:'—','answers correct'],[Object.keys(progress.activity).length,'learning days']].map(([n,label])=>`<section class="stat-card"><strong>${n}</strong><span>${label}</span></section>`).join('')}</div>
  ${scoresPanel()}${writingSummary()}<div class="section-title"><h2>Your lesson notebook</h2><span>80% to complete a lesson</span></div><div class="score-list">${lessons.map(l=>`<a href="#lesson/${l.id}" class="score-row"><span>${l.title}</span><div class="progress-track"><span style="width:${(progress.lessons[l.id]||0)*100}%"></span></div><strong>${l.id in progress.lessons?`${Math.round(progress.lessons[l.id]*100)}%`:'Not started'}</strong>${completed(l.id)?icon('check'):icon('arrow')}</a>`).join('')}</div>
  <section class="backup-card"><div><h2>Keep your notebook safe.</h2><p>Clearing browser data removes your progress. Export a small backup to keep it, or move it to another device.</p>${!storageOK?'<p class="notice">Browser storage is unavailable. Export before closing this page.</p>':''}</div><div class="button-row"><button class="button primary" data-action="export">${icon('download')} Export progress</button><label class="button secondary file-button">Import backup<input type="file" id="import-progress" accept="application/json,.json"></label><button class="text-button danger" data-action="reset">Reset progress</button></div></section>`;
}
function aboutPage() {
  return `${pageHeading('A SMALL BEGINNING','A quieter way to learn.','Bhaasa is a simple, independent starting point for learning Malayalam.')}
  <div class="about-content"><section><h2>Built around your guides</h2><p>The lessons adapt the two PDFs supplied for this project: <strong>Malayalam Writing System</strong> and <strong>Malayalam in Everyday Life</strong>. The script reference follows the first guide; vocabulary, phrases, and grammar follow the second. The full documents are not bundled in the app.</p><p>Roman spellings are scholarly transliterations rather than English sound-alikes. IPA gives a broad approximation. Pronunciation, usage, and spelling conventions can vary by region and register. This first curriculum would benefit from a native Malayalam teacher’s review.</p></section>
  <section><h2>A note about sound and glosses</h2><p id="voice-note">${voiceNote()}</p><p>Choose a voice in Voices & recordings. Listen reuses a saved file for that exact provider/model/voice and content text, or uses the selected device/service voice. Device speech may require internet and cannot be captured to a file through Web Speech. Neither guide contains recordings; microphone, file imports, and connected speech services can add them.</p><p>IPA for words and sentences is a broad, spelling-based teaching approximation, not a verified transcription of natural speech. Extended Devanagari is a comparative script correspondence using ऎ, ऒ, ऴ, and ऱ. It does not equate Malayalam sounds with ordinary Hindi pronunciation. Glosses segment grammatical constructions where useful; lexical words can be unsplit, and letters are sound units rather than morphemes.</p><p>${glossLegend}</p></section>
  <section><h2>Take it offline</h2><p id="offline-detail">${offlineReady?'The app and lessons have been saved for offline use on this device.':'The app saves its lesson files for offline use when served over HTTPS or localhost. Allow the first visit to finish loading before going offline.'}</p><p>On a supported browser, use “Install app” or “Add to Home Screen”. On iPhone and iPad, open the site in Safari and choose Share → Add to Home Screen. Offline storage can be removed by your browser; keep progress and audio backups.</p><button id="install-button" class="button primary" data-action="install" ${installPrompt?'':'hidden'}>Install Bhaasa ${icon('download')}</button></section>
  <section><h2>A notebook on your device</h2><p>Your progress stays in this browser’s local storage. There is no sign-in or analytics. Using device speech may involve your browser’s speech provider. Export or import your progress on the Your progress page.</p></section></div>`;
}
function notFound() {return `${pageHeading('A SMALL DETOUR','This page isn’t here.','Head back to your learning path to pick up where you left off.')}<a class="button primary" href="#learn">Back to learning ${icon('arrow')}</a>`;}

function render(focus=false) {
  traceCleanup();
  const [page,id]=route().split('/');
  let content,section=page;
  switch(page) {
    case 'learn':content=dashboard();break;
    case 'script':content=scriptPage();break;
    case 'words':content=wordsPage();break;
    case 'grammar':content=grammarPage();break;
    case 'phonetics':content=phoneticsPage();break;
    case 'audio':if(id&&audioTargets[id])audioTargetId=id;content=audioPage(audio,audioTargets,audioTargetId);break;
    case 'lesson':section='learn';content=lessonPage(id);break;
    case 'item':section=['word','phrase'].includes(byId[id]?.kind)?'words':'script';content=itemPage(id);break;
    case 'review':content=reviewPage();break;
    case 'progress':content=progressPage();break;
    case 'about':content=aboutPage();section='';break;
    default:content=notFound();
  }
  $('#app').innerHTML=shell(content,section);
  document.body.dataset.route=route();
  document.title=`${({learn:'Learn',script:'Writing system',words:'Words & phrases',grammar:'Grammar',phonetics:'Sounds of Malayalam',audio:'Voices & recordings',lesson:'Lesson',item:'Explore & write',review:'Practice',progress:'Your progress',about:'About'})[page]||'Learn'} · Bhaasa`;
  if(page==='item'&&byId[id])setupCanvas(byId[id]);
  if(focus){$('#main').focus({preventScroll:true});window.scrollTo(0,0);}
  savePosition();
}

function voiceNote() {
  const p=audio.active;
  if(p.kind!=='device')return `Selected voice: ${esc(p.name)} · ${esc(p.provider)} / ${esc(p.model)} / ${esc(p.voice)}. Saved matching audio plays offline; generating new audio requires your connected service or a recording.`;
  const voice=audioVoices.find(v=>v.lang.toLowerCase().replace('_','-').startsWith('ml')&&(p.voice==='default'||p.voice===v.voiceURI||p.voice===v.name));
  if(voice)return `Malayalam speech available: ${esc(voice.name)}.${voice.localService?' This voice runs on your device.':' This voice may need an internet connection.'} Synthetic speech is an aid, not a native-speaker recording.`;
  return 'No Malayalam speech voice is currently available in this browser. Try installing a Malayalam voice in your device’s speech settings, then reopen the app. Roman spelling and IPA remain available.';
}
function updateVoices() {
  audioVoices=window.speechSynthesis?.getVoices()||[];
  audio.refreshVoices();
  if($('#voice-note'))$('#voice-note').innerHTML=voiceNote();
}
async function speak(id) {
  updateVoices();
  const item=byId[id];
  try{await audio.play(item);}catch(e){toast(e.message);}
}

let canvasActions={};
function setupCanvas(item) {
  const history=()=>{const w=progress.writing?.[item.id];const el=$('#writing-history');if(el&&w)el.textContent=`${w.attempts} tracing checks · best fit ${Math.round(w.bestFit*100)}%. OCR: ${w.ocr.correct}/${w.ocr.judged} readable results matched; ${w.ocr.requests-w.ocr.judged} uncertain.`;};
  const pad=createTracingPad({item,script:scriptItems.some(i=>i.id===item.id),saved:progress.writing?.[item.id],notify:toast,
    onDraft:(draft,draftId)=>{progress=updateWriting(progress,item.id,{draft,draftId});save();},
    onCheck:result=>{progress=recordTrace(progress,item.id,result);save();history();},
    onRecognition:result=>{progress=recordHandwritingRecognition(progress,item.id,result);save();history();},
    onGuide:customGuide=>{progress=updateWriting(progress,item.id,{customGuide});save();}
  });
  canvasActions=pad;traceCleanup=()=>{pad.cleanup();canvasActions={};};history();
}
function writingSummary(){
  const entries=Object.entries(progress.writing||{}).filter(([,w])=>w.attempts),checks=entries.reduce((n,[,w])=>n+w.attempts,0),session=progress.session?.writing;
  return `<section class="writing-summary panel"><div class="section-title"><h2>Drawing practice</h2><span>Separate from recognition quizzes</span></div><p>This session: ${session?.checks||0} tracing checks${session?.checks?` · average fit ${Math.round(session.totalFit/session.checks*100)}%`:''}. Overall: ${checks} checks across ${entries.length} symbols. OCR has a separate result; an uncertain reading is not counted as a wrong letter.</p><div class="writing-records">${entries.map(([id,w])=>`<a href="#item/${id}">${ml(byId[id].ml)}<span>Best fit ${Math.round(w.bestFit*100)}% · ${w.attempts} checks</span><div class="score-meter ${w.bestFit>=.8?'good':w.bestFit>=.5?'fair':'needs-practice'}" role="img" aria-label="Best tracing fit ${Math.round(w.bestFit*100)} percent"><i style="width:${w.bestFit*100}%"></i></div><small>OCR ${w.ocr.correct}/${w.ocr.judged} readable results matched</small></a>`).join('')}</div></section>`;
}

function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function handleAudioClick(button){
  try{
    if(button.dataset.device){
      const v=audio.voices.find(v=>(v.voiceURI||v.name)===button.dataset.device);if(!v)throw Error('This voice is no longer available.');
      audio.add({kind:'device',name:v.name,provider:'device',model:'speech-synthesis',voice:v.voiceURI||v.name,gender:'unspecified'});render();return;
    }
    if(button.dataset.clipPlay){const clip=audio.clips.find(c=>c.key===button.dataset.clipPlay);if(clip)await audio.playBlob(clip.blob);return;}
    if(button.dataset.clipDelete){await audio.remove(button.dataset.clipDelete);toast('Saved clip deleted.');return;}
    const target=audioTargets[audioTargetId];
    switch(button.dataset.audio){
      case 'openai-preset':{
        const preset=audio.openaiPreset;
        const profile=audio.add({kind:'service',name:`OpenAI · ${preset.voice}`,provider:'openai',model:preset.model,voice:preset.voice,gender:'unspecified',endpoint:preset.endpoint});
        render();toast(`OpenAI ${profile.voice} selected. Connect its gateway before generating new audio.`);break;
      }
      case 'openai-check':{
        const preset=audio.openaiPreset;const endpoint=validateEndpoint(preset.endpoint);
        preset.status='Checking the OpenAI gateway…';render();
        try{
          const response=await fetch(`${endpoint}/models`,{signal:AbortSignal.timeout(12000)});
          if(!response.ok)throw Error(`Gateway returned HTTP ${response.status}. Run or connect the OpenAI speech gateway; GitHub Pages cannot run it.`);
          const data=await response.json();
          if(data.provider!=='openai')throw Error('This gateway is not configured for OpenAI. Set BHAASA_TTS_PROVIDER=openai on its server.');
          if(!data.configured){preset.status='OpenAI is not connected. Add BHAASA_TTS_API_KEY securely on the gateway server, then restart it. Do not paste an API key into this app.';}
          else if(!Array.isArray(data.models)||!data.models.some(m=>m.id===preset.model)){preset.status=`The gateway has a credential configured, but ${preset.model} is not enabled. Update its BHAASA_TTS_MODELS allowlist.`;}
          else preset.status='The gateway has OpenAI configured for this model. Generate a sample to verify API access, billing, and pronunciation; no paid request was made by this check.';
        }catch(error){preset.status=error.message;}
        render();break;
      }
      case 'play':await audio.play(target);break;
      case 'generate':await audio.generate(target,true,true);toast('Generated audio saved. The previous clip for this identity has been replaced if present.');break;
      case 'record':await audio.startRecording(target);break;
      case 'stop':audio.stopRecording();break;
      case 'export':download(await audio.export($('#audio-export-scope')?.value||'all',target),'bhaasa-malayalam-audio.zip');break;
      case 'discover':{
        const endpoint=validateEndpoint($('#voice-form').elements.endpoint.value);
        $('#model-status').textContent='Checking the connected service…';
        const response=await fetch(`${endpoint}/models`,{signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error(`No model list received (HTTP ${response.status}). Run or connect a speech gateway; GitHub Pages only serves the app.`);
        const data=await response.json();if(!Array.isArray(data.models))throw Error('The service must return a models array.');
        const models=data.models.filter(m=>typeof m.id==='string'&&m.id.length<200).slice(0,100);
        $('#model-list').innerHTML=models.map(m=>`<option value="${esc(m.id)}">${esc(m.provider||'speech model')}</option>`).join('');
        const voices=models.flatMap(m=>Array.isArray(m.voices)?m.voices:[]).filter(v=>typeof v.id==='string'&&v.id.length<200);
        $('#service-voice-list').innerHTML=voices.slice(0,200).map(v=>`<option value="${esc(v.id)}">${esc(v.name||v.id)} · ${esc(v.gender||'unspecified')}</option>`).join('');
        $('#model-status').textContent=`${models.length} configured speech models reported. Choose their IDs or enter another supported model and voice. Availability and Malayalam quality depend on the provider.`;break;
      }
    }
  }catch(e){toast(e.message);if($('#model-status'))$('#model-status').textContent=e.message;}
}
$('#app').addEventListener('submit',e=>{
  if(e.target.id!=='voice-form')return;e.preventDefault();
  try{const profile=Object.fromEntries(new FormData(e.target));audio.add(profile);render();toast('Voice profile added. Its clips will stay separate by provider, model, and voice.');}catch(error){toast(error.message);}
});

$('#app').addEventListener('click',async e=>{
  if(e.target.closest('.skip')){e.preventDefault();$('#main').focus();return;}
  const button=e.target.closest('button,[data-action]');if(!button||button.disabled)return;
  if(button.dataset.audio||button.dataset.device||button.dataset.clipPlay||button.dataset.clipDelete){await handleAudioClick(button);return;}
  if(button.dataset.speak){speak(button.dataset.speak);return;}
  if(button.dataset.script){activeScript=button.dataset.script;render();return;}
  if(button.dataset.card!==undefined){studyIndex=Number(button.dataset.card);render();return;}
  if(button.dataset.quiz){const l=lessons.find(l=>l.id===button.dataset.quiz);startQuiz(l.items,l.id);return;}
  if(button.dataset.practice){const pools={vowels:vowels.slice(0,12),words,phrases,grammar:grammarItems,phonetics:phoneticsItems};startQuiz(pools[button.dataset.practice]);return;}
  if(button.dataset.answer!==undefined&&quiz&&!quiz.answered){
    const item=quiz.items[quiz.index];quiz.selection=quiz.options[Number(button.dataset.answer)];quiz.answered=true;
    const correct=quiz.selection===answerFor(item);quiz.history.push({id:item.id,choice:quiz.selection,correct});quiz.score+=Number(correct);progress=recordAnswer(progress,item.id,correct,Date.now(),item.section);save();render();$('#answer-feedback').focus({preventScroll:true});return;
  }
  switch(button.dataset.action) {
    case 'previous-card':studyIndex=Math.max(0,studyIndex-1);render();break;
    case 'next-card': {const l=lessons.find(l=>l.id===button.dataset.lesson);if(studyIndex===l.items.length-1)startQuiz(l.items,l.id);else{studyIndex++;render();}break;}
    case 'due-quiz': {const items=due();startQuiz(items.length?items:allItems.filter(i=>progress.items[i.id]));break;}
    case 'quiz-next':
      if(!quiz?.answered)return;
      if(quiz.index===quiz.items.length-1){quiz.done=true;if(quiz.lessonId){progress=finishLesson(progress,quiz.lessonId,quiz.score,quiz.items.length);save();}}
      else{quiz.index++;quiz.answered=false;quiz.selection=null;quiz.options=quizChoices(quiz.items[quiz.index],quiz.pool);}
      render();$('#main').focus({preventScroll:true});break;
    case 'retry-quiz':startQuiz(quiz.items,quiz.lessonId);break;
    case 'exit-quiz':quiz=null;render();break;
    case 'undo-stroke':canvasActions.undo?.();break;
    case 'clear-canvas':canvasActions.clear?.();break;
    case 'dismiss-recap':showRecap=false;render();break;
    case 'new-session':progress=startSession(progress);save();render();toast('A new session has started. Overall scores are unchanged.');break;
    case 'export': {download(new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}),'bhaasa-progress.json');toast('Progress exported. Keep the file somewhere safe.');break;}
    case 'reset':if(confirm('Reset all learning progress on this device? Export a backup first if you want to keep it.')){progress=emptyProgress();save();render();toast('Your progress has been reset.');}break;
    case 'install':if(installPrompt){installPrompt.prompt();installPrompt=null;button.hidden=true;}break;
  }
});
$('#app').addEventListener('input',e=>{if(e.target.id==='word-search'){search=e.target.value;$('#word-results').innerHTML=wordResults();savePosition();}});
$('#app').addEventListener('change',async e=>{
  if(e.target.id==='word-group'){wordGroup=e.target.value;$('#word-results').innerHTML=wordResults();savePosition();}
  try{
    if(e.target.id==='openai-model'){audio.openaiPreset.model=e.target.value;audio.openaiPreset.voice=defaultOpenAIVoice(e.target.value);audio.openaiPreset.status='';render();}
    if(e.target.id==='openai-voice'){audio.openaiPreset.voice=e.target.value;}
    if(e.target.id==='openai-endpoint'){audio.openaiPreset.endpoint=e.target.value;audio.openaiPreset.status='';}
    if(e.target.id==='active-voice'){audio.choose(e.target.value);render();}
    if(e.target.id==='audio-auto-save'){audio.autoSave=e.target.checked;audio.persist();}
    if(e.target.id==='voice-gender-filter'){$('#active-voice').querySelectorAll('option').forEach(o=>{o.hidden=e.target.value!=='all'&&o.dataset.gender!==e.target.value;});}
    if(e.target.id==='audio-target'){audioTargetId=e.target.value;if(route()===`audio/${audioTargetId}`)render();else location.hash=`audio/${audioTargetId}`;}
    if(e.target.id==='audio-file'&&e.target.files[0]){await audio.store(audioTargets[audioTargetId],audio.active,e.target.files[0],'file');toast('Audio saved for the selected target and voice.');}
    if(e.target.id==='audio-backup'&&e.target.files[0]){const count=await audio.import(e.target.files[0],audioTargets,$('#audio-overwrite').checked);toast(`${count} audio clips imported.`);}
    if(e.target.id==='voice-kind'){
      const f=$('#voice-form');const kind=e.target.value;
      if(kind!=='service'){f.elements.provider.value=kind==='device'?'device':'human';f.elements.model.value=kind==='device'?'speech-synthesis':'recording';f.elements.voice.value=kind==='device'?'default':'speaker-1';}f.elements.endpoint.disabled=kind!=='service';
    }
  }catch(error){toast(error.message);}
  if(e.target.id==='import-progress'&&e.target.files[0]) {
    const file=e.target.files[0];
    try {
      if(file.size>2e6)throw new Error('This file is too large to be a progress backup.');
      const imported=validateProgress(JSON.parse(await file.text()),ids,lessonIds);
      if(confirm('Replace the progress on this device with this backup?')){progress=imported;storageNotice='';save();render();toast('Your progress has been restored.');}
    } catch {toast('Could not import this file. Choose a valid Bhaasa progress backup.');}
    e.target.value='';
  }
});
window.addEventListener('hashchange',()=>{studyIndex=0;if(route()!=='review')quiz=null;if(!route().startsWith('audio'))audio.stopRecording();render(true);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if($('#install-button'))$('#install-button').hidden=false;});
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);
function updateConnection(){if($('#offline-status'))$('#offline-status').innerHTML=`<i></i>${offlineReady?'Available offline':navigator.onLine?'On this device':'Offline'}`;}
updateVoices();window.speechSynthesis?.addEventListener('voiceschanged',updateVoices);
render();
audio.onChange=()=>{if(route().startsWith('audio'))render();};
audio.load().then(()=>{if(route().startsWith('audio'))render();});
window.addEventListener('pagehide',()=>{savePosition();audio.stopRecording();audio.stopPlayback();});
if('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(reg=>reg.active?.postMessage({type:'CHECK_OFFLINE'})).catch(()=>{offlineReady=false;updateConnection();});
  navigator.serviceWorker.addEventListener('message',e=>{
    if(e.data?.type==='OFFLINE_STATUS'){
      offlineReady=e.data.ready;updateConnection();
      if($('#offline-detail')&&offlineReady)$('#offline-detail').textContent='The app and lessons have been saved for offline use on this device.';
    }
  });
}
