import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,cp,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
test('Firebase staged adapters load in isolation without browser settings or SDKs',async()=>{
  const staged=spawnSync(process.execPath,['firebase/build.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(staged.status,0,staged.stderr);
  const directory=await mkdtemp(path.join(tmpdir(),'bhaasa-firebase-'));
  try{
    await cp(path.join(root,'firebase/functions/lib'),path.join(directory,'lib'),{recursive:true});
    await writeFile(path.join(directory,'package.json'),'{"type":"module"}');
    const run=spawnSync(process.execPath,['--input-type=module','-e',
      "const {createCloudGateway,geminiEnvironment}=await import('./lib/gateway/cloud-handler.mjs');if(typeof createCloudGateway!=='function'||typeof geminiEnvironment!=='function')process.exit(1);"],
      {cwd:directory,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const files=await readdir(path.join(directory,'lib'));
    for(const excluded of ['firebase-client.js','ocr-settings.js','vendor','content.js','index.html','.env.local'])assert.ok(!files.includes(excluded),excluded);
  }finally{await rm(directory,{recursive:true,force:true});}
});
