import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog} from '../catalog.js';
import {emptyProgress,recordAnswer,validateProgress} from '../learning.js';
import {nextReview,DAY} from '../repetition.js';
import {compareSpeech,recordSpeaking,dueSpeaking} from '../speech-learning.js';
import {clipKey,exportAudio,importAudio} from '../audio-store.js';
import {unpackZip} from '../zip.js';
import {readingInstructions} from '../speech-presets.js';
import {createBridge} from '../mobile/src/bridge.js';
import {handleSpeech} from '../scripts/speech.mjs';
import {Readable} from 'node:stream';

test('both starter courses contain complete, resolvable constructions and exercises',()=>{
  for(const language of ['ml','fr']){
    const c=getCatalog(language);assert.equal(c.units.length,16);assert.equal(c.constructionItems.length,32);assert.equal(new Set(c.allItems.map(i=>i.id)).size,c.allItems.length);
    for(const unit of c.units){assert.ok(unit.words.length>=2);assert.ok(unit.constraints.length>=2);assert.equal(unit.items.length,2);}
    for(const item of c.allItems){assert.equal(item.language,language);for(const key of ['ml','roman','meaning','ipa','devanagari'])assert.ok(item[key],`${item.id}: ${key}`);for(const p of item.gloss)assert.ok(p.ml&&p.roman&&p.gloss,item.id);}
    for(const item of c.constructionItems){assert.equal(c.byId[item.id],item);assert.equal(new Set(item.options).size,4);assert.ok(item.options.includes(item.answer));assert.ok(item.explanation);assert.equal(item.section,'constructions');}
    for(const topic of c.soundTopics)for(const example of topic.examples)assert.ok(c.allItems.some(i=>i.kind==='word'&&i.ml===example));
  }
});
test('French includes all letters, common accents and honest rare-form examples',()=>{
  const c=getCatalog('fr');assert.equal(c.vowels.length+c.consonants.length,26);assert.ok(c.signs.length>=14);
  for(const item of c.scriptItems){assert.ok(item.phonetics?.parts.length);assert.ok(item.phonetics.tip);if(item.example.type==='word')assert.ok(c.byId[item.example.itemId]);else assert.match(item.note,/Rare/);}
  assert.ok(c.constructionItems.some(i=>i.ml==='Les maisons sont petites.'&&i.answer==='petites'));
  assert.ok(c.constructionItems.some(i=>i.ml==='Elles sont arrivées.'&&i.answer==='arrivées'));
  assert.ok(getCatalog('ml').constructionItems.some(i=>i.question.includes('അവൾ')&&i.answer==='It stays വായിക്കുന്നു'));
});
test('spaced reviews increase only after due recall and errors return immediately',()=>{
  let old,now=1000;
  for(const days of [1,3,7,14,30,30]){
    const next=nextReview(old,true,now);assert.equal(next.due,now+days*DAY);
    assert.deepEqual(nextReview(next,true,now+1),next,'same-session correct answers do not inflate intervals');old=next;now=next.due;
  }
  assert.deepEqual(nextReview(old,false,now+5),{stage:0,due:now+5});
});
test('speech comparison preserves French accents, changed inflections, and word order',()=>{
  const target={language:'fr',ml:'Elle est étudiante.'};assert.equal(compareSpeech('ELLE EST ÉTUDIANTE !',target).matched,true);
  assert.equal(compareSpeech('Elle est étudiant.',target).matched,false);assert.equal(compareSpeech('Elle est etudiante.',target).matched,false);
  assert.ok(compareSpeech('étudiante elle est',target).coverage<1);assert.equal(compareSpeech('',target).matched,false);
  assert.equal(compareSpeech('എനിക്ക് വെള്ളം വേണം',{language:'ml',ml:'എനിക്ക് വെള്ളം വേണം.'}).matched,true);
  assert.equal(compareSpeech('J’ai 20 ans.',getCatalog('fr').byId['fr-use-avoir-2']).coverage,1,'accept an explicitly authored numeric spelling of the same utterance');
});
test('speaking scores and queues remain separate from written recall and survive language-safe backups',()=>{
  const c=getCatalog('fr'),item=c.constructionItems[0],now=1000,result={...compareSpeech(item.ml,item),source:'fixture'};
  let p=recordSpeaking(emptyProgress('fr'),item.id,result,now);assert.equal(Object.keys(p.items).length,0);assert.equal(p.speaking[item.id].due,now+DAY);
  p=recordSpeaking(p,item.id,result,now+1);assert.equal(p.speaking[item.id].stage,1);assert.equal(p.speaking[item.id].due,now+DAY);
  p=recordAnswer(p,item.id,true,now+2,'constructions');assert.equal(p.items[item.id].attempts,1);assert.equal(p.speaking[item.id].attempts,2);
  assert.equal(dueSpeaking(p,c.allItems,now+DAY)[0].id,item.id);
  const restored=validateProgress(JSON.parse(JSON.stringify(p)),new Set(c.allItems.map(i=>i.id)),new Set(c.lessons.map(l=>l.id)),'fr');assert.deepEqual(restored.speaking,p.speaking);assert.equal(restored.session.speaking.attempts,2);
  assert.throws(()=>validateProgress(p,new Set(),new Set(),'ml'),/different learning language/);
  assert.equal(recordSpeaking(p,item.id,{...result,transcript:''},now+3),p,'empty ASR is not scored');
});
test('French TTS uses French instructions and native voices without an English fallback',async()=>{
  assert.match(readingInstructions('fr-FR'),/French/);assert.ok(!readingInstructions('fr-FR').includes('Malayalam'));
  let spoken;const bridge=createBridge({Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'ios'},TextToSpeech:{getSupportedVoices:async()=>({voices:[{voiceURI:'en',lang:'en-US'},{voiceURI:'fr',lang:'fr-FR'}]}),speak:async o=>{spoken=o;}}});
  await bridge.getVoices();await bridge.speak({text:'Bonjour',voice:'fr',lang:'fr-FR'});assert.equal(spoken.voice,1);assert.equal(spoken.lang,'fr-FR');
  await assert.rejects(bridge.speak({text:'Bonjour',voice:'en',lang:'fr-FR'}),/French/);
});
test('French language and reading instructions reach both OpenAI speech transports',async()=>{
  for(const model of ['gpt-4o-mini-tts','gpt-realtime-2.1-mini']){
    const req=Readable.from([Buffer.from(JSON.stringify({input:'Bonjour',language:'fr-FR',provider:'openai',model,voice:'alloy'}))]);req.method='POST';req.headers={'content-type':'application/json'};
    let called=false;const res={status:0,writeHead(status){this.status=status;return this;},end(){}};
    await handleSpeech(req,res,new URL('http://127.0.0.1:4173/api/speech'),{env:{BHAASA_TTS_PROVIDER:'openai',BHAASA_TTS_API_KEY:'fixture-only',BHAASA_TTS_MODELS:model},fetcher:async(_url,options)=>{const body=JSON.parse(options.body);assert.match(body.instructions,/French/);assert.ok(!body.instructions.includes('Malayalam'));called=true;return new Response('fixture',{headers:{'content-type':'audio/mpeg'}});},realtime:async options=>{assert.equal(options.language,'fr-FR');called=true;return Buffer.from('fixture');}});
    assert.equal(res.status,200);assert.equal(called,true);
  }
});
test('language is part of audio identity and French exports use a separate hierarchy',async()=>{
  const c=getCatalog('fr'),target=c.constructionItems[0],profile={provider:'human',model:'recording',voice:'me'};
  assert.notEqual(clipKey(target,profile),clipKey({...target,language:'ml'},profile));
  const zip=await exportAudio([{...profile,key:clipKey(target,profile),language:'fr',section:target.section,scope:target.kind,itemId:target.id,text:target.ml,profileName:'Me',mime:'audio/wav',blob:new Blob(['fixture'],{type:'audio/wav'})}]);
  const files=await unpackZip(zip);assert.ok([...files.keys()].some(p=>p.startsWith('french/constructions/')));
  await assert.rejects(importAudio(zip,getCatalog('ml').byId),/unknown content/);
});
