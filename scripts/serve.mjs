import http from 'node:http';
import {handleTranscription,asrServerEnabled} from './transcribe.mjs';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleSpeech,speechConfig} from './speech.mjs';
import {handleOCR,ocrServerEnabled} from './ocr.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
try{process.loadEnvFile(path.join(root,'.env.local'));}catch(error){if(error.code!=='ENOENT')throw error;}
const port=Number(process.env.PORT || 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(await handleTranscription(req,res,url))return;
    if(await handleSpeech(req,res,url))return;
    if(await handleOCR(req,res,url))return;
    let name=decodeURIComponent(url.pathname);
    if(name.split('/').some(p=>p.startsWith('.'))) {res.writeHead(404).end();return;}
    const target=path.resolve(root,`.${name}`);
    const relative=path.relative(root,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)) {res.writeHead(403).end();return;}
    const file=(await stat(target)).isDirectory()?path.join(target,'index.html'):target;
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);
  } catch {res.writeHead(404).end('Not found');}
}).listen(port,speechConfig().ready||ocrServerEnabled()||asrServerEnabled()?'127.0.0.1':'0.0.0.0',()=>console.log(`Bhaasa available on port ${port}. Press Ctrl+C to stop.`));
