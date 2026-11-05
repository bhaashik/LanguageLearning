import path from 'node:path';
import os from 'node:os';
import {readFile,mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';

export function dataDirectory(env=process.env,platform=process.platform){
  return env.BHAASA_DESKTOP_DATA_DIR|| (platform==='win32'?path.join(env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'Bhaasa'):path.join(env.XDG_CONFIG_HOME||path.join(os.homedir(),'.config'),'bhaasa'));
}
export function parseArguments(args){
  const options={};
  for(let n=0;n<args.length;n++){
    const arg=args[n];
    if(['--no-open','--help','--install'].includes(arg))options[arg.slice(2)]=true;
    else if(['--browser','--data-dir','--port'].includes(arg)){
      const value=args[++n];if(!value||value.startsWith('--'))throw Error(`Missing value for ${arg}.`);options[arg.slice(2)]=value;
    }else throw Error(`Unknown option. Use --help to see supported options.`);
  }
  return options;
}
export async function loadConfiguration(options={},env=process.env){
  const directory=path.resolve(options['data-dir']||dataDirectory(env));
  await mkdir(directory,{recursive:true,mode:0o700});
  const envFile=path.join(directory,'providers.env'),settingsFile=path.join(directory,'desktop.json');
  let privateEnv={},settings={};
  try{privateEnv=parseEnv(await readFile(envFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Could not read providers.env. Check its permissions and format.');}
  try{settings=JSON.parse(await readFile(settingsFile,'utf8'));if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error();}catch(error){if(error.code!=='ENOENT')throw Error('Could not read desktop.json. It must contain a JSON object.');}
  const port=Number(options.port??env.BHAASA_DESKTOP_PORT??settings.port??4174);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('The desktop port must be an integer between 0 and 65535.');
  const browser=options.browser||env.BHAASA_DESKTOP_BROWSER||settings.browser||'auto';
  if(typeof browser!=='string'||browser.length>4096)throw Error('The browser setting must be a browser name or executable path.');
  // Keys stay in the server process. Ignore arbitrary runtime options in this file.
  const providerEnv=Object.fromEntries(Object.entries(privateEnv).filter(([key])=>key.startsWith('BHAASA_ASR_')||key.startsWith('BHAASA_OCR_')||key.startsWith('BHAASA_TTS_')));
  return {directory,envFile,settingsFile,port,browser,env:{...providerEnv,...env}};
}
