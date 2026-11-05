// Adapted from the two user-provided guides. See docs/CONTENT.md for provenance.
import {enrich} from './linguistics.js';
import {exampleRows,exampleSpellings,soundTopics} from './sounds.js';
export {soundTopics};
const make = (prefix, kind, group, rows) => rows.map(([ml, roman, meaning, ipa, note], i) => ({
  id: `${prefix}-${i}`, kind, group, ml, roman, meaning: meaning || roman, ipa: ipa || '', note: note || ''
}));

export const vowels = make('v', 'letter', 'Vowels', [
  ['അ','a','a','a ~ ɐ','A short, open vowel. Malayalam അ differs from the usual Hindi schwa.'],
  ['ആ','ā','ā','aː','Hold the vowel longer than അ. A macron (ā) marks length.'],
  ['ഇ','i','i','i'], ['ഈ','ī','ī','iː','The long partner of ഇ.'],
  ['ഉ','u','u','u'], ['ഊ','ū','ū','uː','The long partner of ഉ.'],
  ['എ','e','e','e','Short e contrasts with long ഏ.'], ['ഏ','ē','ē','eː'],
  ['ഐ','ai','ai','ai̯'], ['ഒ','o','o','o','Short o contrasts with long ഓ.'],
  ['ഓ','ō','ō','oː'], ['ഔ','au','au','au̯'],
  ['ഋ','ṛ','ṛ','r̩','Often pronounced ri; found especially in Sanskrit-derived words.'],
  ['ൠ','ṝ','ṝ','r̩ː','Rare, learned vowel. Not a priority for a beginner.'],
  ['ഌ','ḷ','ḷ','l̩','Rare, learned vowel.'], ['ൡ','ḹ','ḹ','l̩ː','Rare, learned vowel.']
]);

export const consonants = [
  ...make('vel','letter','Velar', [['ക','ka','','k'],['ഖ','kha','','kʰ'],['ഗ','ga','','ɡ'],['ഘ','gha','','ɡʱ'],['ങ','ṅa','','ŋ']]),
  ...make('pal','letter','Palatal', [['ച','ca','','t͡ʃ'],['ഛ','cha','','t͡ʃʰ'],['ജ','ja','','d͡ʒ'],['ഝ','jha','','d͡ʒʱ'],['ഞ','ña','','ɲ']]),
  ...make('ret','letter','Retroflex', [['ട','ṭa','','ʈ'],['ഠ','ṭha','','ʈʰ'],['ഡ','ḍa','','ɖ'],['ഢ','ḍha','','ɖʱ'],['ണ','ṇa','','ɳ']]),
  ...make('den','letter','Dental', [['ത','ta','','t̪'],['ഥ','tha','','t̪ʰ'],['ദ','da','','d̪'],['ധ','dha','','d̪ʱ'],['ന','na','','n̪ ~ n']]),
  ...make('lab','letter','Labial', [['പ','pa','','p'],['ഫ','pha','','pʰ ~ f','Often /f/ in loanwords.'],['ബ','ba','','b'],['ഭ','bha','','bʱ'],['മ','ma','','m']]),
  ...make('oth','letter','Other consonants', [
    ['യ','ya','','j'],['ര','ra','','r ~ ɾ'],['ല','la','','l'],['വ','va','','ʋ ~ v'],
    ['ശ','śa','','ʃ'],['ഷ','ṣa','','ʂ ~ ʃ'],['സ','sa','','s'],['ഹ','ha','','h'],
    ['ള','ḷa','','ɭ','Retract the tongue tip. Compare with ല.'],
    ['ഴ','ḻa','','ɻ','A retroflex approximant: retract the tongue without a complete closure. Roman zh is an approximation.'],
    ['റ','ṟa','','r̠ ~ ɾ̠','Distinct from ര; doubled റ്റ commonly represents an alveolar long t.']
  ])
];

