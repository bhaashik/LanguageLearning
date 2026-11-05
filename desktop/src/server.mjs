import http from 'node:http';
import {handleOCR} from '../../scripts/ocr.mjs';
import {handleSpeech} from '../../scripts/speech.mjs';

export const APP_ID='io.github.bhaashik.bhaasa.desktop';
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',ttf:'font/ttf',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8'};
export function createDesktopServer({asset,env={},version='development',instanceId='',settings,onPreference=async()=>{},onClient=()=>{},onQuit=()=>{},fetcher=fetch}){
  const clients=new Set();
  const server=http.createServer(async(req,res)=>{
    try{
      const port=server.address().port,origin=`http://127.0.0.1:${port}`;
      // Bind only to loopback and reject foreign Host/Origin values, including DNS rebinding.
      if(req.headers.host!==`127.0.0.1:${port}`||(req.headers.origin&&req.headers.origin!==origin)){res.writeHead(403).end('Use the local Bhaasa app address.');return;}
      const url=new URL(req.url,origin),name=decodeURIComponent(url.pathname);
      const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
      if(name==='/desktop/status'&&req.method==='GET'){res.writeHead(200,{...headers,'Content-Type':'application/json'}).end(JSON.stringify({appId:APP_ID,version,instanceId}));return;}
      if(name==='/desktop/lifecycle'&&req.method==='GET'){
        res.writeHead(200,{...headers,'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write(': Bhaasa is open\n\n');
        clients.add(res);onClient(clients.size);
        const timer=setInterval(()=>res.write(': keepalive\n\n'),20000);timer.unref();
        res.on('close',()=>{clearInterval(timer);clients.delete(res);onClient(clients.size);});return;
      }
      if(['/desktop/preferences','/desktop/quit'].includes(name)){
        if(req.method!=='POST'){res.writeHead(405,headers).end();return;}
        if(!req.headers['content-type']?.startsWith('application/json')){res.writeHead(415,headers).end();return;}
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){res.writeHead(413,headers).end();return;}}
        let data;try{data=JSON.parse(body);}catch{res.writeHead(400,headers).end('Invalid JSON');return;}
        if(name==='/desktop/quit'){res.writeHead(200,headers).end('Bhaasa stopped. You can close this window.');setImmediate(onQuit);return;}
        if(!data||!['auto','default','chrome','edge','chromium','brave','firefox'].includes(data.browser)||Object.keys(data).length!==1){res.writeHead(400,headers).end('Choose a supported browser.');return;}
        await onPreference(data.browser);res.writeHead(200,headers).end('Browser preference saved. Export your progress/audio before switching browser profiles. It applies next time you launch Bhaasa.');return;
      }
      if(name==='/desktop/'&&req.method==='GET'){
        res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'}).end(settings());return;
      }
      const privateEnv={...env,BHAASA_OCR_ALLOWED_ORIGIN:origin,BHAASA_TTS_ALLOWED_ORIGIN:origin};
      if(await handleOCR(req,res,url,{env:privateEnv,fetcher}))return;
      if(await handleSpeech(req,res,url,{env:privateEnv,fetcher}))return;
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,headers).end();return;}
      const filename=name==='/desktop/client.js'?'desktop-client.js':name==='/'?'index.html':name.slice(1);
      if(!filename||filename.split('/').some(part=>!part||part.startsWith('.'))||filename.includes('\\')||filename.includes('\0')){res.writeHead(404,headers).end();return;}
      let body=await asset(filename);
      if(filename.endsWith('.html'))body=Buffer.from(body.toString('utf8').replace('</head>','<script src="/desktop/client.js"></script></head>'));
      const type=types[filename.split('.').pop()]||'application/octet-stream';
      res.writeHead(200,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);
    }catch{if(!res.headersSent)res.writeHead(req.url.startsWith('/desktop/')?500:404,{'Cache-Control':'no-store'});res.end('Not found or unavailable. Check local settings file permissions if saving failed.');}
  });
  return {server,close:()=>{for(const client of clients)client.end();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));}};
}
