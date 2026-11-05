import {spawnSync} from 'node:child_process';
import {cp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const mobile=fileURLToPath(new URL('../',import.meta.url)),root=path.resolve(mobile,'..');
const result=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
await rm(path.join(mobile,'www'),{recursive:true,force:true});await mkdir(path.join(mobile,'www'),{recursive:true});
await cp(path.join(root,'dist'),path.join(mobile,'www'),{recursive:true});
await cp(path.join(mobile,'assets/webview-error.html'),path.join(mobile,'www/webview-error.html'));
await build({entryPoints:[path.join(mobile,'src/native.js')],outfile:path.join(mobile,'www/native.js'),bundle:true,format:'iife',platform:'browser',target:['chrome109','safari16'],minify:true,legalComments:'none'});
const index=path.join(mobile,'www/index.html');let html=await readFile(index,'utf8');
html=html.replace('<script type="module" src="./app.js"></script>','<script src="./native.js"></script>\n  <script type="module" src="./app.js"></script>');
await writeFile(index,html);
for(const name of await readdir(path.join(mobile,'www/docs')))if(name.endsWith('.html')){
  const file=path.join(mobile,'www/docs',name),doc=await readFile(file,'utf8');await writeFile(file,doc.replace('</head>','<script src="../native.js"></script></head>'));
}
console.log('Bhaasa mobile assets built in mobile/www/. The web dist/ build is unchanged.');