export const signs = make('sign','sign','Vowel signs', [
  ['ക','ka','','kɐ','ക has an inherent a; no vowel sign is needed.'],
  ['കാ','kā','','kaː','ക + ാ → കാ'], ['കി','ki','','ki','ക + ി → കി'],
  ['കീ','kī','','kiː','ക + ീ → കീ'], ['കു','ku','','ku','ക + ു → കു'],
  ['കൂ','kū','','kuː','ക + ൂ → കൂ'], ['കൃ','kṛ','','kr̩','ക + ൃ → കൃ'],
  ['കെ','ke','','ke','െ appears to the left but is pronounced after the consonant.'],
  ['കേ','kē','','keː','േ appears to the left but is pronounced after the consonant.'],
  ['കൈ','kai','','kai̯','ക + ൈ → കൈ'], ['കൊ','ko','','ko','ൊ occupies both sides of the consonant.'],
  ['കോ','kō','','koː','ോ occupies both sides of the consonant.'], ['കൗ','kau','','kau̯','ക + ൗ → കൗ'],
  ['ക്','k','','k','Chandrakala (്) suppresses the inherent vowel. In some word-final contexts, pronunciation includes a reduced vowel.']
]);
export const chillus = make('ch','chillu','Chillus', [
  ['ൺ','ṇ','','ɳ','Related base: ണ'], ['ൻ','n','','n','Related base: ന'], ['ർ','r','','r','Related base: ര'],
  ['ൽ','l','','l','Related base: ല'], ['ൾ','ḷ','','ɭ','Related base: ള'], ['ൿ','k','','k','Related base: ക']
]);
export const conjuncts = make('cj','conjunct','Conjuncts', [
  ['ക്ക','kka','','kː','ക് + ക; hold the consonant longer.'], ['പ്പ','ppa','','pː','പ് + പ'],
  ['ട്ട','ṭṭa','','ʈː','ട് + ട'], ['ത്ത','tta','','t̪ː','ത് + ത'], ['ന്ത','nta','','n̪t̪','ന് + ത'],
  ['മ്പ','mpa','','mp','മ് + പ'], ['ങ്ക','ṅka','','ŋk','ങ് + ക'], ['ഞ്ച','ñca','','ɲt͡ʃ','ഞ് + ച'],
  ['ണ്ട','ṇṭa','','ɳʈ','ണ് + ട'], ['ക്ഷ','kṣa','','kʂ ~ kʃ','ക് + ഷ'],
  ['ജ്ഞ','jña','','ɲ ~ d͡ʒɲ','ജ് + ഞ; pronunciation varies by word and register.'], ['റ്റ','ṯṯa','','tː','റ് + റ; usually an alveolar long t.'],
  ['മ്മ','mma','','mː','മ് + മ'],['ന്ന','nna','','nː','ന് + ന'],['ണ്ണ','ṇṇa','','ɳː','ണ് + ണ'],
  ['ങ്ങ','ṅṅa','','ŋː','ങ് + ങ'],['ഞ്ഞ','ñña','','ɲː','ഞ് + ഞ'],['ച്ച','cca','','t͡ʃː','ച് + ച'],
  ['ല്ല','lla','','lː','ല് + ല'],['ള്ള','ḷḷa','','ɭː','ള് + ള'],['ച്ഛ','ccha','','t͡ʃʰː','ച് + ഛ; pronunciation varies by word.'],
  ['ക്ര','kra','','kr','ക് + ര'],['ഗ്ര','gra','','ɡr','ഗ് + ര'],['ത്ര','tra','','t̪r','ത് + ര'],
  ['ദ്ര','dra','','d̪r','ദ് + ര'],['പ്ര','pra','','pr','പ് + ര'],['ബ്ര','bra','','br','ബ് + ര'],
  ['ശ്ര','śra','','ʃr','ശ് + ര'],['ക്ത','kta','','kt̪','ക് + ത'],['സ്ത','sta','','st̪','സ് + ത'],
  ['സ്ക','ska','','sk','സ് + ക'],['സ്പ','spa','','sp','സ് + പ']
]);

