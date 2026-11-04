// Geometry-only feedback. These measures do not perform OCR or certify handwriting.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function pathLength(points){return points.reduce((n,p,i)=>n+(i?distance(p,points[i-1]):0),0);}
export function bounds(paths){
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const path of paths)for(const p of path){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
  return Number.isFinite(x)?{x,y,width:right-x,height:bottom-y}:{x:0,y:0,width:0,height:0};
}
export function resample(points,spacing=6){
  if(points.length<2)return points.map(p=>({...p}));
  const result=[{...points[0]}];let remainder=0;
  for(let i=1;i<points.length;i++){
    let a={...points[i-1]},b=points[i],length=distance(a,b);
    while(length+remainder>=spacing&&length>0){
      const part=(spacing-remainder)/length;
      a={x:a.x+(b.x-a.x)*part,y:a.y+(b.y-a.y)*part};result.push(a);length=distance(a,b);remainder=0;
    }
    remainder+=length;
  }
  if(distance(result.at(-1),points.at(-1))>.01)result.push({...points.at(-1)});
  return result;
}
export function smoothPath(points){
  if(points.length<3)return points.map(p=>({...p}));
  const out=[{...points[0]}];let start=points[0];
  for(let i=1;i<points.length-1;i++){
    const control=points[i],end={x:(points[i].x+points[i+1].x)/2,y:(points[i].y+points[i+1].y)/2};
    const steps=Math.max(2,Math.ceil((distance(start,control)+distance(control,end))/3));
    for(let j=1;j<=steps;j++){const t=j/steps,s=1-t;out.push({x:s*s*start.x+2*s*t*control.x+t*t*end.x,y:s*s*start.y+2*s*t*control.y+t*t*end.y});}
    start=end;
  }
  out.push({...points.at(-1)});return out;
}
export function fitGuide(guide,width=800,height=600){
  const paths=guide.paths.map(path=>path.map(([x,y])=>({x,y}))),box=bounds(paths);
  const scale=Math.min(2,(width-160)/Math.max(1,box.width),(height-160)/Math.max(1,box.height));
  const cx=box.x+box.width/2,cy=box.y+box.height/2;
  return {...guide,paths:paths.map(path=>path.map(p=>({x:(p.x-cx)*scale+width/2,y:(p.y-cy)*scale+height/2}))),anchor:{x:(400-cx)*scale+width/2,y:(204-cy)*scale+height/2},fontSize:200*scale};
}
export function meaningfulInk(strokes){const b=bounds(strokes);return strokes.reduce((n,p)=>n+pathLength(p),0)>=60&&b.width>=12&&b.height>=12;}
const nearest=(p,points)=>points.reduce((best,q)=>Math.min(best,distance(p,q)),Infinity);
function roughness(paths){
  let turns=0,count=0;
  for(const path of paths){const p=resample(path,7);for(let i=1;i<p.length-1;i++){
    const a={x:p[i].x-p[i-1].x,y:p[i].y-p[i-1].y},b={x:p[i+1].x-p[i].x,y:p[i+1].y-p[i].y};
    const length=Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y);if(!length)continue;
    turns+=Math.max(0,Math.acos(clamp((a.x*b.x+a.y*b.y)/length,-1,1))-.25);count++;
  }}
  return count?turns/count:0;
}
function samples(path,count=64){
  const p=resample(path,Math.max(.01,pathLength(path)/(count-1)));return Array.from({length:count},(_,i)=>p[Math.min(p.length-1,Math.round(i*(p.length-1)/(count-1)))]);
}
export function evaluateTrace(strokes,guide,{tolerance=20}={}){
  if(!meaningfulInk(strokes))return {assessable:false,message:'Draw a complete symbol before checking.'};
  const expected=guide.paths.map(smoothPath),ink=strokes.map(smoothPath),a=ink.flatMap(p=>resample(p,6)),b=expected.flatMap(p=>resample(p,6));
  const onPath=a.filter(p=>nearest(p,b)<=tolerance).length/a.length;
  const coverage=b.filter(p=>nearest(p,a)<=tolerance).length/b.length;
  const partCoverage=expected.map(path=>{const p=resample(path,6);return p.filter(q=>nearest(q,a)<=tolerance).length/p.length;});
  const expectedLength=expected.reduce((n,p)=>n+pathLength(p),0),inkLength=ink.reduce((n,p)=>n+pathLength(p),0);
  const lengthRatio=inkLength/expectedLength;
  const fit=(onPath+coverage?2*onPath*coverage/(onPath+coverage):0)*Math.min(1,1.6/lengthRatio)*(.5+.5*Math.min(1,Math.min(...partCoverage)/.8));
  const smoothness=clamp(1-Math.max(0,roughness(strokes)-roughness(guide.paths)-.15)/.9);
  const suggestedStrokes=guide.paths.length,strokeCount=strokes.length;
  let pathOrder=null,reversed=false;
  if(strokeCount===suggestedStrokes){
    let error=0,reverseError=0;
    for(let i=0;i<strokes.length;i++){
      const u=samples(ink[i]),v=samples(expected[i]);
      error+=u.reduce((n,p,j)=>n+distance(p,v[j]),0)/u.length;
      reverseError+=u.reduce((n,p,j)=>n+distance(p,v[v.length-1-j]),0)/u.length;
    }
    pathOrder=error/strokeCount<=35;reversed=reverseError+15<error;
  }
  const feedback=[];
  if(coverage<.75||Math.min(...partCoverage)<.65)feedback.push('Finish more of the curves and any separate marks.');
  if(onPath<.8)feedback.push('Keep the pen closer to the guide path.');
  if(lengthRatio>2)feedback.push('Try fewer repeated passes over the same curve.');
  if(smoothness<.65)feedback.push('Slow down and make a flowing curve rather than many small zigzags.');
  if(strokeCount>suggestedStrokes)feedback.push(`This practice guide uses ${suggestedStrokes} continuous ${suggestedStrokes===1?'stroke':'strokes'}. Try fewer pen lifts.`);
  if(strokeCount<suggestedStrokes)feedback.push('Lift the pen between the separate parts shown in this guide.');
  if(reversed)feedback.push('For this suggested path, try following the arrow direction.');
  else if(pathOrder===false)feedback.push('Your path differs from the suggested order; watch the demonstration. Other handwriting conventions may differ.');
  const passed=coverage>=.75&&onPath>=.8&&lengthRatio<=2.8&&partCoverage.every(n=>n>=.65);
  if(!feedback.length)feedback.push('Good coverage and flowing curves. Try hiding the guide and writing it again.');
  return {assessable:true,fit:clamp(fit),onPath,coverage,partCoverage,smoothness,strokeCount,suggestedStrokes,lengthRatio,pathOrder,reversed,passed,feedback};
}
export function canonicalMalayalam(text){
  return text.normalize('NFC').replace(/ണ്\u200d/g,'ൺ').replace(/ന്\u200d/g,'ൻ').replace(/ര്\u200d/g,'ർ').replace(/ല്\u200d/g,'ൽ').replace(/ള്\u200d/g,'ൾ').replace(/ക്\u200d/g,'ൿ').replace(/[\s.।]/g,'');
}
export const recognitionMatches=(recognized,expected)=>canonicalMalayalam(recognized)===canonicalMalayalam(expected);
