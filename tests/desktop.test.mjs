import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {chooseBrowser,browserFromDefault,launchPlan} from '../desktop/src/browser.mjs';
import {loadConfiguration,parseArguments,dataDirectory} from '../desktop/src/config.mjs';
import {createDesktopServer,APP_ID} from '../desktop/src/server.mjs';
import {installLinux} from '../desktop/src/install-linux.mjs';
import {settingsPage} from '../desktop/src/settings.mjs';

test('browser selection respects a supported default and has explicit browser/default fallbacks',async()=>{
  for(const [value,id] of [['MSEdgeHTM','edge'],['google-chrome.desktop','chrome'],['firefox_firefox.desktop','firefox'],['BraveHTML','brave'],['chromium.desktop','chromium']])assert.equal(browserFromDefault(value),id);
  const available=async names=>names.some(n=>n.includes('firefox'))?'/installed/firefox':null;
  assert.deepEqual(await chooseBrowser('auto',{platform:'linux',detect:async()=> 'firefox',find:available}),{id:'firefox',executable:'/installed/firefox'});
  assert.deepEqual(await chooseBrowser('default',{find:()=>{throw Error('must not inspect binaries');}}),{id:'default',executable:null});
  assert.equal((await chooseBrowser('auto',{detect:async()=>null,find:async()=>null})).id,'default');
  await assert.rejects(chooseBrowser('chrome',{find:async()=>null}),/not installed/);
  const env={ProgramFiles:'C:\\Program Files',LOCALAPPDATA:'C:\\Users\\Learner\\AppData\\Local'};let inspected=[];
  const chosen=await chooseBrowser('edge',{platform:'win32',env,find:async names=>{inspected=names;return names[0];}});
  assert.equal(chosen.id,'edge');assert.ok(inspected.some(p=>p.includes('Program Files')&&p.endsWith('msedge.exe')));
});

test('browser launch uses argument arrays, normal profiles, and only loopback app URLs',()=>{
  const url='http://127.0.0.1:4174/';
  const chrome=launchPlan({id:'chrome',executable:'/path with spaces/chrome'},url);
  assert.equal(chrome.command,'/path with spaces/chrome');assert.ok(chrome.args.includes('--app='+url));assert.ok(!chrome.args.some(a=>a.startsWith('--user-data-dir=')),'do not force sandboxed browsers into inaccessible profile folders');
  assert.ok(!chrome.args.includes('--no-sandbox'),'retain the browser sandbox');
  const firefox=launchPlan({id:'firefox',executable:'firefox'},url);assert.ok(!firefox.args.includes('-profile'));assert.ok(firefox.args.includes('--new-window'));
  assert.deepEqual(launchPlan({id:'default'},url,'win32'),{command:'rundll32.exe',args:['url.dll,FileProtocolHandler',url]});
  for(const bad of ['https://remote.example/','file:///tmp/x','http://localhost:4174/','http://127.0.0.1@remote.example/'])assert.throws(()=>launchPlan({id:'default'},bad));
});

