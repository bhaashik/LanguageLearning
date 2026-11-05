// Broad teaching features, not a narrow transcription of a speaker or dialect.
// A consonant's features describe its consonantal sound, not its voiced vowel.
const vowel=(ipa,height,backness,rounding,length,tip,extra=[])=>({ipa,kind:'vowel',height,backness,rounding,length,voicing:'voiced',features:[height,backness,rounding,length,'voiced',...extra].filter(Boolean),tip});
const consonant=(ipa,place,manner,voicing,aspiration,tip,extra=[])=>({ipa,kind:'consonant',place,manner,voicing,aspiration,features:[place,manner,voicing==='voiceless'?'unvoiced':voicing,aspiration,...extra].filter(Boolean),tip});
export const vowelFeatures={
  'അ':vowel('ɐ ~ a','open / near-open','central','unrounded','short','Keep the tongue low and relaxed, with open lips; make the vowel short.'),
  'ആ':vowel('aː','open','central','unrounded','long','Keep the tongue low and the mouth open; hold the vowel longer than അ.'),
  'ഇ':vowel('i','close / high','front','unrounded','short','Raise the front of the tongue toward the hard palate, keep the lips unrounded, and make it short.'),
  'ഈ':vowel('iː','close / high','front','unrounded','long','Use the same high front tongue position as ഇ, but hold it longer.'),
  'ഉ':vowel('u','close / high','back','rounded','short','Raise the back of the tongue and round the lips; make it short.'),
  'ഊ':vowel('uː','close / high','back','rounded','long','Use the same high back tongue position and rounded lips as ഉ, but hold it longer.'),
  'എ':vowel('e','mid','front','unrounded','short','Raise the front of the tongue halfway, keep the lips unrounded, and make it short.'),
  'ഏ':vowel('eː','mid','front','unrounded','long','Keep the tongue at the front and mid-height as for എ, but hold it longer.'),
  'ഒ':vowel('o','mid','back','rounded','short','Raise the back of the tongue halfway and round the lips; make it short.'),
  'ഓ':vowel('oː','mid','back','rounded','long','Keep the tongue at the back and mid-height with rounded lips, and hold it longer than ഒ.'),
  'ഐ':vowel('ai̯','open → close','central → front','unrounded',null,'Begin with an open അ-like vowel and glide toward ഇ within one syllable.',['diphthong']),
  'ഔ':vowel('au̯','open → close','central → back','unrounded → rounded',null,'Begin with an open അ-like vowel and glide toward ഉ, rounding the lips as you close.',['diphthong']),
  'ഋ':vowel('r̩ ~ ri',null,null,null,'short','Usually say രി /ri/ in Malayalam; learned recitation may use a syllabic r.',['learned','syllabic rhotic']),
  'ൠ':vowel('r̩ː',null,null,null,'long','Rare learned form: sustain a syllabic r, following a teacher’s recitation.',['rare','syllabic rhotic']),
  'ഌ':vowel('l̩',null,null,null,'short','Rare learned form: let voiced air pass around the tongue’s sides while l itself carries the syllable.',['rare','syllabic lateral']),
  'ൡ':vowel('l̩ː',null,null,null,'long','Rare learned form: sustain a syllabic l with air passing around the tongue’s sides.',['rare','syllabic lateral'])
};
const C=consonant;
export const consonantFeatures={
  'ക':C('k','velar','stop','voiceless','unaspirated','Touch the back of the tongue to the soft palate and release without a large puff.'),
  'ഖ':C('kʰ','velar','stop','voiceless','aspirated','Release a back-of-tongue closure at the soft palate with a puff of breath.'),
  'ഗ':C('ɡ','velar','stop','voiced','unaspirated','Close the back of the tongue against the soft palate, then release with voice.'),
  'ഘ':C('ɡʱ','velar','stop','voiced','breathy / aspirated','Release a voiced back-of-tongue closure with a breathy puff in careful learned speech.'),
  'ങ':C('ŋ','velar','nasal','voiced',null,'Keep the back of the tongue against the soft palate and let voiced air pass through the nose.'),
  'ച':C('t͡ʃ','postalveolar','affricate','voiceless','unaspirated','Close just behind the tooth ridge, then release into a brief sh-like friction.',['traditional palatal series']),
  'ഛ':C('t͡ʃʰ','postalveolar','affricate','voiceless','aspirated','Release a closure just behind the tooth ridge into sh-like friction with a puff.',['traditional palatal series']),
  'ജ':C('d͡ʒ','postalveolar','affricate','voiced','unaspirated','Close just behind the tooth ridge and release into brief friction while keeping the voice on.',['traditional palatal series']),
  'ഝ':C('d͡ʒʱ','postalveolar','affricate','voiced','breathy / aspirated','Release a voiced closure behind the tooth ridge into friction with a breathy puff.',['traditional palatal series']),
  'ഞ':C('ɲ','palatal','nasal','voiced',null,'Touch the front body of the tongue to the hard palate and let voiced air pass through the nose.'),
  'ട':C('ʈ','retroflex','stop','voiceless','unaspirated','Retract the tongue tip behind the tooth ridge, touch the roof, and release without a large puff.'),
  'ഠ':C('ʈʰ','retroflex','stop','voiceless','aspirated','Retract the tongue tip behind the tooth ridge and release the closure with a puff.'),
  'ഡ':C('ɖ','retroflex','stop','voiced','unaspirated','Retract the tongue tip behind the tooth ridge and release the closure with voice.'),
  'ഢ':C('ɖʱ','retroflex','stop','voiced','breathy / aspirated','Release a voiced closure with the tongue tip retracted, adding breathiness in careful learned speech.'),
  'ണ':C('ɳ','retroflex','nasal','voiced',null,'Retract the tongue tip behind the tooth ridge and let voiced air pass through the nose.'),
  'ത':C('t̪','dental','stop','voiceless','unaspirated','Touch the tongue tip to the upper teeth and release without a large puff.'),
  'ഥ':C('t̪ʰ','dental','stop','voiceless','aspirated','Touch the tongue tip to the upper teeth and release with a puff of breath.'),
  'ദ':C('d̪','dental','stop','voiced','unaspirated','Touch the tongue tip to the upper teeth and release the closure with voice.'),
  'ധ':C('d̪ʱ','dental','stop','voiced','breathy / aspirated','Release a voiced closure at the upper teeth with a breathy puff in careful learned speech.'),
  'ന':C('n̪ ~ n','dental / alveolar','nasal','voiced',null,'Touch the upper teeth or tooth ridge with the tongue tip and let voiced air pass through the nose.'),
  'പ':C('p','bilabial','stop','voiceless','unaspirated','Close both lips and release without a large puff.'),
  'ഫ':C('pʰ ~ f','bilabial / labiodental','stop / fricative','voiceless','aspirated stop or loan /f/','For /pʰ/, release closed lips with a puff; for loanword /f/, pass air between the lower lip and upper teeth.'),
  'ബ':C('b','bilabial','stop','voiced','unaspirated','Close both lips, then release the closure with voice.'),
  'ഭ':C('bʱ','bilabial','stop','voiced','breathy / aspirated','Release a voiced closure of both lips with a breathy puff in careful learned speech.'),
  'മ':C('m','bilabial','nasal','voiced',null,'Close both lips and let voiced air pass through the nose.'),
  'യ':C('j','palatal','approximant','voiced',null,'Raise the front of the tongue toward the hard palate without blocking the airflow.'),
  'ര':C('r ~ ɾ','alveolar','tap / trill','voiced',null,'Tap the tongue tip lightly at the tooth ridge, or let it make a short trill.'),
  'ല':C('l','dental / alveolar','lateral approximant','voiced',null,'Touch the tongue tip near the upper teeth or tooth ridge and let air flow around its sides.'),
  'വ':C('ʋ ~ v','labiodental','approximant / fricative','voiced',null,'Bring the lower lip near the upper teeth and pass voiced air through, with little or gentle friction.'),
  'ശ':C('ʃ','postalveolar','fricative','voiceless',null,'Raise the tongue front just behind the tooth ridge and let air hiss through a narrow gap.'),
  'ഷ':C('ʂ ~ ʃ','retroflex / postalveolar','fricative','voiceless',null,'Retract the tongue for a hiss; many speakers use a ശ-like /ʃ/ in ordinary speech.'),
  'സ':C('s','dental / alveolar','fricative','voiceless',null,'Bring the tongue blade near the upper teeth or tooth ridge and make a narrow hiss.'),
  'ഹ':C('h ~ ɦ','glottal','fricative','variable',null,'Let breath pass through the open throat; the sound can be breathy-voiced in context.',['unvoiced / breathy voiced in context']),
  'ള':C('ɭ','retroflex','lateral approximant','voiced',null,'Retract the tongue tip behind the tooth ridge and let voiced air pass around its sides.'),
  'ഴ':C('ɻ','retroflex','approximant','voiced',null,'Retract the tongue tip without touching the roof, letting voiced air pass through the middle.'),
  'റ':C('r̠ ~ ɾ̠','alveolar, often retracted','tap / trill','voiced',null,'Make a firmer tongue-tip tap or trill at the tooth ridge than for ര.',['distinct from ര'])
};
const vowelSigns={'ാ':'ആ','ി':'ഇ','ീ':'ഈ','ു':'ഉ','ൂ':'ഊ','ൃ':'ഋ','ൄ':'ൠ','ൢ':'ഌ','ൣ':'ൡ','െ':'എ','േ':'ഏ','ൈ':'ഐ','ൊ':'ഒ','ോ':'ഓ','ൗ':'ഔ','ൌ':'ഔ'};
const chilluBases={'ൺ':'ണ','ൻ':'ന','ർ':'ര','ൽ':'ല','ൾ':'ള','ൿ':'ക'};
const clusterTips={
  'ക്ക':'Hold the back-of-tongue closure at the soft palate longer before releasing.',
  'പ്പ':'Keep both lips closed longer before releasing.',
  'ട്ട':'Hold the closure with the tongue tip retracted behind the tooth ridge longer before releasing.',
  'ത്ത':'Hold the tongue-tip closure at the upper teeth longer before releasing.',
  'ന്ത':'Keep the tongue at the upper teeth for the nasal, then release a dental stop without an intervening vowel.',
  'മ്പ':'Keep the lips together for the nasal, then release a lip stop without an intervening vowel.',
  'ങ്ക':'Keep the back of the tongue at the soft palate for the nasal, then release a velar stop.',
  'ഞ്ച':'Make a palatal nasal and move directly into a brief unvoiced affricate behind the tooth ridge.',
  'ണ്ട':'Keep the tongue tip retracted for the nasal, then release a retroflex stop.',
  'ക്ഷ':'Release a velar closure directly into a retroflex or sh-like hiss, without an intervening vowel.',
  'ജ്ഞ':'Often say a ഞ-like nasal; careful learned readings may preserve a j-plus-ñ sequence.',
  'റ്റ':'Hold a tongue-tip closure at the tooth ridge for a long /tː/, then release.',
  'മ്മ':'Keep both lips together while humming through the nose for a longer moment.',
  'ന്ന':'Keep the tongue tip at the teeth or tooth ridge while humming through the nose for a longer moment.',
  'ണ്ണ':'Keep the tongue tip retracted while humming through the nose for a longer moment.',
  'ങ്ങ':'Keep the back of the tongue against the soft palate while humming through the nose for a longer moment.',
  'ഞ്ഞ':'Keep the tongue body against the hard palate while humming through the nose for a longer moment.',
  'ച്ച':'Hold the closure just behind the tooth ridge longer, then release into brief sh-like friction.',
  'ല്ല':'Keep the tongue tip at the teeth or tooth ridge while voiced air flows around the sides for longer.',
  'ള്ള':'Keep the tongue tip retracted while voiced air flows around the sides for longer.',
  'ച്ഛ':'Hold a closure just behind the tooth ridge, then release into sh-like friction with a puff.',
  'ക്ര':'Release a velar closure straight into a brief tongue-tip tap, without an intervening vowel.',
  'ഗ്ര':'Release a voiced velar closure straight into a brief tongue-tip tap.',
  'ത്ര':'Release a closure at the upper teeth straight into a brief tap at the tooth ridge.',
  'ദ്ര':'Release a voiced closure at the upper teeth straight into a brief tongue-tip tap.',
  'പ്ര':'Release both lips straight into a brief tongue-tip tap, without an intervening vowel.',
  'ബ്ര':'Release a voiced lip closure straight into a brief tongue-tip tap.',
  'ശ്ര':'Move from a sh-like hiss straight into a brief tongue-tip tap, without an intervening vowel.',
  'ക്ത':'Move from a back-of-tongue closure straight into a closure at the upper teeth.',
  'സ്ത':'Make an s-like hiss, then close the tongue tip at the upper teeth without an intervening vowel.',
  'സ്ക':'Make an s-like hiss, then close the back of the tongue at the soft palate.',
  'സ്പ':'Make an s-like hiss, then close both lips without an intervening vowel.'
};
const part=(symbol,label,profile)=>({symbol,label,...profile});
const held=(profile)=>({...profile,length:'long',features:[...profile.features,'long / geminate']});
function cluster(base){
  if(base==='റ്റ')return {parts:[part(base,'Long consonant',held(C('tː','alveolar','stop','voiceless','unaspirated',clusterTips[base])))],tip:clusterTips[base]};
  if(base==='ജ്ഞ')return {parts:[part(base,'Word-dependent consonant',{kind:'consonant',ipa:'ɲ ~ d͡ʒɲ',features:['palatal nasal / affricate + nasal','voiced','word / register dependent']})],tip:clusterTips[base]};
  if(base==='ച്ഛ')return {parts:[part(base,'Long consonant',held(consonantFeatures['ഛ']))],tip:clusterTips[base]};
  const letters=base.split('്');if(!letters.length||letters.some(s=>!consonantFeatures[s]))return null;
  const doubled=letters.length===2&&letters[0]===letters[1];
  const parts=doubled?[part(base,'Long consonant',held(consonantFeatures[letters[0]]))]:letters.map((symbol,i)=>part(symbol,letters.length===1?'Consonant':`Consonant ${i+1}`,consonantFeatures[symbol]));
  return {parts,tip:letters.length===1?parts[0].tip:clusterTips[base]};
}
export function phoneticsFor(text){
  const spelling=text.normalize('NFC');
  if(vowelFeatures[spelling])return {kind:'vowel',parts:[part(spelling,'Vowel',vowelFeatures[spelling])],tip:vowelFeatures[spelling].tip};
  if(chilluBases[spelling]){const p=consonantFeatures[chilluBases[spelling]];return {kind:'chillu',parts:[part(spelling,'Final consonant',p)],ending:'no inherent vowel',tip:`${p.tip} End without an added vowel.`};}
  const last=spelling.at(-1),noVowel=last==='്',vowelSymbol=vowelSigns[last]||'അ';
  const base=(noVowel||vowelSigns[last])?spelling.slice(0,-1):spelling,c=cluster(base);
  if(!c||!c.tip)return null;
  const v=vowelFeatures[vowelSymbol],inherent=!noVowel&&!vowelSigns[last];
  const ending=noVowel?'no inherent vowel':inherent?'inherent a':`vowel ${vowelSymbol}`;
  const vowelTip=inherent?'Follow with a short a.':noVowel?'Do not add a full vowel here; word-final readings can vary.':`Then ${v.tip[0].toLowerCase()}${v.tip.slice(1)}`;
  return {kind:base.includes('്')?'conjunct':'consonant',parts:[...c.parts,...(noVowel?[]:[part(vowelSymbol,inherent?'Inherent vowel':'Vowel',v)])],ending,tip:`${c.tip} ${vowelTip}`};
}

