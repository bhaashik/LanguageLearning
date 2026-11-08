import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,readFile,rm,truncate} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {publishTestingPackage} from '../scripts/publish-testing-package.mjs';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

test('test-package publishing preserves source HEAD and publishes exact bytes, receipt hash, and build status',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'bhaasa-publish-test-'));
  try{
    const remote=path.join(folder,'remote.git'),root=path.join(folder,'source');await mkdir(root);
    git(folder,'init','--bare',remote);git(root,'init','-b','main');git(root,'config','user.name','Bhaasa tests');git(root,'config','user.email','tests@example.invalid');
    await writeFile(path.join(root,'package.json'),JSON.stringify({version:'0.7.1'}));git(root,'add','.');git(root,'commit','-m','source');git(root,'remote','add','origin',remote);git(root,'push','origin','main');
    const sourceCommit=git(root,'rev-parse','HEAD');git(root,'checkout','-b','windows-downloads');await writeFile(path.join(root,'README.md'),'Queued');git(root,'add','.');git(root,'commit','-m','queued');git(root,'push','origin','windows-downloads');git(root,'checkout','main');
    const environment={GITHUB_RUN_ID:'12345',BHAASA_PACKAGE_ARCH:'x64'};
    await publishTestingPackage({platform:'windows',state:'building',repoRoot:root,environment});
    assert.equal(JSON.parse(git(remote,'show','windows-downloads:v0.7.1/status.json')).state,'building');
    const bytes=Buffer.from([80,75,3,4,0,255,10,20]);await writeFile(path.join(root,'fixture.zip'),bytes);
    const status=await publishTestingPackage({platform:'windows',state:'ready',artifact:'fixture.zip',repoRoot:root,environment});
    assert.equal(status.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(status.bytes,bytes.length);assert.equal(status.sourceCommit,sourceCommit);
    assert.match(status.runURL,/actions\/runs\/12345$/);assert.equal(git(root,'branch','--show-current'),'main');assert.equal(git(root,'rev-parse','HEAD'),sourceCommit);
    const stored=execFileSync('git',['show','windows-downloads:v0.7.1/Bhaasa-windows-x64.zip'],{cwd:remote});assert.deepEqual(stored,bytes);
    assert.match(git(remote,'show','windows-downloads:v0.7.1/SHA256SUMS'),new RegExp('^'+status.sha256));
    assert.match(git(remote,'show','windows-downloads:README.md'),/Download Bhaasa Windows x64/);
    await publishTestingPackage({platform:'windows',state:'failed',repoRoot:root,environment});
    assert.equal(JSON.parse(git(remote,'show','windows-downloads:v0.7.1/status.json')).state,'failed');
    assert.match(git(remote,'show','windows-downloads:README.md'),/build failed/);
    assert.equal(git(root,'worktree','list','--porcelain').match(/^worktree /gm).length,1);
  }finally{await rm(folder,{recursive:true,force:true});}
});
test('invalid or oversized artifacts are rejected before any publication',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'bhaasa-publish-validation-'));
  try{
    await writeFile(path.join(root,'package.json'),JSON.stringify({version:'0.7.1'}));
    await assert.rejects(publishTestingPackage({platform:'unknown',state:'ready',repoRoot:root}),/Choose/);
    await assert.rejects(publishTestingPackage({platform:'ios',state:'ready',repoRoot:root}),/needs an artifact/);
    await writeFile(path.join(root,'large.zip'),'');await truncate(path.join(root,'large.zip'),96*1024*1024);
    await assert.rejects(publishTestingPackage({platform:'ios',state:'ready',artifact:'large.zip',repoRoot:root}),/95 MiB/);
  }finally{await rm(root,{recursive:true,force:true});}
});
