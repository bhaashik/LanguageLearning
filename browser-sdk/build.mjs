import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
await build({entryPoints:[fileURLToPath(new URL('entry.js',import.meta.url))],outfile:fileURLToPath(new URL('vendor/firebase-ai.js',root)),bundle:true,format:'esm',platform:'browser',target:['safari16','chrome109'],minify:true,legalComments:'linked'});
