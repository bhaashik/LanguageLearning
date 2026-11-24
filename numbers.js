// Malayalam cardinal forms follow SMC's mlmorph description; see docs/NUMBERS.md.
// IPA is a broad teaching pronunciation. IAST uses Malayalam extensions ḻ, ṟ, ŭ.
const basic=[
  null,
  ['ഒന്ന്','onnŭ','onːɯ','onnu'],
  ['രണ്ട്','raṇṭŭ','ɾɐɳɖɯ','randu'],
  ['മൂന്ന്','mūnnŭ','muːnːɯ','moonnu'],
  ['നാല്','nālŭ','naːlɯ','naalu'],
  ['അഞ്ച്','añcŭ','ɐɲd͡ʒɯ','anju'],
  ['ആറ്','āṟŭ','aːrɯ','aaru'],
  ['ഏഴ്','ēḻŭ','eːɻɯ','ezhu'],
  ['എട്ട്','eṭṭŭ','eʈːɯ','ettu'],
  ['ഒമ്പത്','ompatŭ','ombɐd̪ɯ','ombathu'],
  ['പത്ത്','pattŭ','pɐt̪ːɯ','paththu'],
  ['പതിനൊന്ന്','patinonnŭ','pɐd̪inonːɯ','pathinonnu'],
  ['പന്ത്രണ്ട്','pantraṇṭŭ','pɐnd̪ɾɐɳɖɯ','panthrandu'],
  ['പതിമൂന്ന്','patimūnnŭ','pɐd̪imuːnːɯ','pathimoonnu'],
  ['പതിനാല്','patinālŭ','pɐd̪inaːlɯ','pathinaalu'],
  ['പതിനഞ്ച്','patinañcŭ','pɐd̪inɐɲd͡ʒɯ','pathinanju'],
  ['പതിനാറ്','patināṟŭ','pɐd̪inaːrɯ','pathinaaru'],
  ['പതിനേഴ്','patinēḻŭ','pɐd̪ineːɻɯ','pathinezhu'],
  ['പതിനെട്ട്','patineṭṭŭ','pɐd̪ineʈːɯ','pathinettu'],
  ['പത്തൊമ്പത്','pattompatŭ','pɐt̪ːombɐd̪ɯ','paththombathu']
];
const tens={
  20:['ഇരുപത്','irupatŭ','iɾupɐd̪ɯ','irupathu','ഇരുപത്തി','irupatti','iɾupɐt̪ːi','irupaththi'],
  30:['മുപ്പത്','muppatŭ','mupːɐd̪ɯ','muppathu','മുപ്പത്തി','muppatti','mupːɐt̪ːi','muppaththi'],
  40:['നാല്പത്','nālpatŭ','naːlpɐd̪ɯ','naalpathu','നാല്പത്തി','nālpatti','naːlpɐt̪ːi','naalpaththi'],
  50:['അമ്പത്','ampatŭ','ɐmbɐd̪ɯ','ambathu','അമ്പത്തി','ampatti','ɐmbɐt̪ːi','ambaththi'],
  60:['അറുപത്','aṟupatŭ','ɐrupɐd̪ɯ','arupathu','അറുപത്തി','aṟupatti','ɐrupɐt̪ːi','arupaththi'],
  70:['എഴുപത്','eḻupatŭ','eɻupɐd̪ɯ','ezhupathu','എഴുപത്തി','eḻupatti','eɻupɐt̪ːi','ezhupaththi'],
  80:['എൺപത്','eṇpatŭ','eɳpɐd̪ɯ','enpathu','എൺപത്തി','eṇpatti','eɳpɐt̪ːi','enpaththi'],
  90:['തൊണ്ണൂറ്','toṇṇūṟŭ','t̪oɳːuːrɯ','thonnooru','തൊണ്ണൂറ്റി','toṇṇūṟṟi','t̪oɳːuːtːi','thonnootti']
};
const englishOnes=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const englishTens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
export function englishNumber(n){
  if(!Number.isInteger(n)||n<1||n>100)throw Error('Choose a number from 1 to 100.');
  return n===100?'one hundred':n<20?englishOnes[n]:englishTens[Math.floor(n/10)]+(n%10?`-${englishOnes[n%10]}`:'');
}
const suffixes={1:'യൊന്ന്',2:'രണ്ട്',3:'മൂന്ന്',4:'നാല്',5:'യഞ്ച്',6:'യാറ്',7:'യേഴ്',8:'യെട്ട്',9:'യൊമ്പത്'};
export const numbers=Array.from({length:100},(_,index)=>{
  const value=index+1,ten=Math.floor(value/10)*10,unit=value%10,english=englishNumber(value);
  let forms,gloss;
  if(value===100)forms=['നൂറ്','nūṟŭ','nuːrɯ','nooru'];
  else if(value<20)forms=basic[value];
  else if(!unit)forms=tens[value];
  else{
    const stem=tens[ten],ones=basic[unit],link=[1,5,6,7,8,9].includes(unit)?'y':'';
    forms=[stem[4]+suffixes[unit],stem[5]+link+ones[1],stem[6]+(link?'j':'')+ones[2],stem[7]+(link?'y':'')+ones[3]];
    gloss=[{iast:stem[5],roman:stem[7],meaning:englishNumber(ten)},...(link?[{iast:'y',roman:'y',meaning:'LINK'}]:[]),{iast:ones[1],roman:ones[3],meaning:englishNumber(unit)}];
  }
  const [ml,iast,ipa,roman]=forms;
  return Object.freeze({value,digits:String(value),malayalamDigits:String(value).replace(/\d/g,d=>'൦൧൨൩൪൫൬൭൮൯'[Number(d)]),english,ml,iast,ipa:`/${ipa}/`,roman,gloss:gloss||[{iast,roman,meaning:english}]});
});
export function numberTarget(value,language='ml'){
  const n=numbers[value-1];if(!n||!['ml','en'].includes(language))throw Error('Unknown number or language.');
  return {id:`number-${language}-${n.value}`,language,kind:'number',section:'numbers',title:`${n.digits} · ${language==='ml'?'Malayalam':'English'}`,ml:language==='ml'?n.ml:n.english,roman:language==='ml'?n.iast:n.english};
}
export const numberTargets=Object.fromEntries(numbers.flatMap(n=>['ml','en'].map(l=>{const t=numberTarget(n.value,l);return [t.id,t];})));
export const DEFAULT_NUMBER_SETTINGS=Object.freeze({source:'service',male:'Charon',female:'Kore',voicePause:.7,languagePause:1,numberPause:2,from:1,to:100});
export function numberSettings(value={}){
  const result={...DEFAULT_NUMBER_SETTINGS};
  if(value.source==='device')result.source='device';
  for(const key of ['male','female'])if(typeof value[key]==='string'&&value[key].length>0&&value[key].length<200)result[key]=value[key];
  for(const key of ['voicePause','languagePause'])if(Number.isFinite(value[key])&&value[key]>=.2&&value[key]<=5)result[key]=value[key];
  if(Number.isFinite(value.numberPause)&&value.numberPause>=.5&&value.numberPause<=10)result.numberPause=value.numberPause;
  for(const key of ['from','to'])if(Number.isInteger(value[key])&&value[key]>=1&&value[key]<=100)result[key]=value[key];
  for(const key of ['mlMale','mlFemale','enMale','enFemale'])if(typeof value[key]==='string'&&value[key].length<250)result[key]=value[key];
  return result;
}
export function numberPlaylist(from,to,settings={}){
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>100||from>to)throw Error('Choose a range from 1 to 100, with the first number before the last.');
  const s=numberSettings(settings);if(s.numberPause<=Math.max(s.voicePause,s.languagePause))throw Error('The pause between numbers must be longer than the other pauses.');
  const playlist=[];
  for(let value=from;value<=to;value++)for(const [index,[language,gender]] of [['ml','male'],['ml','female'],['en','male'],['en','female']].entries()){
    playlist.push({target:numberTarget(value,language),value,gender,voice:s[gender],pauseAfter:index===3?(value===to?0:s.numberPause):index===1?s.languagePause:s.voicePause});
  }
  return playlist;
}
export function numbersCSV(){
  const rows=[['Number','Malayalam digits','English','Malayalam','IPA','IAST','Plain Roman','IAST gloss','Roman gloss','Meaning gloss'],...numbers.map(n=>[n.digits,n.malayalamDigits,n.english,n.ml,n.ipa,n.iast,n.roman,n.gloss.map(g=>g.iast).join('-'),n.gloss.map(g=>g.roman).join('-'),n.gloss.map(g=>g.meaning).join('-')])];
  return '\uFEFF'+rows.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
}
