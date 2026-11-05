import {malayalamUnits} from './courses-ml.js';
import {frenchUnits} from './courses-fr.js';
import {broadIPA,toDevanagari} from './linguistics.js';
export const parseGloss=value=>value.split(';').map(part=>{const [ml,roman,gloss]=part.split('|').map(s=>s.trim());return {ml,roman,gloss};});
// A learner-facing approximation; French /y ø œ ʁ/ have no exact ordinary Hindi equivalents.
export function frenchDevanagari(ipa){
  const map={'ɑ̃':'आँ','ɛ̃':'ऍँ','ɔ̃':'ऑँ','œ̃':'अ̈ँ','a':'अ','ɑ':'आ','e':'ए','ɛ':'ऍ','ə':'अ','i':'इ','o':'ओ','ɔ':'ऑ','u':'उ','y':'उ̈','ø':'ए̈','œ':'अ̈','p':'प्','b':'ब्','t':'त्','d':'द्','k':'क्','ɡ':'ग्','g':'ग्','f':'फ़्','v':'व्','s':'स्','z':'ज़्','ʃ':'श्','ʒ':'झ़्','m':'म्','n':'न्','ɲ':'ञ्','ŋ':'ङ्','l':'ल्','ʁ':'ऱ्','r':'ऱ्','j':'य्','w':'व्','ɥ':'यु्̈',' ': ' '};
  return (ipa.match(/ɑ̃|ɛ̃|ɔ̃|œ̃|./gu)||[]).map(c=>map[c]??(/[.ˈˌ‿ː]/u.test(c)?'':c)).join('');
}
export function constructionCourse(language){
  const source=language==='fr'?frenchUnits:malayalamUnits;
  const units=source.map(unit=>{
    const {examples,...metadata}=unit;
    return {...metadata,id:`${language}-use-${unit.id}`,items:examples.map(([ml,roman,meaning,gloss,question,answer,wrong,ipa,spokenVariants=[]],n)=>({
      id:`${language}-use-${unit.id}-${n+1}`,language,kind:'construction',section:'constructions',group:unit.title,title:unit.title,
      unitId:`${language}-use-${unit.id}`,ml,roman,meaning,ipa:ipa||broadIPA(roman),
      ipaType:language==='fr'?'broad standard-French teaching pronunciation':'broad spelling-based approximation',
      devanagari:language==='fr'?frenchDevanagari(ipa):toDevanagari(ml),gloss:parseGloss(gloss),glossType:'simplified morpheme gloss',
      note:unit.rule,question,answer,options:[answer,...wrong],explanation:unit.constraints.join(' '),spokenVariants
    }))};
  });
  return {units,items:units.flatMap(u=>u.items),lessons:units.map(u=>({id:u.id,title:u.title,subtitle:u.pattern,tag:`Constructions · ${u.level}`,icon:language==='fr'?'Aa':'മ',note:u.rule,items:u.items}))};
}