export const words = [
  ...make('home','word','Home & people', [
    ['ആൾ','āḷ','person'],['കുട്ടി','kuṭṭi','child'],['അമ്മ','amma','mother'],['അച്ഛൻ','acchan','father'],
    ['വീട്','vīṭŭ','house'],['മുറി','muṟi','room'],['വാതിൽ','vātil','door'],['താക്കോൽ','tākkōl','key'],
    ['പുസ്തകം','pustakaṃ','book'],['പേര്','pērŭ','name'],['വിലാസം','vilāsaṃ','address'],['സമയം','samayaṃ','time']
  ]),
  ...make('food','word','Food & shopping', [
    ['വെള്ളം','veḷḷaṃ','water'],['ചായ','cāya','tea'],['കാപ്പി','kāppi','coffee'],['ഭക്ഷണം','bhakṣaṇaṃ','food'],
    ['ചോറ്','cōṟŭ','cooked rice'],['അരി','ari','uncooked rice'],['പാൽ','pāl','milk'],['പച്ചക്കറി','paccakkaṟi','vegetables'],
    ['പഴം','paḻaṃ','fruit / banana'],['മീൻ','mīn','fish'],['കട','kaṭa','shop'],['വില','vila','price'],['പണം','paṇaṃ','money']
  ]),
  ...make('travel','word','Getting around', [
    ['ബസ്','bas','bus'],['വഴി','vaḻi','way / road'],['റോഡ്','rōḍ','road'],['സ്ഥലം','sthalaṃ','place'],
    ['നഗരം','nagaraṃ','town / city'],['ഗ്രാമം','grāmaṃ','village'],['ടിക്കറ്റ്','ṭikkaṯṯŭ','ticket'],['വണ്ടി','vaṇṭi','vehicle'],
    ['പ്രവേശനം','pravēśanaṃ','entrance'],['പുറത്ത്','puṟattŭ','outside']
  ]),
  ...make('health','word','Health & services', [
    ['ആശുപത്രി','āśupatri','hospital'],['ഡോക്ടർ','ḍōkṭar','doctor'],['മരുന്ന്','marunnŭ','medicine'],
    ['വേദന','vēdana','pain'],['പനി','pani','fever'],['ഓഫീസ്','ōphīs','office'],['അപേക്ഷ','apēkṣa','application'],
    ['ഒപ്പ്','oppŭ','signature'],['തീയതി','tīyati','date'],['നമ്പർ','nampar','number']
  ]),
  ...make('verb','word','Useful verbs', [
    ['വരുക','varuka','come'],['പോകുക','pōkuka','go'],['ചെയ്യുക','ceyyuka','do'],['കാണുക','kāṇuka','see'],
    ['പറയുക','paṟayuka','say / tell'],['കേൾക്കുക','kēḷkkuka','hear / listen'],['വായിക്കുക','vāyikkuka','read'],
    ['എഴുതുക','eḻutuka','write'],['കഴിക്കുക','kaḻikkuka','eat'],['കുടിക്കുക','kuṭikkuka','drink']
  ]),
  ...make('fn','word','Little words', [
    ['ഞാൻ','ñān','I'],['നിങ്ങൾ','niṅṅaḷ','you (polite / plural)'],['ഇത്','itŭ','this'],['അത്','atŭ','that'],
    ['ഇവിടെ','iviṭe','here'],['അവിടെ','aviṭe','there'],['എവിടെ','eviṭe','where'],['എത്ര','etra','how much / many'],
    ['ഇല്ല','illa','not present / no'],['അല്ല','alla','is not'],['വേണം','vēṇaṃ','need / want']
  ])
];

export const phrases = make('phrase','phrase','Everyday phrases', [
  ['ഇത് എന്റെ വീടാണ്.','itŭ ente vīṭāṇŭ.','This is my house.','','എന്റെ = my; ആണ് = is.'],
  ['എനിക്ക് വെള്ളം വേണം.','enikkŭ veḷḷaṃ vēṇaṃ.','I need water.','','എനിക്ക് means “to me”: literally, water is needed to me.'],
  ['ബസ് എവിടെയാണ്?','bas eviṭeyāṇŭ?','Where is the bus?','','എവിടെ = where; ആണ് = is.'],
  ['ടിക്കറ്റ് എത്രയാണ്?','ṭikkaṯṯŭ etrayāṇŭ?','How much is the ticket?','','എത്ര = how much.'],
  ['ദയവായി പതുക്കെ പറയൂ.','dayavāyi patukke paṟayū.','Please speak slowly.','','പതുക്കെ = slowly; പറയൂ = say / tell.'],
  ['എനിക്ക് പനിയുണ്ട്.','enikkŭ paniyuṇṭŭ.','I have a fever.','','Literally: fever exists to me.'],
  ['ഞാൻ നാളെ വരും.','ñān nāḷe varum.','I will come tomorrow.','','നാളെ = tomorrow; വരും = will come.'],
  ['ദയവായി കാത്തിരിക്കുക.','dayavāyi kāttirikkuka.','Please wait.','','ദയവായി makes the instruction polite.'],
  ['പ്രവേശനമില്ല','pravēśanamilla','No entry','','ഇല്ല expresses absence or negation.'],
  ['ആശുപത്രി എവിടെയാണ്?','āśupatri eviṭeyāṇŭ?','Where is the hospital?','','Replace ബസ് in the same question pattern with ആശുപത്രി.']
]);

