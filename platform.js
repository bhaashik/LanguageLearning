// The mobile build injects its native bridge before app.js. Web builds need no
// Capacitor packages and retain their regular browser behavior.
export const nativeBridge=()=>globalThis.BhaasaNative?.isNative?globalThis.BhaasaNative:null;
export const isNativeApp=()=>Boolean(nativeBridge());
// WKWebView supports secure random bytes even when randomUUID is unavailable.
export function randomId(source=globalThis.crypto){
  if(source.randomUUID)return source.randomUUID();
  const bytes=source.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function defaultGateway(path){return isNativeApp()?'':new URL(`./api/${path}`,globalThis.location?.href||'http://localhost:4173/').href;}
export const helpLinkAttributes=()=>isNativeApp()?'':'target="_blank" rel="noopener"';
export async function exportFile(blob,name){
  if(isNativeApp())return nativeBridge().exportFile(blob,name);
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
