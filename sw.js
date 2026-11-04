const BASE=new URL('./',self.location.href);
const CACHE=`bhaasa-${BASE.pathname}-v10`;
const ASSETS=['./','./index.html','./styles.css','./app.js','./content.js','./learning.js','./linguistics.js','./sounds.js','./audio.js','./audio-store.js','./audio-ui.js','./speech-presets.js','./ocr-settings.js','./tracing.js','./tracing-pad.js','./data/tracing-guides.json','./zip.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/malayalam.ttf','./assets/devanagari.ttf'];
const urls=ASSETS.map(p=>new URL(p,BASE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(urls);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const prefixes=[`bhaasa-${BASE.pathname}-`,`aksharam-${BASE.pathname}-`];
  for(const key of await caches.keys())if(prefixes.some(prefix=>key.startsWith(prefix))&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  // Navigation requests can retain hash routes and tracking query strings.
  // They all load the same static shell; match the canonical cached URL.
  const requestURL=new URL(event.request.url);
  requestURL.hash='';
  requestURL.search='';
  const assetURL=requestURL.href;
  if(event.request.method!=='GET'||!urls.includes(assetURL))return;
  event.respondWith((async()=>{
    const cached=await caches.match(assetURL,{cacheName:CACHE});
    return cached||fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const ready=(await Promise.all(urls.map(url=>cache.match(url)))).every(Boolean);
    event.source?.postMessage({type:'OFFLINE_STATUS',ready});
  })());
});