export const grammar = [
  {title:'Start with the verb at the end', body:'A useful default order is subject–object–verb. Finite verbs generally do not change for person, number, or gender.', ml:'അവൾ പുസ്തകം വായിക്കുന്നു.', roman:'avaḷ pustakaṃ vāyikkunnu.', meaning:'She reads / is reading a book.', note:'അവൾ (she) + പുസ്തകം (book) + വായിക്കുന്നു (reads). “Present” forms can express habitual or ongoing action.'},
  {title:'A little ending, a new meaning', body:'Malayalam attaches endings to nouns. The stem can change too: വീട് becomes വീട്ടിൽ. Learn the whole form rather than attaching endings mechanically.', ml:'വീട്ടിൽ', roman:'vīṭṭil', meaning:'in / at the house', note:'-ഇൽ expresses location. Compare കുട്ടിയുടെ (of the child) and കുട്ടികൾ (children).'},
  {title:'Say what you need', body:'A common way to express a need uses എനിക്ക് (“to me”), the thing needed, and വേണം (“need / want”).', ml:'എനിക്ക് വെള്ളം വേണം.', roman:'enikkŭ veḷḷaṃ vēṇaṃ.', meaning:'I need water.', note:'The person experiencing the need is in the dative form: ഞാൻ → എനിക്ക്.'},
  {title:'Go, went, will go', body:'Verb forms are often specific to the stem. For പോകുക (to go), compare പോകുന്നു (goes), പോയി (went), and പോകും (will go).', ml:'പോയില്ല', roman:'pōyilla', meaning:'did not go', note:'Past negation: പോയി → പോയില്ല. Prohibition: പോകരുത് (do not go).'},
  {title:'Ask where and how much', body:'എവിടെ asks “where”; എത്ര asks “how much / many”. You will often see these combined with ആണ് (is).', ml:'ടിക്കറ്റ് എത്രയാണ്?', roman:'ṭikkaṯṯŭ etrayāṇŭ?', meaning:'How much is the ticket?', note:'The question ending -ഓ also appears in forms such as പോകുമോ? (will [it / someone] go?).'},
  {title:'Two ways to say “not”', body:'ഇല്ല expresses absence or nonexistence. അല്ല negates an identity or nominal statement. They are not freely interchangeable.', ml:'വീട്ടിൽ വെള്ളമുണ്ട്.', roman:'vīṭṭil veḷḷamuṇṭŭ.', meaning:'There is water in the house.', note:'ഉണ്ട് = exists; ഇല്ല = does not exist. ആണ് = is; അല്ല = is not.'}
];

