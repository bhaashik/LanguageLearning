import {packZip,unpackZip} from './zip.js';
import {isNativeApp} from './platform.js';
export const clipKey=(target,profile)=>JSON.stringify([target.language||'ml',target.section,target.kind,target.id,profile.provider,profile.model,profile.voice]);
export function validateEndpoint(value) {
  if(isNativeApp()&&!value?.trim())throw Error('Enter the HTTPS address of your OCR or speech gateway. The mobile app does not include the Node server.');
  const u=new URL(value,globalThis.location?.href||'http://localhost');
  if(isNativeApp()&&(u.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('Use a reachable HTTPS gateway. localhost and 127.0.0.1 refer to this phone, not your computer.');
  if(u.username||u.password||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('Use an HTTPS gateway, or a local HTTP service. Do not put keys in its URL.');
  return u.href.replace(/\/$/,'');
}
let database;
function db(){
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('bhaasa.audio.v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('clips',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Audio storage is unavailable.'));
  });
  return database;
}
export async function listClips(){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('clips');const r=tx.objectStore('clips').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function deleteClip(key){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('clips','readwrite');tx.objectStore('clips').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function saveClip(target,profile,blob,origin='file') {
  if(!blob.size||blob.size>20*1024*1024||!/^audio\//.test(blob.type))throw Error('Choose an audio file smaller than 20 MB.');
  const d=await db(),key=clipKey(target,profile);
  return new Promise((resolve,reject)=>{
    const tx=d.transaction('clips','readwrite'),store=tx.objectStore('clips');let saved;
    const previous=store.get(key);
    previous.onsuccess=()=>{const now=Date.now();saved={key,language:target.language||'ml',section:target.section,scope:target.kind,itemId:target.id,text:target.ml,provider:profile.provider,model:profile.model,voice:profile.voice,gender:profile.gender||'unspecified',profileName:profile.name,origin,mime:blob.type,blob,createdAt:previous.result?.createdAt||now,updatedAt:now,revision:(previous.result?.revision||0)+1};store.put(saved);};
    tx.oncomplete=()=>resolve(saved);tx.onerror=()=>reject(Error('Could not save audio. Storage may be full; export a backup and free some space.'));
  });
}
const slug=value=>String(value).replace(/[^a-zA-Z0-9_.-]+/g,'_').slice(0,100)||'default';
export async function exportAudio(clips){
  const entries=[],manifest={format:'bhaasa-audio-v1',clips:[]};
  for(const [i,clip] of clips.entries()){
    const ext=clip.mime.includes('mpeg')?'mp3':clip.mime.includes('wav')?'wav':clip.mime.includes('ogg')?'ogg':clip.mime.includes('mp4')?'m4a':'webm';
    const name=`${clip.language==='fr'?'french':'malayalam'}/${slug(clip.section)}/${slug(clip.scope)}/${slug(clip.itemId)}/${slug(clip.provider)}/${slug(clip.model)}/${slug(clip.voice)}-${i}.${ext}`;
    const {blob,key,...metadata}=clip;manifest.clips.push({...metadata,path:name});entries.push({name,data:new Uint8Array(await blob.arrayBuffer())});
  }
  entries.unshift({name:'manifest.json',data:new TextEncoder().encode(JSON.stringify(manifest,null,2))});
  return packZip(entries);
}
export async function importAudio(blob,targets,overwrite=false){
  const files=await unpackZip(blob),manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  if(manifest.format!=='bhaasa-audio-v1'||!Array.isArray(manifest.clips)||manifest.clips.length>1000)throw Error('Not a Bhaasa audio backup.');
  // Validate the whole manifest before writing any audio.
  const pending=manifest.clips.map(c=>{
    const target=targets[c.itemId],data=files.get(c.path);
    if(!target||(c.language||'ml')!==(target.language||'ml')||target.ml!==c.text||target.section!==c.section||target.kind!==c.scope||!data||data.length>20*1024*1024||!/^audio\/[a-z0-9.+;-]+(?:[ =a-z0-9".-]*)?$/i.test(c.mime)||!['provider','model','voice','profileName'].every(k=>typeof c[k]==='string'&&c[k].length<250))throw Error('The backup has unknown content, changed text, or invalid audio metadata.');
    const profile={provider:c.provider,model:c.model,voice:c.voice,name:c.profileName,gender:['male','female','neutral','unspecified'].includes(c.gender)?c.gender:'unspecified'};
    return {target,profile,blob:new Blob([data],{type:c.mime})};
  });
  const existing=new Set((await listClips()).map(c=>c.key));let count=0;
  for(const p of pending){if(!overwrite&&existing.has(clipKey(p.target,p.profile)))continue;await saveClip(p.target,p.profile,p.blob,'backup');count++;}
  return count;
}
