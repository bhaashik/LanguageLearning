// Desktop assets and its gateway live on this computer; browser APIs handle
// speech, microphone permissions, imports and downloads as in the web app.
window.BhaasaDesktop=Object.freeze({isDesktop:true});
document.documentElement.dataset.desktop='true';
let lifetime=new EventSource('/desktop/lifecycle');
window.addEventListener('pagehide',()=>lifetime.close());
window.addEventListener('pageshow',()=>{if(lifetime.readyState===EventSource.CLOSED)lifetime=new EventSource('/desktop/lifecycle');});
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&new URL(link.href).origin!==location.origin){link.target='_blank';link.rel='noopener';}});
