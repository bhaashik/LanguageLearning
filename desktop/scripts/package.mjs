import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,cp,readdir,chmod,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {inject} from 'postject';
const desktop=fileURLToPath(new URL('../',import.meta.url));
if(!['linux','win32'].includes(process.platform)||!['x64','arm64'].includes(process.arch))throw Error('Package on Linux or Windows for the matching architecture.');
const runtime=process.env.BHAASA_DESKTOP_NODE||process.execPath;
const version=spawnSync(runtime,['--version'],{encoding:'utf8'});if(version.status!==0||!version.stdout.startsWith('v24.'))throw Error('Packaging requires a Node 24 executable.');
const build=path.join(desktop,'build'),output=path.join(desktop,'out',`Bhaasa-${process.platform}-${process.arch}`);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await chmod(output,0o755);
const assets={};
async function scan(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const relative=prefix+entry.name;if(entry.isDirectory())await scan(path.join(dir,entry.name),relative+'/');else assets[relative]=path.join(dir,entry.name);}}
await scan(path.join(build,'public'));
const configuration={main:path.join(build,'main.cjs'),output:path.join(build,'sea-prep.blob'),disableExperimentalSEAWarning:true,useSnapshot:false,useCodeCache:false,assets};
const configFile=path.join(build,'sea-config.json');await writeFile(configFile,JSON.stringify(configuration));
const prepared=spawnSync(runtime,['--experimental-sea-config',configFile],{stdio:'inherit'});if(prepared.status!==0)throw Error('Node SEA preparation failed.');
const executable=path.join(output,process.platform==='win32'?'Bhaasa.exe':'Bhaasa');await cp(runtime,executable);await chmod(executable,0o755);
await inject(executable,'NODE_SEA_BLOB',await readFile(configuration.output),{sentinelFuse:'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'});
await cp(path.join(desktop,'resources/README.txt'),path.join(output,'README.txt'));
if(process.platform==='win32')await cp(path.join(desktop,'resources/Start Bhaasa.vbs'),path.join(output,'Start Bhaasa.vbs'));
// Include runtime/dependency license notices with each portable package.
const notices=[];
for(const name of ['ws','https-proxy-agent','agent-base','debug','ms']){
  const directory=path.join(desktop,'node_modules',name),files=await readdir(directory),license=files.find(f=>/^licen[sc]e(?:\.md|\.txt)?$/i.test(f));
  if(license)notices.push(`${name}\n${await readFile(path.join(directory,license),'utf8')}`);
}
await writeFile(path.join(output,'DEPENDENCY-LICENSES.txt'),notices.join('\n\n'));
const licenseCandidates=[process.env.BHAASA_DESKTOP_NODE_LICENSE,path.resolve(path.dirname(runtime),'LICENSE'),path.resolve(path.dirname(runtime),'../LICENSE')].filter(Boolean);
let nodeLicense;
for(const candidate of licenseCandidates)try{nodeLicense=await readFile(candidate);break;}catch{}
if(!nodeLicense)throw Error('Use an official Node distribution with its LICENSE file, or set BHAASA_DESKTOP_NODE_LICENSE to that file.');
await writeFile(path.join(output,'NODE-LICENSE.txt'),nodeLicense);
for(const name of await readdir(output))if(name!==(process.platform==='win32'?'Bhaasa.exe':'Bhaasa'))await chmod(path.join(output,name),0o644);
console.log(`Portable desktop app created: ${output}`);
