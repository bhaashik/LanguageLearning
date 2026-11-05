import {nextReview} from './repetition.js';
import {ensureSession,localDay} from './learning.js';
// Preserve accents and inflectional spelling. Only punctuation/case/spacing and
// equivalent Malayalam chillu encodings are normalized.
export function normalizeTranscript(text,language){
  let value=String(text).normalize('NFC').toLocaleLowerCase(language==='fr'?'fr':'ml').replace(/[’‘ʼ]/g,"'");
  if(language==='ml')for(const [joined,atomic] of [['ണ്‍','ൺ'],['ന്‍','ൻ'],['ര്‍','ർ'],['ല്‍','ൽ'],['ള്‍','ൾ'],['ക്‍','ൿ']])value=value.replaceAll(joined,atomic.toLowerCase());
  return value.replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();
}
export function compareSpeech(transcript,target){
  const language=target.language||'ml',actual=normalizeTranscript(transcript,language),alternatives=[target.ml,...(target.spokenVariants||[])];
  const normalized=alternatives.map(t=>normalizeTranscript(t,language));
  const wanted=normalized[0].split(' ').filter(Boolean),heard=actual.split(' ').filter(Boolean);
  const table=Array.from({length:wanted.length+1},()=>Array(heard.length+1).fill(0));
  for(let i=1;i<=wanted.length;i++)for(let j=1;j<=heard.length;j++)table[i][j]=wanted[i-1]===heard[j-1]?table[i-1][j-1]+1:Math.max(table[i-1][j],table[i][j-1]);
  const matching=table[wanted.length][heard.length];
  const matched=Boolean(actual)&&normalized.includes(actual);
  return {matched,coverage:matched?1:wanted.length?matching/Math.max(wanted.length,heard.length):0,transcript:String(transcript).trim(),heard,wanted};
}
export function recordSpeaking(progress,id,result,now=Date.now()){
  if(!result.transcript?.trim()||result.transcript.length>2000||!Number.isFinite(result.coverage)||result.coverage<0||result.coverage>1||typeof result.matched!=='boolean')return progress;
  progress=ensureSession(progress,now);
  const old=progress.speaking?.[id]||{attempts:0,matches:0,stage:0},review=nextReview(old,result.matched,now);
  const entry={attempts:old.attempts+1,matches:old.matches+Number(result.matched),lastTranscript:result.transcript,lastCoverage:result.coverage,lastAt:now,source:String(result.source||'asr').slice(0,64),...review};
  const session=progress.session||{startedAt:now,lastAt:now,sections:{}},s=session.speaking||{attempts:0,matches:0,totalCoverage:0};
  return {...progress,speaking:{...progress.speaking,[id]:entry},activity:{...progress.activity,[localDay(now)]:(progress.activity[localDay(now)]||0)+1},recent:[...(progress.recent||[]).filter(previous=>previous!==id),id].slice(-8),session:{...session,lastAt:now,speaking:{attempts:s.attempts+1,matches:s.matches+Number(result.matched),totalCoverage:s.totalCoverage+result.coverage}}};
}
export const dueSpeaking=(progress,items,now=Date.now())=>items.filter(item=>progress.speaking?.[item.id]?.due<=now).sort((a,b)=>progress.speaking[a.id].due-progress.speaking[b.id].due);
