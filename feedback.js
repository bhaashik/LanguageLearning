import {randomId} from './platform.js';
export const FEEDBACK_KEY='bhaasa.feedback.v1';
export const FEATURES=[['lessons','Lessons & quizzes'],['constructions','Useful constructions'],['tracing','Tracing & handwriting recognition'],['tts','Listening / text-to-speech'],['asr','Speaking / speech recognition'],['offline','Offline use'],['progress','Saving progress & resuming'],['backups','Audio / progress backups']];
export const RESULTS=[['not_tried','Did not try'],['worked','Worked well'],['some_problems','Some problems'],['did_not_work','Did not work']];
export const EASE=[['very_easy','Very easy'],['easy','Easy'],['mixed','Mixed'],['difficult','Difficult'],['very_difficult','Very difficult']];
export const AGAIN=[['yes','Yes'],['maybe','Maybe'],['no','No'],['not_sure','Not sure']];
export const ISSUES=[['crash','Crash / app would not open'],['slow','Slow response'],['audio','Audio'],['microphone','Microphone'],['recognition','Recognition result'],['tracing','Tracing'],['saving','Saving / restoring'],['content','Language example / explanation'],['layout','Display / navigation'],['other','Other'],['none','No problems noticed']];
const values=list=>list.map(([id])=>id);
const validObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function blankFeedback(){return {features:Object.fromEntries(FEATURES.map(([id])=>[id,'not_tried'])),ease:'',again:'',issues:[],comment:''};}
export function validateAnswers(value,language,{draft=false}={}){
  if(!validObject(value)||!validObject(value.features)||Object.keys(value).some(k=>!['features','ease','again','issues','comment'].includes(k))||Object.keys(value.features).some(k=>!FEATURES.some(([id])=>id===k)))throw Error('Invalid feedback answers.');
  const answer=blankFeedback();
  for(const [id] of FEATURES){const result=value.features[id]||'not_tried';if(!values(RESULTS).includes(result))throw Error('Choose a result for each feature.');answer.features[id]=language==='fr'&&id==='tracing'?'not_tried':result;}
  if(!values(EASE).includes(value.ease)&&!(draft&&value.ease===''))throw Error('Choose how easy the app was to use.');answer.ease=value.ease;
  if(value.again!==''&&!values(AGAIN).includes(value.again))throw Error('Choose a valid use-again option.');answer.again=value.again;
  if(!Array.isArray(value.issues)||value.issues.length>ISSUES.length||value.issues.some(id=>!values(ISSUES).includes(id))||new Set(value.issues).size!==value.issues.length||value.issues.includes('none')&&value.issues.length>1)throw Error('Choose either no problems or the problems you noticed.');answer.issues=[...value.issues];
  if(typeof value.comment!=='string'||value.comment.length>1500)throw Error('Keep optional details under 1,500 characters.');answer.comment=value.comment.trim();
  if(!draft&&!Object.values(answer.features).some(result=>result!=='not_tried'))throw Error('Choose a result for at least one feature you tried.');return answer;
}
export function validateReport(value){
  if(!validObject(value)||typeof value.id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(value.id)||!Number.isFinite(value.createdAt)||value.createdAt<0||value.createdAt>8640000000000000||typeof value.appVersion!=='string'||value.appVersion.length>80||!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value.appVersion)||!['ml','fr'].includes(value.language)||!['web','android-app','ios-app','desktop'].includes(value.platform)||!['android','ios','linux','windows','macos','other'].includes(value.system))throw Error('Invalid feedback report.');
  const report={id:value.id,createdAt:value.createdAt,appVersion:value.appVersion,language:value.language,platform:value.platform,system:value.system,answers:validateAnswers(value.answers,value.language)};
  const delivery=value.delivery||{status:'local'};
  if(!validObject(delivery)||!['local','pending','unconfirmed','confirmed'].includes(delivery.status))throw Error('Invalid delivery status.');
  report.delivery={status:delivery.status,...(typeof delivery.destination==='string'?{destination:delivery.destination.slice(0,1000)}:{}),...(typeof delivery.receivedAt==='string'?{receivedAt:delivery.receivedAt.slice(0,40)}:{})};
  return report;
}
export function createReport(answers,context,now=Date.now(),id=randomId()){return validateReport({...context,id,createdAt:now,answers,delivery:{status:'local'}});}
export function readReports(storage=globalThis.localStorage){
  let value;try{const raw=storage.getItem(FEEDBACK_KEY);if(!raw)return [];value=JSON.parse(raw);}catch{throw Error('Saved feedback could not be read. Existing reports were left unchanged.');}
  if(!validObject(value)||value.format!=='bhaasa-feedback-v1'||!Array.isArray(value.reports)||value.reports.length>100)throw Error('Saved feedback has an unsupported format.');
  const reports=value.reports.map(validateReport);if(new Set(reports.map(r=>r.id)).size!==reports.length)throw Error('Duplicate saved feedback IDs.');return reports;
}
export function writeReports(reports,storage=globalThis.localStorage){try{storage.setItem(FEEDBACK_KEY,JSON.stringify({format:'bhaasa-feedback-v1',reports}));}catch{throw Error('Feedback could not be saved on this device. Free storage or share/export existing reports.');}}
export function saveReport(report,storage){const reports=readReports(storage);if(reports.some(r=>r.id===report.id))throw Error('This report is already saved. Use Send / retry for that report.');if(reports.length>=100)throw Error('Export and remove older feedback before saving more than 100 reports.');writeReports([validateReport(report),...reports],storage);}
export function updateDelivery(id,delivery,storage){const reports=readReports(storage);if(!reports.some(r=>r.id===id))return;writeReports(reports.map(r=>r.id===id?validateReport({...r,delivery}):r),storage);}
export function deleteReport(id,storage){writeReports(readReports(storage).filter(r=>r.id!==id),storage);}
export function publicReport(report){const {delivery,...value}=validateReport(report);return value;}
export function reportText(report){
  const value=validateReport(report),labels=Object.fromEntries(RESULTS),issues=Object.fromEntries(ISSUES);
  return ['Bhaasa tester feedback',`Report: ${value.id}`,`Saved: ${new Date(value.createdAt).toISOString()}`,`App: ${value.appVersion}`,`Language: ${value.language==='fr'?'French':'Malayalam'}`,`Platform: ${value.platform} / ${value.system}`,'',...FEATURES.filter(([id])=>value.language!=='fr'||id!=='tracing').map(([id,label])=>`${label}: ${labels[value.answers.features[id]]}`),'',`Ease: ${Object.fromEntries(EASE)[value.answers.ease]}`,`Would use again: ${Object.fromEntries(AGAIN)[value.answers.again]||'Not answered'}`,`Problems: ${value.answers.issues.map(id=>issues[id]).join(', ')||'Not specified'}`,`Optional details: ${value.answers.comment||'None'}`,'',`Delivery: ${value.delivery.status==='confirmed'?'Collector confirmed receipt':'Saved on this device; receipt not confirmed'}`].join('\n');
}
