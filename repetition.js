export const DAY=86400000;
export const REVIEW_DAYS=[0,1,3,7,14,30];
export function nextReview(old,correct,now){
  // Extra practice counts, but cannot turn one sitting into a month of retention.
  const early=old&&old.due>now;
  const stage=correct?(early?old.stage:Math.min((old?.stage||0)+1,5)):0;
  return {stage,due:correct&&early?old.due:now+REVIEW_DAYS[stage]*DAY};
}
export function reviewLabel(due,now=Date.now()){
  if(due<=now)return 'Due now';const days=Math.ceil((due-now)/DAY);return `In ${days} ${days===1?'day':'days'}`;
}
export function reviewForecast(progress,items,now=Date.now()){
  const entries=items.filter(i=>progress.items[i.id]);
  return entries.map(item=>({item,...progress.items[item.id]})).sort((a,b)=>a.due-b.due).slice(0,12).map(entry=>({...entry,label:reviewLabel(entry.due,now)}));
}
