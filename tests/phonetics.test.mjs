import test from 'node:test';
import assert from 'node:assert/strict';
import {writingItems,byId} from '../content.js';
import {phoneticsFor,vowelFeatures,consonantFeatures} from '../phonetics.js';
import {emptyProgress,validateProgress} from '../learning.js';

test('all 975 writing forms have component features and at most two short pronunciation sentences',()=>{
  assert.equal(writingItems.length,975);
  for(const item of writingItems){
    const p=item.phonetics;assert.ok(p?.parts.length,item.id);
    for(const part of p.parts){assert.ok(part.symbol&&part.ipa&&part.label,item.id);assert.ok(part.features.length>=3,item.id);assert.ok(part.features.every(f=>typeof f==='string'&&f.trim()),item.id);}
    const sentences=p.tip.match(/[.!?](?=\s|$)/g)||[];
    assert.ok(sentences.length>=1&&sentences.length<=2,item.id);assert.ok(p.tip.split(/\s+/).length<=55,item.id);assert.ok(!p.tip.includes('undefined'));
  }
});
test('vowels retain front/back, lip rounding, length and diphthong distinctions',()=>{
  assert.equal(vowelFeatures['ഇ'].backness,'front');assert.equal(vowelFeatures['ഇ'].rounding,'unrounded');
  assert.equal(vowelFeatures['ഉ'].backness,'back');assert.equal(vowelFeatures['ഉ'].rounding,'rounded');
  for(const [short,long] of [['അ','ആ'],['ഇ','ഈ'],['ഉ','ഊ'],['എ','ഏ'],['ഒ','ഓ']]){assert.equal(vowelFeatures[short].length,'short');assert.equal(vowelFeatures[long].length,'long');}
  assert.ok(vowelFeatures['ഐ'].features.includes('diphthong'));assert.equal(vowelFeatures['ഔ'].rounding,'unrounded → rounded');
  assert.equal(vowelFeatures['ഋ'].backness,null,'a learned syllabic rhotic is not assigned an invented vowel tongue position');
  assert.ok(vowelFeatures['ഋ'].features.includes('syllabic rhotic'));assert.match(vowelFeatures['ഋ'].tip,/ri/);
});
test('stop voicing and aspiration are distinct from place and the inherent vowel',()=>{
  const k=consonantFeatures['ക'],kh=consonantFeatures['ഖ'],g=consonantFeatures['ഗ'];
  assert.equal(k.voicing,'voiceless');assert.equal(k.aspiration,'unaspirated');assert.equal(kh.voicing,'voiceless');assert.equal(kh.aspiration,'aspirated');assert.equal(g.voicing,'voiced');
  assert.equal(consonantFeatures['ത'].place,'dental');assert.equal(consonantFeatures['ട'].place,'retroflex');
  assert.equal(consonantFeatures['ഞ'].place,'palatal');assert.equal(consonantFeatures['ച'].manner,'affricate');assert.equal(consonantFeatures['ച'].place,'postalveolar');
  const ka=phoneticsFor('ക');assert.equal(ka.parts[0].voicing,'voiceless');assert.equal(ka.parts[1].voicing,'voiced');assert.equal(ka.ending,'inherent a');
});
test('nasals, laterals, approximants and variable readings are not flattened into stops',()=>{
  assert.equal(consonantFeatures['മ'].manner,'nasal');assert.equal(consonantFeatures['ള'].manner,'lateral approximant');assert.equal(consonantFeatures['ഴ'].manner,'approximant');
  assert.match(consonantFeatures['ഫ'].manner,/fricative/);assert.match(consonantFeatures['ഷ'].place,/postalveolar/);assert.equal(consonantFeatures['ഹ'].voicing,'variable');
  const chillu=phoneticsFor('ൺ');assert.equal(chillu.parts[0].place,'retroflex');assert.equal(chillu.parts[0].manner,'nasal');assert.equal(chillu.parts.length,1);assert.match(chillu.tip,/without an added vowel/);
});
test('mixed clusters, geminates and vowel-marked syllables describe each sound accurately',()=>{
  const nta=phoneticsFor('ന്ത');assert.equal(nta.parts[0].manner,'nasal');assert.equal(nta.parts[0].voicing,'voiced');assert.equal(nta.parts[1].voicing,'voiceless');
  const alveolar=phoneticsFor('റ്റ');assert.equal(alveolar.parts[0].place,'alveolar');assert.equal(alveolar.parts[0].manner,'stop');assert.equal(alveolar.parts[0].voicing,'voiceless');assert.equal(alveolar.parts[0].length,'long');
  assert.ok(!consonantFeatures['ക'].features.includes('long / geminate'),'composing a cluster must not mutate its base profile');
  const kkoo=byId['syll-cj-0-oo'].phonetics;assert.equal(kkoo.parts[0].length,'long');assert.equal(kkoo.parts[1].backness,'back');assert.equal(kkoo.parts[1].rounding,'rounded');assert.equal(kkoo.parts[1].length,'long');
  assert.match(phoneticsFor('ജ്ഞ').tip,/learned/);assert.equal(phoneticsFor('ച്ഛ').parts[0].aspiration,'aspirated');
  assert.equal(phoneticsFor('ക്').parts.length,1);assert.equal(phoneticsFor('ക്').ending,'no inherent vowel');
  assert.equal(byId['home-0'].phonetics,undefined,'a whole word is not assigned a single phonetic feature bundle');
});
test('the sound-reference category is preserved in backups and invalid categories are dropped',()=>{
  const p=emptyProgress();p.ui={route:'phonetics',studyIndex:0,activeScript:'Vowels',wordGroup:'All words',search:'',quiz:null,soundFeatureGroup:'Consonants'};
  const ids=new Set(writingItems.map(i=>i.id));assert.deepEqual(validateProgress(p,ids,new Set()),p);
  p.ui.soundFeatureGroup='arbitrary';assert.equal(validateProgress(p,ids,new Set()).ui.soundFeatureGroup,undefined);
});
