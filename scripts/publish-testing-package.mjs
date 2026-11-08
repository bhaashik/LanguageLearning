// Publish a test build using repository access only. No release/API token or
// signing credential is put in a package or download manifest.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,stat,rm,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const configurations={
  windows:{branch:'windows-downloads',name:'Bhaasa Windows x64',filename:'Bhaasa-windows-x64.zip',instructions:'Extract the ZIP completely, then open **Start Bhaasa.vbs** or **Bhaasa.exe** inside the folder. Requires Windows 10 or later, a 64-bit Intel/AMD processor, and a modern installed browser. This is an unsigned portable test build; no separate Node.js installation is needed.'},
  android:{branch:'android-downloads',name:'Bhaasa Android test APK',filename:'Bhaasa-Android-debug.apk',instructions:'Download the APK on your Android phone and open it. Allow installation from that source when Android asks. Requires Android 7.0+ and an updated Android System WebView. This is a debug-signed test build, not a Play Store release. Export progress and audio before changing between APKs signed on different computers or CI runs; Android cannot update an installed app using a different signing identity.'},
  ios:{branch:'ios-downloads',name:'Bhaasa iPhone/iPad archive (unsigned)',filename:'Bhaasa-iOS-unsigned.xcarchive.zip',instructions:'**For Apple signing in Xcode on a Mac. This unsigned archive cannot be installed directly on an iPhone/iPad.** Extract the ZIP and open Bhaasa.xcarchive in Xcode Organizer. Export/distribute it using your Apple team’s signing identity and provisioning setup, or use the source project to run on your own connected device. TestFlight distribution requires Apple Developer Program membership. No signing certificate, provisioning profile, Apple account, or App Store Connect credential is included.'}
};
const repository='bhaashik/LanguageLearning';
const root=fileURLToPath(new URL('../',import.meta.url));
const git=(cwd,args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function checksum(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}

export async function publishTestingPackage({platform,state,artifact,repoRoot=root,environment=process.env}){
  const config=configurations[platform];
  if(!config||!['queued','building','ready','failed'].includes(state))throw Error('Choose windows, android, or ios, and queued, building, ready, or failed.');
  const version=JSON.parse(await readFile(path.join(repoRoot,'package.json'),'utf8')).version;
  if(!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version))throw Error('Invalid app version.');
  let file;
  if(state==='ready'){
    if(!artifact)throw Error('A ready package needs an artifact.');
    const source=path.resolve(repoRoot,artifact),details=await stat(source);
    if(!details.isFile()||details.size===0||details.size>95*1024*1024)throw Error('The test artifact must be a nonempty file under 95 MiB.');
    file={source,name:config.filename,bytes:details.size,sha256:await checksum(source)};
  }
  const sourceCommit=git(repoRoot,['rev-parse','HEAD']);
  const runURL=environment.GITHUB_RUN_ID?`https://github.com/${repository}/actions/runs/${encodeURIComponent(environment.GITHUB_RUN_ID)}`:null;
  const status={version,platform,state,sourceCommit,updatedAt:new Date().toISOString(),runURL,architecture:environment.BHAASA_PACKAGE_ARCH||null,...(file?{file:file.name,bytes:file.bytes,sha256:file.sha256}:{})};
  const temporary=await mkdtemp(path.join(os.tmpdir(),'bhaasa-download-')),worktree=path.join(temporary,'download');
  let attached=false;
  try{
    // Branches are initialized by the maintainer. CI never replaces their history.
    git(repoRoot,['fetch','--depth=1','origin',config.branch]);
    git(repoRoot,['worktree','add','--detach',worktree,'FETCH_HEAD']);attached=true;
    const destination=path.join(worktree,`v${version}`);await mkdir(destination,{recursive:true});
    if(file){
      await copyFile(file.source,path.join(destination,file.name));
      await writeFile(path.join(destination,'SHA256SUMS'),`${file.sha256}  ${file.name}\n`);
    }
    if(state==='failed'&&environment.BHAASA_BUILD_LOG){
      let log;
      try{
        log=await open(environment.BHAASA_BUILD_LOG,'r');const size=(await log.stat()).size,buffer=Buffer.alloc(Math.min(size,12000));
        await log.read(buffer,0,buffer.length,Math.max(0,size-buffer.length));
        const text=buffer.toString('utf8').replace(/(?:github_pat_[\w]+|gh[pousr]_[\w]{20,})/g,'[redacted]');
        await writeFile(path.join(destination,'build-error.txt'),text);status.errorLog='build-error.txt';
      }catch{}finally{await log?.close();}
    }
    await writeFile(path.join(destination,'status.json'),JSON.stringify(status,null,2)+'\n');
    const base=`https://github.com/${repository}/raw/refs/heads/${config.branch}/v${version}`;
    const link=state==='ready'?`[Download ${config.name} ${version}](${base}/${config.filename}) (${(file.bytes/1024/1024).toFixed(1)} MiB)`:state==='failed'?'The build failed; no new package has been published.':state==='building'?'The build is running. A download link will appear here after its checks pass.':'The build is queued. A download link will appear here after its checks pass.';
    const readme=`# ${config.name} test downloads\n\n${link}\n\n${config.instructions}\n\n${runURL?`[Build status and logs](${runURL})\n\n`:''}[Machine-readable build status](v${version}/status.json)${file?` · [SHA-256 checksum](v${version}/SHA256SUMS)`:''}\n\nSource commit: \`${sourceCommit}\` · app version ${version}. No provider keys, personal recordings, browser profiles, or signing credentials are included.\n\nUse a GitHub account with access to this repository if prompted to sign in. [Source and setup guides](https://github.com/${repository}/tree/main).\n`;
    await writeFile(path.join(worktree,'README.md'),readme);
    git(worktree,['add','README.md',`v${version}`]);
    git(worktree,['-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit','-m',`${config.name} ${version}: ${state}`]);
    git(worktree,['push','origin',`HEAD:refs/heads/${config.branch}`]);
    return status;
  }finally{
    if(attached)try{git(repoRoot,['worktree','remove','--force',worktree]);}catch{}
    await rm(temporary,{recursive:true,force:true});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [platform,state,artifact]=process.argv.slice(2);
  try{const result=await publishTestingPackage({platform,state,artifact});console.log(`${platform}: ${result.state}${result.file?` — ${result.file} (${result.bytes} bytes)`:''}`);}
  catch(error){console.error(error.message);if(error.stderr)console.error(String(error.stderr));process.exitCode=1;}
}
