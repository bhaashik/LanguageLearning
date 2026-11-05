import test from 'node:test';
import assert from 'node:assert/strict';
import {allItems,byId,lessons,vowels,consonants,signs,chillus,conjuncts,words,phrases} from '../content.js';
import {emptyProgress,validateProgress,recordAnswer,dueItems,choicesFor,answerFor,finishLesson,localDay} from '../learning.js';

const ids=new Set(allItems.map(i=>i.id));
const lessonIds=new Set(lessons.map(l=>l.id));

test('the curriculum has unique, resolvable content and meaningful lesson quizzes',()=>{
  assert.equal(ids.size,allItems.length);
  assert.equal(lessonIds.size,lessons.length);
  for(const item of allItems){assert.match(item.ml,/[\u0D00-\u0D7F]/);assert.ok(item.roman);assert.ok(item.meaning);}
  for(const lesson of lessons){
    assert.ok(lesson.items.length>=4);
    for(const item of lesson.items)assert.equal(byId[item.id],item);
    for(const item of lesson.items){const answers=choicesFor(item,lesson.items);assert.equal(answers.length,4);assert.equal(new Set(answers).size,4);assert.ok(answers.includes(answerFor(item)));}
  }
});
test('reference covers both common and learned vowels plus the traditional consonant groups',()=>{
  assert.equal(vowels.length,16);assert.equal(consonants.length,36);assert.equal(signs.length,14);assert.equal(chillus.length,6);assert.equal(conjuncts.length,32);
  assert.notEqual(vowels.find(i=>i.ml==='എ').roman,vowels.find(i=>i.ml==='ഏ').roman);
  assert.notEqual(consonants.find(i=>i.ml==='ല').ipa,consonants.find(i=>i.ml==='ള').ipa);
  assert.notEqual(consonants.find(i=>i.ml==='ള').ipa,consonants.find(i=>i.ml==='ഴ').ipa);
});
test('correct recall schedules a review; an error returns the item immediately',()=>{
  const now=1762164000000;
  const first=recordAnswer(emptyProgress(),'v-0',true,now);
  assert.equal(first.items['v-0'].due,now+86400000);
  assert.equal(dueItems(first,vowels,now).length,0);
  assert.equal(dueItems(first,vowels,now+86400000)[0].id,'v-0');
  const second=recordAnswer(first,'v-0',false,now+1);
  assert.equal(second.items['v-0'].stage,0);
  assert.equal(second.items['v-0'].attempts,2);
  assert.equal(second.items['v-0'].correct,1);
  assert.equal(dueItems(second,vowels,now+1).length,1);
  assert.equal(first.items['v-0'].attempts,1,'updates do not mutate old state');
});
test('successful due reviews cap at thirty days; early repetitions do not advance retention',()=>{
  let p=emptyProgress();let now=1000;
  for(let i=0;i<10;i++){now=p.items['v-1']?.due||now;p=recordAnswer(p,'v-1',true,now);}
  assert.equal(p.items['v-1'].stage,5);
  assert.equal(p.items['v-1'].due,now+30*86400000);
  assert.equal(p.items['v-1'].attempts,10);
  assert.equal(Object.values(p.activity).reduce((sum,n)=>sum+n,0),10);
  const early=recordAnswer(p,'v-1',true,now+1);assert.equal(early.items['v-1'].stage,5);assert.equal(early.items['v-1'].due,p.items['v-1'].due);
});
test('due review orders missed items before future items and excludes unseen items',()=>{
  let p=recordAnswer(emptyProgress(),'v-0',false,100);
  p=recordAnswer(p,'v-1',false,200);
  p=recordAnswer(p,'v-2',true,200);
  assert.deepEqual(dueItems(p,vowels,300).map(i=>i.id),['v-0','v-1']);
});
test('completion uses best score and a failed retry cannot erase a completed lesson',()=>{
  const p=finishLesson(emptyProgress(),'first-vowels',5,6);
  assert.ok(p.lessons['first-vowels']>=.8);
  assert.equal(finishLesson(p,'first-vowels',1,6).lessons['first-vowels'],5/6);
  assert.equal(finishLesson(emptyProgress(),'first-vowels',4,6).lessons['first-vowels'],4/6);
  assert.equal(finishLesson(emptyProgress(),'first-vowels',0,0).lessons['first-vowels'],0);
});
test('backups round-trip review scheduling, lesson scores, and daily activity',()=>{
  let p=recordAnswer(emptyProgress(),words[0].id,true,Date.now());
  p=finishLesson(p,'home',6,6);
  assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p)),ids,lessonIds),p);
});
test('malformed backups cannot inject invalid counters or arbitrary curriculum IDs',()=>{
  assert.throws(()=>validateProgress({version:2},ids,lessonIds));
  const p=emptyProgress();p.items['v-0']={attempts:1,correct:9,stage:1,due:10};
  assert.throws(()=>validateProgress(p,ids,lessonIds));
  p.items['v-0']={attempts:1,correct:1,stage:9,due:10};
  assert.throws(()=>validateProgress(p,ids,lessonIds));
  delete p.items['v-0'];p.items['unknown-id']={};
  assert.deepEqual(validateProgress(p,ids,lessonIds),emptyProgress());
});
test('word and sentence quizzes test meaning, while letters test Roman recognition',()=>{
  assert.equal(answerFor(words[0]),'person');assert.equal(answerFor(phrases[1]),'I need water.');assert.equal(answerFor(vowels[1]),'ā');
  const options=choicesFor(words[0],[words[0],words[0],...words]);
  assert.equal(options.length,4);assert.equal(new Set(options).size,4);
});