export const lessons = [
  {id:'first-vowels', title:'Your first vowels', subtitle:'Meet അ, ആ, ഇ, ഈ, ഉ, ഊ', tag:'Writing system', icon:'അ', items:vowels.slice(0,6), note:'Read left to right. Compare each short vowel with its long partner. The line over a Roman vowel (ā, ī, ū) means “hold it longer”.'},
  {id:'more-vowels', title:'A few more sounds', subtitle:'Short, long, and two-vowel sounds', tag:'Writing system', icon:'ഏ', items:vowels.slice(6,12), note:'എ / ഏ and ഒ / ഓ differ in length. ഐ and ഔ are diphthongs. Roman spellings are learning aids, not English pronunciation.'},
  {id:'consonants', title:'Build with consonants', subtitle:'A first set of everyday letters', tag:'Writing system', icon:'ക', items:[consonants[0],consonants[5],consonants[10],consonants[15],consonants[20],consonants[24]], note:'A consonant letter normally includes an inherent a. ക is ka, not just k. Dental ത uses the upper teeth; retroflex ട uses a retracted tongue tip.'},
  {id:'vowel-signs', title:'Change a vowel', subtitle:'From ക to കാ, കി, and beyond', tag:'Writing system', icon:'കാ', items:signs.slice(0,6), note:'Independent vowels stand on their own. Inside a syllable, a vowel sign modifies a consonant. Explore the full set in the script reference.'},
  {id:'endings', title:'Consonants that stand alone', subtitle:'Meet the chillu letters', tag:'Writing system', icon:'ൻ', items:chillus, note:'Chillus are consonants without an inherent vowel. Compare ന (na) with ൻ (n). Shapes can differ across older and newer fonts.'},
  {id:'food', title:'At the tea shop', subtitle:'Water, tea, coffee, and a little more', tag:'Everyday words', icon:'ചാ', items:words.filter(w=>w.group==='Food & shopping').slice(0,7), note:'Notice doubled consonants in വെള്ളം and കാപ്പി. Consonant length matters. Try reading the Malayalam before looking at the Roman spelling.'},
  {id:'home', title:'People & places', subtitle:'A few words close to home', tag:'Everyday words', icon:'വീ', items:words.filter(w=>w.group==='Home & people').slice(0,6), note:'The final ŭ in transliteration is a pronunciation aid for a reduced vowel. Natural pronunciation depends on the word and dialect.'},
  {id:'around', title:'Find your way', subtitle:'Recognize words on signs and buses', tag:'Everyday words', icon:'ബ', items:words.filter(w=>w.group==='Getting around').slice(0,8), note:'Start noticing familiar letters in whole words. Bus, ticket, entrance: a little reading goes a long way.'},
  {id:'phrases', title:'Your first conversations', subtitle:'Ask, explain, and find what you need', tag:'Useful phrases', icon:'എ', items:phrases.slice(0,5), note:'Read these as reusable patterns. The grammar page explains “I need…”, “Where is…?”, and why endings change.'},
  {id:'help', title:'A little help, please', subtitle:'Health, directions, and polite requests', tag:'Useful phrases', icon:'മ', items:phrases.slice(5), note:'The guides use practical standard Malayalam. Speech and register vary. These examples are for language practice.'}
];

