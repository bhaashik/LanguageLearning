// Test the actual packaged executable on either native CI runner.
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import http from 'node:http';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
const desktop=fileURLToPath(new URL('../',import.meta.url));
const executable=path.join(desktop,'out',`Bhaasa-${process.platform}-${process.arch}`,process.platform==='win32'?'Bhaasa.exe':'Bhaasa');
const directory=await mkdtemp(path.join(os.tmpdir(),'bhaasa-packaged-'));
const wav=Buffer.alloc(3244);wav.write('RIFF');wav.writeUInt32LE(3236,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(3200,40);
let ocrCalls=0,speechCalls=0;
const fixture=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
  if(req.url==='/ocr'){
    ocrCalls++;assert.ok(body.messages[1].content[1].image_url.url.startsWith('data:image/png;base64,'));
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'ക',legible:true})}}]}));
  }else{speechCalls++;assert.equal(body.input,'ക');res.writeHead(200,{'Content-Type':'audio/wav'}).end(wav);}
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));const fixtureURL=`http://127.0.0.1:${fixture.address().port}`;
await writeFile(path.join(directory,'providers.env'),`BHAASA_OCR_COMPATIBLE_URL=${fixtureURL}/ocr\nBHAASA_OCR_COMPATIBLE_MODEL=vision-fixture\nBHAASA_OCR_COMPATIBLE_API_KEY=private-fixture-token\nBHAASA_TTS_PROVIDER=custom\nBHAASA_TTS_URL=${fixtureURL}/speech\nBHAASA_TTS_MODELS=speech-fixture\nBHAASA_TTS_API_KEY=private-fixture-token\n`,{mode:0o600});
const child=spawn(executable,['--no-open','--data-dir',directory,'--port','0'],{cwd:directory,stdio:['ignore','pipe','pipe']});
let output='';child.stderr.on('data',chunk=>output+=chunk);
const ended=new Promise(resolve=>{child.once('exit',code=>resolve(code));child.once('error',()=>resolve(-1));});
let base;
try{
  base=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Packaged app did not start: '+output)),10000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',()=>{clearTimeout(timer);reject(Error('Packaged app exited early: '+output));});
    child.stdout.on('data',chunk=>{output+=chunk;const found=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(found){clearTimeout(timer);resolve(found[0]);}});
  });
  const get=async name=>{const r=await fetch(base+name);assert.equal(r.status,200,name);return r;};
  const status=await(await get('desktop/status')).json();assert.equal(status.appId,'io.github.bhaashik.bhaasa.desktop');
  assert.ok((await(await get('')).text()).includes('/desktop/client.js'));
  assert.ok((await(await get('docs/DESKTOP.html')).text()).includes('Bhaasa on Linux and Windows'));
  assert.equal((await fetch(base+'providers.env')).status,404);
  const ocrConfig=await(await get('api/ocr')).text();assert.ok(!ocrConfig.includes('private-fixture-token'));
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const ocr=await fetch(base+'api/ocr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:png,provider:'compatible'})});assert.equal(ocr.status,200);assert.equal((await ocr.json()).text,'ക');assert.equal(ocrCalls,1);
  const speech=await fetch(base+'api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:'ക',provider:'custom',model:'speech-fixture',voice:'fixture',language:'ml-IN'})});assert.equal(speech.status,200);assert.deepEqual(Buffer.from(await speech.arrayBuffer()),wav);assert.equal(speechCalls,1);
  const preference=await fetch(base+'desktop/preferences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({browser:'default'})});assert.equal(preference.status,200);
  assert.equal(JSON.parse(await readFile(path.join(directory,'desktop.json'),'utf8')).browser,'default');
  const second=await promisify(execFile)(executable,['--no-open','--data-dir',directory,'--port',String(new URL(base).port)],{timeout:10000});assert.ok(second.stdout.includes(base),'a second launch must reuse the same local server');
  await fetch(base+'desktop/quit',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  let timer;const exit=await Promise.race([ended,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Packaged app did not stop after quit')),10000);})]);clearTimeout(timer);assert.equal(exit,0);
  // Verify automatic lifecycle shutdown without opening a real CI browser.
  const idle=spawn(executable,['--browser',path.join(directory,'missing-test-browser'),'--data-dir',directory,'--port','0'],{cwd:directory,stdio:['ignore','pipe','pipe']});
  const idleEnded=new Promise(resolve=>{idle.once('exit',resolve);idle.once('error',()=>resolve(-1));});
  try{
    const address=await new Promise((resolve,reject)=>{
      let text='';const timeout=setTimeout(()=>reject(Error('Automatic-lifecycle app did not start')),10000);
      idle.stdout.on('data',chunk=>{text+=chunk;const found=text.match(/http:\/\/127\.0\.0\.1:\d+\//);if(found){clearTimeout(timeout);resolve(found[0]);}});
      idle.once('error',error=>{clearTimeout(timeout);reject(error);});
    });
    await new Promise((resolve,reject)=>{const req=http.get(address+'desktop/lifecycle',res=>{res.once('data',()=>{req.destroy();resolve();});});req.once('error',reject);});
    console.log('Checking automatic shutdown after the last page closes (30-second grace period)…');
    let timeout;const result=await Promise.race([idleEnded,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Server did not stop after all pages closed')),45000);})]);clearTimeout(timeout);assert.equal(result,0);
  }finally{if(idle.exitCode===null)idle.kill();await idleEnded;}
  console.log('PASS: packaged executable starts outside the checkout, serves embedded assets, reads private settings, handles OCR/TTS through local fixtures, saves browser preferences, reuses an instance, and quits cleanly.');
}finally{
  if(child.exitCode===null)child.kill();await ended;await new Promise(resolve=>fixture.close(resolve));await rm(directory,{recursive:true,force:true});
}
