import {readingInstructions,openAIVoice} from '../speech-presets.js';

export function pcmToWav(pcm){
  if(!pcm.length||pcm.length%2)throw Error('Incomplete PCM audio');
  const header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
  header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}

async function socketFactory(url,options){
  let WebSocket,HttpsProxyAgent;
  try{({default:WebSocket}=await import('ws'));({HttpsProxyAgent}=await import('https-proxy-agent'));}
  catch{throw Error('Install the optional gateway dependencies with npm run speech:install.');}
  const proxy=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;
  // Keep the managed HTTPS proxy and inherited TLS/CA configuration intact.
  return new WebSocket(url,{...options,...(proxy?{agent:new HttpsProxyAgent(proxy)}:{}),maxPayload:25*1024*1024});
}

export async function generateRealtime({input,model,voice,apiKey,signal,language='ml-IN'},{connect=socketFactory,timeoutMs=40000}={}){
  const instructions=readingInstructions(language);
  if(signal?.aborted)throw Error('Speech request cancelled');
  const url=new URL('wss://api.openai.com/v1/realtime');url.searchParams.set('model',model);
  const socket=await connect(url,{headers:{Authorization:`Bearer ${apiKey}`}});
  return new Promise((resolve,reject)=>{
    let complete=false,configured=false,requested=false,size=0;const chunks=[];
    const timer=setTimeout(()=>finish(Error('OpenAI speech generation timed out.')),timeoutMs);
    const cancel=()=>finish(Error('Speech request cancelled'));
    function finish(error){
      if(complete)return;complete=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
      if(error){try{socket.terminate();}catch{}reject(error);}
      else{try{const wav=pcmToWav(Buffer.concat(chunks));socket.close(1000);resolve(wav);}catch(e){try{socket.terminate();}catch{}reject(e);}}
    }
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted){cancel();return;}
    socket.on('error',()=>finish(Error('Could not connect to OpenAI Realtime. Check the gateway credentials, API access, proxy, and network settings.')));
    socket.on('unexpected-response',(_request,response)=>{response.resume();finish(Error(`OpenAI Realtime rejected the connection (HTTP ${response.statusCode}).`));});
    socket.on('close',()=>{if(!complete)finish(Error('OpenAI closed before returning a complete audio response.'));});
    socket.on('message',raw=>{
      try{
        const event=JSON.parse(raw.toString());
        if(event.type==='session.created'&&!configured){
          configured=true;socket.send(JSON.stringify({type:'session.update',session:{type:'realtime',output_modalities:['audio'],instructions,audio:{output:{format:{type:'audio/pcm',rate:24000},voice:openAIVoice(voice),speed:.85}}}}));
        }else if(event.type==='session.updated'&&!requested){
          requested=true;socket.send(JSON.stringify({type:'response.create',response:{conversation:'none',output_modalities:['audio'],instructions,input:[{type:'message',role:'user',content:[{type:'input_text',text:input}]}]}}));
        }else if(event.type==='response.output_audio.delta'){
          if(!requested||typeof event.delta!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(event.delta))throw Error('Invalid audio from OpenAI');
          const data=Buffer.from(event.delta,'base64');size+=data.length;if(size>20*1024*1024-44)throw Error('Audio exceeds file limit');chunks.push(data);
        }else if(event.type==='response.done'){
          if(!requested||event.response?.status!=='completed')throw Error('OpenAI did not complete the requested reading.');
          finish();
        }else if(event.type==='error')throw Error('OpenAI rejected the speech request. Check your model, voice, API key, and billing.');
      }catch(e){finish(e);}
    });
  });
}