export const scriptItems = [...vowels,...consonants,...signs,...chillus,...conjuncts];
// Complete practice forms for the existing consonants/conjuncts. These are
// constructed sound units, not 672 new vocabulary words or mandatory lessons.
export const syllableBases=[...consonants,...conjuncts];
export const syllablePatterns=[
  ['a','','a','ɐ'],['aa','ാ','ā','aː'],['i','ി','i','i'],['ii','ീ','ī','iː'],
  ['u','ു','u','u'],['uu','ൂ','ū','uː'],['r','ൃ','ṛ','r̩'],['e','െ','e','e'],
  ['ee','േ','ē','eː'],['ai','ൈ','ai','ai̯'],['o','ൊ','o','o'],['oo','ോ','ō','oː'],
  ['au','ൗ','au','au̯'],['no-vowel','്','','']
].map(([id,sign,roman,ipa])=>({id,sign,roman,ipa,label:id==='no-vowel'?'No vowel · chandrakala':`${roman}${id==='a'?' · inherent vowel':id==='r'?' · learned vocalic vowel':''}`}));
const knownForms=new Map([...consonants,...conjuncts,...signs].map(i=>[i.ml.normalize('NFC'),i]));
export const syllables=[];
export const syllableForms=syllableBases.flatMap(base=>syllablePatterns.map(pattern=>{
  const spelling=(base.ml+pattern.sign).normalize('NFC');
  let item=pattern.id==='a'?base:knownForms.get(spelling);
  if(!item){
    const roman=base.roman.replace(/a$/,'')+pattern.roman;
    item={id:`syll-${base.id}-${pattern.id}`,kind:'syllable',group:base.kind==='conjunct'?'Conjunct syllables':'Consonant syllables',ml:spelling,roman,meaning:roman,
      ipa:base.ipa.split(/\s*~\s*/).map(sound=>sound+pattern.ipa).join(' ~ '),
      note:`${base.ml} (${base.roman}) + ${pattern.sign||'inherent a'} → ${spelling}. Constructed writing practice; this sound unit is not necessarily a word.${pattern.id==='r'?' Vocalic ṛ is learned/Sanskritic and uncommon with many bases.':''}`};
    knownForms.set(spelling,item);syllables.push(item);
  }
  return {baseId:base.id,patternId:pattern.id,itemId:item.id};
}));
export const writingItems=[...scriptItems,...syllables];
export const exampleWords=[...make('ex','word','Sound examples',exampleRows),...make('cx','word','Conjunct examples',[
  ['കണ്ണ്','kaṇṇŭ','eye'],['മഞ്ഞ','mañña','yellow'],['അങ്ങാടി','aṅṅāṭi','market'],['നല്ല','nalla','good'],
  ['കള്ളം','kaḷḷaṃ','lie'],['ക്രിയ','kriya','action'],['ദ്രാവകം','drāvakaṃ','liquid'],['ബ്രഷ്','braṣŭ','brush'],
  ['ശ്രദ്ധ','śraddha','attention'],['വ്യക്തി','vyakti','person'],['സ്കൂൾ','skūḷ','school'],['സ്പർശം','sparśaṃ','touch']
])];
const lexical=[...words,...phrases,...exampleWords];
const lookup=Object.fromEntries(lexical.map(i=>[i.ml,i]));
for(const [group,items] of Object.entries({Vowels:vowels,Consonants:consonants,'Vowel signs':signs,Chillus:chillus,Conjuncts:conjuncts})) {
  items.forEach((item,i)=>{
    const spelling=exampleSpellings[group][i]||(group==='Conjuncts'?lexical.find(w=>w.kind==='word'&&w.ml.includes(item.ml))?.ml:undefined);
    item.example=spelling?{type:'word',itemId:lookup[spelling].id}:{type:'teaching',ml:item.ml,roman:item.roman,meaning:'Rare symbol: no everyday example in this course.',note:item.ml==='ൿ'?'Compare the equivalent ക് in വാക്ക് (vākkŭ, word). Rare ൿ is not the ordinary spelling in that word.':'This learned vocalic symbol is included for recognition. Practise its shape; do not treat it as an everyday Malayalam word.'};
  });
}
for(const item of syllables){
  const example=lexical.find(word=>word.kind==='word'&&word.ml.normalize('NFC').includes(item.ml));
  item.example=example?{type:'word',itemId:example.id}:{type:'teaching',ml:item.ml,roman:item.roman,meaning:'Constructed syllable practice',note:'No example word is supplied for this combination. Practise it as a sound unit; not every constructed combination is common in Malayalam.'};
}
const grammarAnswers=[
 ['What is a useful default word order?','Subject–object–verb',['Subject–object–verb','Verb–subject–object','Object–verb–subject','No word order patterns']],
 ['What does -ഇൽ express in വീട്ടിൽ?','Location',['Location','Plural','Future tense','Negation']],
 ['What does എനിക്ക് mean in this construction?','To / for me',['To / for me','My house','You (polite)','Yesterday']],
 ['What does the negative part in പോയില്ല express?','Did not go',['Did not go','Will go','Must go','Is going']],
 ['What does എത്ര ask about?','How much / many',['How much / many','Who','When','Why']],
 ['What does ഉണ്ട് express?','Existence / presence',['Existence / presence','Nominal negation','Plurality','Prohibition']]
];
export const grammarItems=grammar.map((g,i)=>({id:`grammar-${i}`,kind:'grammar',section:'grammar',group:'Grammar patterns',...g,question:grammarAnswers[i][0],answer:grammarAnswers[i][1],options:grammarAnswers[i][2]}));
export const phoneticsItems=soundTopics.map(t=>({id:`sound-${t.id}`,kind:'phonetics',section:'phonetics',group:'Sounds of Malayalam',...lookup[t.target],id:`sound-${t.id}`,kind:'phonetics',section:'phonetics',question:t.question,answer:t.answer,options:t.options,note:t.body}));
export const allItems = [...writingItems,...lexical,...grammarItems,...phoneticsItems].map(enrich);
export const byId = Object.fromEntries(allItems.map(item=>[item.id,item]));
export const sections=[{id:'script',title:'Writing system'},{id:'phonetics',title:'Sounds of Malayalam'},{id:'words',title:'Words'},{id:'phrases',title:'Phrases'},{id:'grammar',title:'Grammar'}];
