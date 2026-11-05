import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {isSea,getAsset} from 'node:sea';
import {readFile,writeFile,rename,appendFile} from 'node:fs/promises';
import {parseArguments,loadConfiguration} from './config.mjs';
import {chooseBrowser,openBrowser} from './browser.mjs';
import {createDesktopServer,APP_ID} from './server.mjs';
import {settingsPage} from './settings.mjs';
import {installLinux} from './install-linux.mjs';
const VERSION='0.7.0';

function probe(port,instanceId){return new Promise(resolve=>{
  // This probe is strictly loopback, never an outbound provider request.
  const req=http.get({host:'127.0.0.1',port,path:'/desktop/status',agent:false,timeout:1500},res=>{
    let body='';res.on('data',chunk=>{body+=chunk;if(body.length>4096){req.destroy();resolve(false);}});res.on('end',()=>{try{const data=JSON.parse(body);resolve(res.statusCode===200&&data.appId===APP_ID&&data.instanceId===instanceId);}catch{resolve(false);}});
  });req.on('timeout',()=>{req.destroy();resolve(false);});req.on('error',()=>resolve(false));
});}
async function main(){
  const options=parseArguments(process.argv.slice(2));
  if(options.help){console.log('Bhaasa desktop\n  --browser auto|default|chrome|edge|chromium|brave|firefox|EXECUTABLE\n  --data-dir DIRECTORY\n  --port NUMBER (default 4174; keep stable to preserve browser storage)\n  --no-open (run local server without opening a browser)\n  --install (Linux packaged app: add an application-menu entry)');return;}
  const config=await loadConfiguration(options);
  const instanceId=createHash('sha256').update(config.directory).digest('hex');
  const log=async text=>{console.log(text);await appendFile(path.join(config.directory,'desktop.log'),`${new Date().toISOString()} ${text}\n`,{mode:0o600});};
  const asset=isSea()?async name=>Buffer.from(getAsset(name)):async name=>readFile(path.join(path.dirname(process.argv[1]),'public',name));
  if(options.install){
    if(process.platform!=='linux'||!isSea())throw Error('Use --install with the packaged Linux Bhaasa executable.');
    const file=await installLinux({executable:process.execPath,icon:await asset('assets/icon-512.png')});console.log(`Application-menu entry created: ${file}`);return;
  }
  const launch=async url=>{
    await log(`Bhaasa ${VERSION}: ${url}`);
    if(!options['no-open'])try{const browser=await chooseBrowser(config.browser);await openBrowser(browser,url);await log(`Browser: ${browser.id}. Desktop settings: ${url}desktop/`);}catch{await log(`Could not open the selected browser. Open ${url} manually, or restart with --browser default.`);}
  };
  let idleTimer,stopping=false;
  const quit=async()=>{if(stopping)return;stopping=true;clearTimeout(idleTimer);await app.close();await log('Bhaasa local server stopped.');};
  const schedule=delay=>{clearTimeout(idleTimer);if(!stopping&&!options['no-open'])idleTimer=setTimeout(quit,delay);};
  const app=createDesktopServer({asset,env:config.env,version:VERSION,instanceId,settings:()=>settingsPage(config),onQuit:quit,
    onClient:count=>{clearTimeout(idleTimer);if(!count)schedule(30000);},
    onPreference:async browser=>{
      const temporary=config.settingsFile+'.tmp';await writeFile(temporary,JSON.stringify({browser,port:config.port},null,2)+'\n',{mode:0o600});await rename(temporary,config.settingsFile);config.browser=browser;
    }
  });
  try{await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(config.port,'127.0.0.1',resolve);});}
  catch(error){
    if(error.code==='EADDRINUSE'&&await probe(config.port,instanceId)){await launch(`http://127.0.0.1:${config.port}/`);return;}
    await log('Cannot start: the selected port is unavailable. Close the other program, or explicitly select another port. Changing port uses a separate progress store.');process.exitCode=1;return;
  }
  process.once('SIGINT',quit);process.once('SIGTERM',quit);
  schedule(180000);await launch(`http://127.0.0.1:${app.server.address().port}/`);
}
main().catch(()=>{console.error('Bhaasa could not start. Check desktop.json/providers.env syntax, file permissions, and --help.');process.exitCode=1;});
