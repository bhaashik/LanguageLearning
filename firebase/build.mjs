import {mkdir,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=fileURLToPath(new URL('./functions/lib/',import.meta.url));
// An explicit upload list excludes .env.local, PDFs, source lessons, local
// servers, and other provider configuration. Preserve adapter import paths.
const files=['gateway/cloud-handler.mjs','gateway/openai-realtime.mjs',
  'scripts/ocr.mjs','scripts/ocr-providers.mjs','scripts/speech.mjs','scripts/transcribe.mjs','scripts/origins.mjs',
  'speech-presets.js','ocr-models.js','audio-store.js','platform.js','zip.js'];
await rm(output,{recursive:true,force:true});
for(const file of files){await mkdir(path.dirname(path.join(output,file)),{recursive:true});await copyFile(path.join(root,file),path.join(output,file));}
// Resolve the deployed import graph now, rather than failing during Functions
// analysis. This loads adapters only; it makes no network or generation calls.
await import('./functions/lib/gateway/cloud-handler.mjs');
console.log('Firebase gateway staged and server imports verified; provider keys and app content excluded.');