export const featureGlossary=[
  ['Front / back / central','Which part of the tongue is raised for a vowel.'],
  ['Close / open','Tongue height: close vowels have a high tongue, open vowels a low tongue.'],
  ['Rounded / unrounded','Whether the lips are rounded or relaxed.'],
  ['Voiced / unvoiced','Voiced sounds use vocal-fold vibration; gently touch your throat to feel the buzz.'],
  ['Aspirated / unaspirated','Aspiration adds a breath puff after release; it is separate from voicing.'],
  ['Bilabial / labiodental','Use both lips, or the lower lip near the upper teeth.'],
  ['Dental / alveolar','Use the upper teeth, or the tooth ridge just behind them.'],
  ['Retroflex','Retract the tongue tip behind the tooth ridge.'],
  ['Palatal / postalveolar','Use the hard palate, or the area just behind the tooth ridge; the traditional palatal series includes postalveolar affricates.'],
  ['Velar / glottal','Use the soft palate at the back of the mouth, or airflow at the vocal folds.'],
  ['Stop / fricative / affricate','Block and release air, let it hiss through a gap, or combine a stop with friction.'],
  ['Nasal / lateral / approximant','Send air through the nose, around the tongue’s sides, or through a narrowing with little friction.'],
  ['Tap / trill','Make one brief tongue contact, or repeated contacts.'],
  ['Long / geminate','Hold a vowel or consonant longer without inserting another vowel.'],
  ['Reduced final vowel /ɯ/','In some word-final chandrakala readings, raise the tongue high at the back as for ഉ, but keep the lips unrounded.']
];