test('desktop configuration reads only private provider variables with environment and CLI precedence',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'bhaasa-config-'));
  try{
    await writeFile(path.join(directory,'providers.env'),'BHAASA_TTS_API_KEY="file-fixture"\nBHAASA_OCR_GEMINI_MODEL=vision-fixture\nNODE_OPTIONS=not-accepted\nPATH=not-accepted\n');
    await writeFile(path.join(directory,'desktop.json'),JSON.stringify({browser:'edge',port:4250}));
    const config=await loadConfiguration({'data-dir':directory,browser:'firefox',port:'4251'},{BHAASA_TTS_API_KEY:'process-fixture'});
    assert.equal(config.browser,'firefox');assert.equal(config.port,4251);assert.equal(config.env.BHAASA_TTS_API_KEY,'process-fixture');assert.equal(config.env.BHAASA_OCR_GEMINI_MODEL,'vision-fixture');assert.equal(config.env.NODE_OPTIONS,undefined);assert.equal(config.env.PATH,undefined);
    assert.ok(!settingsPage(config).includes('process-fixture'));
    await assert.rejects(loadConfiguration({'data-dir':directory,port:'NaN'},{}),/port/);
    assert.equal(parseArguments(['--browser','default','--no-open']).browser,'default');assert.throws(()=>parseArguments(['--browser']),/Missing/);assert.throws(()=>parseArguments(['--unknown']),/Unknown/);
    assert.ok(dataDirectory({XDG_CONFIG_HOME:directory},'linux').endsWith(path.join(path.basename(directory),'bhaasa')));
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('Linux menu installation quotes the executable and preserves private app data',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'bhaasa-menu-'));
  try{
    const filename=await installLinux({executable:'/apps/Bhaasa with $special%/Bhaasa',icon:Buffer.from('icon-fixture'),env:{XDG_DATA_HOME:directory}});
    const entry=await readFile(filename,'utf8');assert.match(entry,/Terminal=false/);assert.ok(entry.includes('Exec="/apps/Bhaasa with \\\\$special%%/Bhaasa"'));
    assert.equal(await readFile(path.join(directory,'icons/hicolor/512x512/apps/io.github.bhaashik.bhaasa.png'),'utf8'),'icon-fixture');
  }finally{await rm(directory,{recursive:true,force:true});}
});

function request(port,pathname,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port,path:pathname,method,headers,agent:false},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);
});}

test('desktop server serves packaged lessons, keeps keys private, and blocks foreign hosts/origins',async()=>{
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  let calls=0,preference,clients=0;
  const files={'index.html':Buffer.from('<head></head><body>lesson</body>'),'desktop-client.js':Buffer.from('desktop-client-fixture')};
  const env={BHAASA_OCR_GEMINI_API_KEY:'private-fixture-key',BHAASA_OCR_GEMINI_MODEL:'vision-fixture',BHAASA_OCR_ALLOWED_ORIGIN:'https://foreign.example'};
  const app=createDesktopServer({asset:async name=>{if(!files[name])throw Error('missing');return files[name];},env,settings:()=>'<head></head>settings',onPreference:async value=>{preference=value;},onClient:n=>{clients=n;},fetcher:async()=>{calls++;return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'ക',legible:true})}]}}]});}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const port=app.server.address().port,origin=`http://127.0.0.1:${port}`;
  try{
    const index=await request(port,'/');assert.equal(index.status,200);assert.ok(index.text.includes('/desktop/client.js'));
    const status=await request(port,'/desktop/status');assert.equal(JSON.parse(status.text).appId,APP_ID);assert.ok(!status.text.includes('private-fixture-key'));
    assert.equal((await request(port,'/providers.env')).status,404);
    assert.equal((await request(port,'/desktop/status',{headers:{Host:'foreign.example'}})).status,403);
    assert.equal((await request(port,'/api/ocr',{headers:{Origin:'https://foreign.example'}})).status,403,'desktop accepts only its own origin even if a mobile allowlist was copied');
    const body=JSON.stringify({image:png,provider:'gemini'});
    const response=await request(port,'/api/ocr',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body});assert.equal(response.status,200);assert.equal(JSON.parse(response.text).text,'ക');assert.equal(calls,1);
    const save=await request(port,'/desktop/preferences',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({browser:'firefox'})});assert.equal(save.status,200);assert.equal(preference,'firefox');
    assert.equal((await request(port,'/desktop/quit',{method:'GET'})).status,405);
    assert.equal((await request(port,'/desktop/quit',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
    const stream=http.get(origin+'/desktop/lifecycle',res=>{res.once('data',()=>stream.destroy());});await new Promise(resolve=>stream.on('close',resolve));await new Promise(resolve=>setTimeout(resolve,20));assert.equal(clients,0);
  }finally{await app.close();}
});
