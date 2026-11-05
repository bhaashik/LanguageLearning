import path from 'node:path';
import {access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
export const BROWSERS=['auto','default','chrome','edge','chromium','brave','firefox'];
export function browserFromDefault(value){
  const text=String(value).toLowerCase();
  if(/firefox/.test(text))return 'firefox';if(/brave/.test(text))return 'brave';if(/chromium/.test(text))return 'chromium';if(/chrome/.test(text))return 'chrome';if(/msedge|microsoft-edge/.test(text))return 'edge';return null;
}
export async function findExecutable(names,{env=process.env,platform=process.platform}={}){
  for(const name of names){
    const paths=path.isAbsolute(name)?[name]:(env.PATH||'').split(path.delimiter).filter(Boolean).map(dir=>path.join(dir,name));
    for(const candidate of paths)try{await access(candidate,platform==='win32'?constants.F_OK:constants.X_OK);return candidate;}catch{}
  }
  return null;
}
export async function defaultBrowser(platform=process.platform){
  try{
    const result=platform==='win32'?await execute('reg.exe',['query','HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice','/v','ProgId'],{windowsHide:true,timeout:3000}):await execute('xdg-settings',['get','default-web-browser'],{timeout:3000});
    return browserFromDefault(result.stdout);
  }catch{return null;}
}
function candidates(id,env,platform){
  if(platform!=='win32')return {chrome:['google-chrome-stable','google-chrome'],edge:['microsoft-edge-stable','microsoft-edge'],chromium:['chromium','chromium-browser'],brave:['brave-browser','brave-browser-stable'],firefox:['firefox']}[id]||[];
  const relative={chrome:'Google/Chrome/Application/chrome.exe',edge:'Microsoft/Edge/Application/msedge.exe',chromium:'Chromium/Application/chrome.exe',brave:'BraveSoftware/Brave-Browser/Application/brave.exe',firefox:'Mozilla Firefox/firefox.exe'}[id];
  if(!relative)return [];
  return [...[env.ProgramFiles||env.PROGRAMFILES,env['ProgramFiles(x86)']||env['PROGRAMFILES(X86)'],env.LOCALAPPDATA].filter(Boolean).map(base=>path.join(base,...relative.split('/'))),{chrome:'chrome.exe',edge:'msedge.exe',chromium:'chromium.exe',brave:'brave.exe',firefox:'firefox.exe'}[id]];
}
export async function chooseBrowser(choice,{env=process.env,platform=process.platform,detect=defaultBrowser,find=findExecutable}={}){
  if(choice==='default')return {id:'default',executable:null};
  if(!BROWSERS.includes(choice)){
    const executable=await find([choice],{env,platform});if(!executable)throw Error('The configured browser executable was not found.');
    const id=browserFromDefault(path.basename(executable));
    if(!id)throw Error('Use a supported Chrome, Edge, Chromium, Brave, or Firefox executable, or select default.');
    return {id,executable};
  }
  const preferred=choice==='auto'?await detect(platform):choice;
  // Respect a supported system default; otherwise use an available app-window browser.
  const order=choice==='auto'?[...new Set([preferred,'chrome','edge','chromium','brave','firefox'].filter(Boolean))]:[choice];
  for(const id of order){const executable=await find(candidates(id,env,platform),{env,platform});if(executable)return {id,executable};}
  if(choice==='auto')return {id:'default',executable:null};
  throw Error('That browser is not installed. Choose auto or default, or provide its executable path.');
}
export function launchPlan(browser,url,platform=process.platform){
  const target=new URL(url);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.username||target.password)throw Error('Desktop launch must use the local Bhaasa address.');
  if(browser.id==='default')return platform==='win32'?{command:'rundll32.exe',args:['url.dll,FileProtocolHandler',url]}:{command:'xdg-open',args:[url]};
  if(browser.id==='firefox')return {command:browser.executable,args:['--new-window',url]};
  return {command:browser.executable,args:['--no-first-run','--no-default-browser-check',`--app=${url}`]};
}
export async function openBrowser(browser,url){
  const plan=launchPlan(browser,url);
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^BHAASA_(OCR|TTS)_.*KEY$/i.test(key)));
  const child=spawn(plan.command,plan.args,{stdio:'ignore',detached:true,windowsHide:true,shell:false,env});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();
}
