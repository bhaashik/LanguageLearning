import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {scriptItems,writingItems,allItems,lessons} from '../content.js';
import {fitGuide,evaluateTrace,resample,pathLength,canonicalMalayalam,recognitionMatches} from '../tracing.js';
import {emptyProgress,updateWriting,recordTrace,recordHandwritingRecognition,validateProgress,startSession} from '../learning.js';
import {handleOCR} from '../scripts/ocr.mjs';
const data=JSON.parse(await readFile(new URL('../data/tracing-guides.json',import.meta.url),'utf8'));

test('all reference and syllable entries have locally usable, explicitly unreviewed stroke guides',()=>{
  assert.equal(Object.keys(data.guides).length,writingItems.length);
  const originalIds=new Set(scriptItems.filter(i=>!i.id.startsWith('cj-')||Number(i.id.slice(3))<12).map(i=>i.id));
  let compact=0;
  for(const item of writingItems){
    const g=data.guides[item.id];assert.equal(g.ml,item.ml);assert.equal(g.reviewed,false);assert.equal(g.source,'font-derived practice guide');
    assert.equal(g.paths.length,g.suggestedStrokes);if(originalIds.has(item.id)&&g.paths.length<=2)compact++;
    const fitted=fitGuide(g);const result=evaluateTrace(fitted.paths,fitted);
    assert.equal(result.passed,true,item.id);assert.ok(result.fit>.99,item.id);assert.equal(result.pathOrder,true,item.id);
  }
  assert.equal(compact,81,'the original 84 guides retain their disconnected components and pen lifts');
});
test('blank ink and a small dot cannot receive a tracing score',()=>{
  const g=fitGuide(data.guides['vel-0']);assert.equal(evaluateTrace([],g).assessable,false);
  assert.equal(evaluateTrace([[{x:100,y:100},{x:102,y:102}]],g).assessable,false);
});
test('omitted detached vowel signs, off-guide scribbles, and excessive retracing are identified',()=>{
  const g=fitGuide(data.guides['sign-7']);assert.equal(g.paths.length,2);
  const missing=evaluateTrace([g.paths[0]],g);assert.equal(missing.passed,false);assert.ok(missing.partCoverage.some(n=>n<.65));
  const scribble=[Array.from({length:100},(_,i)=>({x:50+(i%2)*700,y:50+i*5}))];
  const bad=evaluateTrace(scribble,g);assert.equal(bad.passed,false);assert.ok(bad.fit<.5);
  const single=fitGuide(data.guides['vel-0']);const repeat=evaluateTrace([...single.paths,...single.paths,...single.paths,...single.paths],single);
  assert.equal(repeat.passed,false);assert.ok(repeat.feedback.some(s=>s.includes('repeated passes')));
});
test('flow feedback distinguishes reversed paths and fragmented strokes from shape fit',()=>{
  const g=fitGuide(data.guides['vel-0']);const reversed=evaluateTrace(g.paths.map(p=>[...p].reverse()),g);
  assert.equal(reversed.passed,true,'reversal is not declared an incorrect letter');assert.equal(reversed.reversed,true);assert.equal(reversed.pathOrder,false);
  const path=g.paths[0],middle=Math.floor(path.length/2),fragmented=evaluateTrace([path.slice(0,middle+1),path.slice(middle)],g);
  assert.equal(fragmented.strokeCount,2);assert.equal(fragmented.suggestedStrokes,1);assert.ok(fragmented.feedback.some(t=>t.includes('pen lifts')));
});
test('resampling preserves curved-path endpoints and separates significant Malayalam letters',()=>{
  const p=[{x:0,y:0},{x:30,y:20},{x:50,y:0}],sampled=resample(p,2);assert.deepEqual(sampled[0],p[0]);assert.deepEqual(sampled.at(-1),p.at(-1));assert.ok(pathLength(sampled)>50);
  assert.equal(canonicalMalayalam('ന്\u200d'),'ൻ');assert.equal(recognitionMatches(' ക\n','ക'),true);
  assert.equal(recognitionMatches('ല','ള'),false);assert.equal(recognitionMatches('റ','ര'),false);assert.equal(recognitionMatches('ക','കാ'),false);
});
test('writing drafts, custom guides, and results round-trip separately from quiz scores',()=>{
  let p=updateWriting(emptyProgress(),'vel-0',{draft:[[{x:100,y:100},{x:160,y:150}]],draftId:'drawing-a',customGuide:{ml:'ക',paths:[[[100,100],[160,150]]],source:'imported practice guide',reviewed:false}});
  const result={assessable:true,fit:.85,smoothness:.9,strokeCount:1,passed:true,drawingId:'drawing-a'};
  p=recordTrace(p,'vel-0',result,1000);p=recordTrace(p,'vel-0',result,1001);
  assert.equal(p.writing['vel-0'].attempts,1,'unchanged drawings are not scored twice after reopening');
  p=recordHandwritingRecognition(p,'vel-0',{text:'ക',matched:true,drawingId:'drawing-a'},1100);
  p=recordHandwritingRecognition(p,'vel-0',{text:null,matched:null,drawingId:'drawing-b'},1200);
  assert.deepEqual(p.items,{});assert.deepEqual(p.session.sections,{});
  assert.equal(p.writing['vel-0'].ocr.judged,1);assert.equal(p.writing['vel-0'].ocr.correct,1);assert.equal(p.writing['vel-0'].ocr.requests,2);
  const clean=validateProgress(JSON.parse(JSON.stringify(p)),new Set(allItems.map(i=>i.id)),new Set(lessons.map(l=>l.id)));
  assert.deepEqual(clean,p);
  assert.equal(startSession(p,2000).session.writing.checks,0);assert.equal(startSession(p,2000).writing['vel-0'].attempts,1);
});
test('invalid drawing data is dropped during backup validation without losing lesson results',()=>{
  const p=updateWriting(emptyProgress(),'vel-0',{draft:[[{x:Infinity,y:0}]],draftId:'abc'});p.lessons['first-vowels']=1;
  const clean=validateProgress(p,new Set(allItems.map(i=>i.id)),new Set(lessons.map(l=>l.id)));
  assert.deepEqual(clean.writing['vel-0'].draft,[]);assert.equal(clean.lessons['first-vowels'],1);
});

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
async function ocrRequest(body,{env={BHAASA_TTS_API_KEY:'unit-test-fixture'},fetcher,origin='http://localhost',method='POST'}={}){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;req.headers={origin,'content-type':'application/json'};
  const result={};const res={writeHead(status,headers){Object.assign(result,{status,headers});return this;},end(body){result.body=body;return this;}};
  await handleOCR(req,res,new URL('http://localhost/api/ocr'),{env,fetcher});return result;
}
const output=result=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]}),{headers:{'Content-Type':'application/json'}});
test('OpenAI OCR receives only an ink image and no expected symbol or answer',async()=>{
  let called=false;
  const result=await ocrRequest({image:png},{fetcher:async(url,options)=>{
    called=true;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);
    assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.ok(!JSON.stringify(body).includes('ക'),'target must not be hinted in the request');
    assert.equal(body.input[0].content[1].image_url,png);return output({text:'ക',legible:true});
  }});
  assert.equal(called,true);assert.equal(result.status,200);assert.equal(JSON.parse(result.body).text,'ക');assert.ok(!result.body.includes('unit-test-fixture'));
});
test('OCR refuses answer hints, invalid images, absent credentials, and untrusted origins before paid calls',async()=>{
  const fail=()=>assert.fail('No provider call permitted');
  assert.equal((await ocrRequest({image:png,expected:'ക'},{fetcher:fail})).status,400);
  assert.equal((await ocrRequest({image:'data:image/png;base64,AAAA'},{fetcher:fail})).status,400);
  assert.equal((await ocrRequest({image:png},{env:{},fetcher:fail})).status,503);
  assert.equal((await ocrRequest({image:png},{origin:'https://untrusted.example',fetcher:fail})).status,403);
});
test('uncertain and failed OCR remain distinct from an incorrect recognized letter',async()=>{
  const uncertain=await ocrRequest({image:png},{fetcher:async()=>output({text:null,legible:false})});assert.equal(uncertain.status,200);assert.equal(JSON.parse(uncertain.body).legible,false);
  const invalid=await ocrRequest({image:png},{fetcher:async()=>output({text:'guess: ക',legible:true})});assert.equal(invalid.status,502);
  const rejected=await ocrRequest({image:png},{fetcher:async()=>new Response('private error details',{status:401})});assert.equal(rejected.status,401);assert.ok(!rejected.body.includes('private'));
});
