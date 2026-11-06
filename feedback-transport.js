import {randomId} from './platform.js';
import {publicReport} from './feedback.js';
export function collectorURL(value){
  let url;try{url=new URL(String(value).trim());}catch{throw Error('Use the deployed Google Apps Script web-app URL ending in /exec.');}
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname)||url.username||url.password||url.search||url.hash||url.port)throw Error('Use https://script.google.com/macros/s/DEPLOYMENT_ID/exec, without query parameters.');return url.href;
}
export function trustedReceipt(event,frame,reportId,requestId){
  let url;try{url=new URL(event.origin);}catch{return false;}
  if(url.protocol!=='https:'||url.port||!(url.hostname==='script.google.com'||url.hostname==='script.googleusercontent.com'||/^[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname)))return false;
  let source=event.source,withinFrame=false;
  try{for(let n=0;source&&n<8;n++){if(source===frame){withinFrame=true;break;}if(source===source.parent)break;source=source.parent;}}catch{return false;}
  const data=event.data;
  return withinFrame&&data&&typeof data==='object'&&data.type==='bhaasa-feedback-receipt-v1'&&data.requestId===requestId&&data.reportId===reportId&&typeof data.ok==='boolean';
}
export function sendToAppsScript(report,destination,{signal,timeoutMs=45000}={}){
  const url=collectorURL(destination),requestId=randomId();
  if(signal?.aborted)return Promise.reject(Error('Sending was cancelled. Receipt is not confirmed.'));
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe'),form=document.createElement('form'),input=document.createElement('input');
    frame.name=`bhaasa-feedback-${requestId}`;frame.title='Feedback submission receipt';frame.hidden=true;
    form.method='POST';form.action=url;form.target=frame.name;form.hidden=true;input.type='hidden';input.name='payload';input.value=JSON.stringify({requestId,report:publicReport(report)});form.append(input);
    let timer,finished=false;
    function finish(error,data){if(finished)return;finished=true;clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);frame.remove();form.remove();error?reject(error):resolve(data);}
    function abort(){finish(Error('Sending was cancelled. Receipt is not confirmed; the saved report can be retried.'));}
    function receive(event){
      if(!trustedReceipt(event,frame.contentWindow,report.id,requestId))return;
      const data=event.data;
      if(!data.ok){const messages={not_configured:'The Google Sheet collector has not been configured by its owner.',busy:'The collector is busy. Retry this saved report.',invalid_report:'The collector rejected this report format.',write_failed:'Google Sheets did not confirm saving the response.'};finish(Error(messages[data.code]||'The collector did not accept the report.'));return;}
      if(typeof data.receivedAt!=='string'||!Number.isFinite(Date.parse(data.receivedAt)))return;
      finish(null,{receivedAt:data.receivedAt,duplicate:data.duplicate===true});
    }
    window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>finish(Error('Google did not confirm receipt. Your report is saved locally; retrying the same report avoids a duplicate row.')),timeoutMs);
    document.body.append(frame,form);
    try{form.submit();}catch{finish(Error('The feedback form could not connect to Google. Your report remains saved.'));}
  });
}
