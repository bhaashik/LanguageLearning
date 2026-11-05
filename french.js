import {constructionCourse,frenchDevanagari,parseGloss} from './course-content.js';
// Curated starter vocabulary, with broad IPA rather than spelling-to-IPA guesses.
const rows=[
['ami','friend (masculine)','a.mi'],['bonjour','hello / good day','bɔ̃.ʒuʁ'],['café','coffee / café (masculine)','ka.fe'],['demain','tomorrow','də.mɛ̃'],['école','school (feminine)','e.kɔl'],['famille','family (feminine)','fa.mij'],['gare','station (feminine)','ɡaʁ'],['hôpital','hospital (masculine)','o.pi.tal'],['ici','here','i.si'],['jour','day (masculine)','ʒuʁ'],['kilo','kilogram (masculine)','ki.lo'],['livre','book (masculine)','livʁ'],['maison','house (feminine)','mɛ.zɔ̃'],['non','no','nɔ̃'],['oui','yes','wi'],['porte','door (feminine)','pɔʁt'],['quatre','four','katʁ'],['rue','street (feminine)','ʁy'],['sac','bag (masculine)','sak'],['table','table (feminine)','tabl'],['une','a / one (feminine)','yn'],['ville','town / city (feminine)','vil'],['wagon','railway carriage (masculine)','va.ɡɔ̃'],['taxi','taxi (masculine)','ta.ksi'],['yoga','yoga (masculine)','jɔ.ɡa'],['zéro','zero','ze.ʁo'],
['là','there','la'],['âge','age (masculine)','ɑʒ'],['mère','mother','mɛʁ'],['fête','party (feminine)','fɛt'],['Noël','Christmas','nɔ.ɛl'],['île','island (feminine)','il'],['maïs','maize (masculine)','ma.is'],['hôtel','hotel (masculine)','o.tɛl'],['où','where','u'],['sûr','sure (masculine)','syʁ'],['aigüe','high-pitched (feminine; reformed spelling)','e.ɡy'],['ça','that / it (informal)','sa'],['cœur','heart (masculine)','kœʁ'],
['eau','water (feminine)','o'],['pain','bread (masculine)','pɛ̃'],['vin','wine (masculine)','vɛ̃'],['beau','beautiful (masculine)','bo'],['petit','small (masculine)','pə.ti'],['petite','small (feminine)','pə.tit'],['grand','big / tall (masculine)','ɡʁɑ̃'],['grande','big / tall (feminine)','ɡʁɑ̃d'],['voiture','car (feminine)','vwa.tyʁ'],['enfant','child','ɑ̃.fɑ̃'],['merci','thank you','mɛʁ.si'],['s’il vous plaît','please (polite/plural)','sil vu plɛ'],['je','I','ʒə'],['tu','you (familiar singular)','ty'],['il','he / it','il'],['elle','she / it','ɛl'],['nous','we','nu'],['vous','you (polite/plural)','vu'],['ils','they (masculine/mixed)','il'],['elles','they (feminine)','ɛl'],['avec','with','a.vɛk'],['sans','without','sɑ̃'],['pour','for','puʁ'],['mais','but','mɛ'],['parce que','because','paʁs kə'],['aujourd’hui','today','o.ʒuʁ.dɥi'],['hier','yesterday','jɛʁ'],['parler','to speak','paʁ.le'],['aller','to go','a.le'],['venir','to come','və.niʁ'],['lire','to read','liʁ'],['manger','to eat','mɑ̃.ʒe'],['boire','to drink','bwaʁ'],['faire','to do / make','fɛʁ'],['être','to be','ɛtʁ'],['avoir','to have','a.vwaʁ'],['mot','word (masculine)','mo']
];
function enrich(item){
  item.language='fr';item.devanagari=frenchDevanagari(item.ipa);item.ipaType='broad standard-French teaching pronunciation';
  item.gloss||=[{ml:item.ml,roman:item.roman,gloss:item.meaning.replaceAll(' ','.')}];
  item.glossType=['letter','sign'].includes(item.kind)?'sound unit (not a morpheme)':'simplified morpheme gloss';return item;
}
export const words=rows.map(([ml,meaning,ipa],n)=>enrich({id:`fr-word-${n}`,kind:'word',section:'words',group:meaning.startsWith('to ')?'Verbs':['je','tu','il','elle','nous','vous','ils','elles','avec','sans','pour','mais','parce que','une','oui','non','où','ici','là'].includes(ml)?'Function words':'Everyday words',ml,roman:ml,meaning,ipa,note:''}));
const word=text=>words.find(w=>w.ml===text);
const letterRows=[
['A','a','a','ami','a',['open','front','unrounded'],'Open the mouth for /a/; keep it short and steady.'],
['B','bé','be','bonjour','b',['bilabial','voiced','stop'],'Close both lips, then release with voice.'],
['C','cé','se','café','k / s',['velar / alveolar','voiceless','stop / fricative'],'C is usually /k/ before a, o, u, and /s/ before e, i, y.'],
['D','dé','de','demain','d',['dental/alveolar','voiced','stop'],'Touch the tongue near the upper teeth, then release with voice.'],
['E','e','ə','école','ə / e / ɛ',['central / front','unrounded','context-dependent vowel'],'E can be schwa, /e/, /ɛ/, or silent; learn the word and its accent marks.'],
['F','effe','ɛf','famille','f',['labiodental','voiceless','fricative'],'Let air pass between the upper teeth and lower lip, without voice.'],
['G','gé','ʒe','gare','ɡ / ʒ',['velar / postalveolar','voiced','stop / fricative'],'G is usually /ɡ/ before a, o, u, and /ʒ/ before e, i, y.'],
['H','hache','aʃ','hôpital','silent',['silent grapheme','h muet / h aspiré','word-dependent joining'],'H is silent; h muet allows elision/liaison, while h aspiré blocks them.'],
['I','i','i','ici','i',['close','front','unrounded'],'Raise the front of the tongue; keep the lips unrounded.'],
['J','ji','ʒi','jour','ʒ',['postalveolar','voiced','fricative'],'Use the voiced sound in English vision, without an initial stop.'],
['K','ka','ka','kilo','k',['velar','voiceless','stop'],'Close the back of the tongue against the soft palate, then release.'],
['L','elle','ɛl','livre','l',['alveolar','voiced','lateral approximant'],'Touch the tongue tip near the upper teeth and let air pass around its sides.'],
['M','emme','ɛm','maison','m',['bilabial','voiced','nasal'],'Close the lips and let voiced air leave through the nose.'],
['N','enne','ɛn','non','n',['alveolar','voiced','nasal'],'Touch the tongue near the upper teeth with nasal airflow; n can also mark a preceding nasal vowel.'],
['O','o','o','mot','o / ɔ',['back','rounded','close-mid / open-mid'],'Round the lips; compare close /o/ with the more open /ɔ/.'],
['P','pé','pe','porte','p',['bilabial','voiceless','stop'],'Close both lips and release without a strong English-style puff.'],
['Q','cu','ky','quatre','k',['velar','voiceless','stop'],'Qu normally sounds /k/; its u is usually not a separate vowel.'],
['R','erre','ɛʁ','rue','ʁ',['uvular','voiced','fricative / approximant'],'Use the back of the tongue near the uvula, rather than an English r.'],
['S','esse','ɛs','sac','s / z',['alveolar','voiceless / voiced','fricative'],'Single s between vowels is often /z/; ss usually keeps /s/.'],
['T','té','te','table','t',['dental/alveolar','voiceless','stop'],'Touch near the upper teeth and release; final t is often silent.'],
['U','u','y','une','y',['close','front','rounded'],'Hold an /i/-like tongue position and round the lips; ou instead represents /u/.'],
['V','vé','ve','ville','v',['labiodental','voiced','fricative'],'Touch the lower lip lightly with the upper teeth and add voice.'],
['W','double vé','dublə ve','wagon','v / w',['labiodental / labiovelar','voiced','loanword-dependent'],'W can be /v/ as in wagon or /w/ as in week-end.'],
['X','ixe','iks','taxi','ks',['velar then alveolar','voiceless','consonant sequence'],'X often represents /ks/ inside words; some words use /ɡz/ or a silent x.'],
['Y','i grec','i ɡʁɛk','yoga','i / j',['front / palatal','voiced','vowel / glide'],'Y can act like /i/ or the glide /j/; learn it in a word.'],
['Z','zède','zɛd','zéro','z',['alveolar','voiced','fricative'],'Make an /s/-like airflow while vibrating the vocal folds.']
];
const makeSymbol=([ml,roman,ipa,example,sound,features,tip],n,kind='letter')=>enrich({id:`fr-${kind}-${n}`,kind,section:'script',group:kind==='sign'?'Accents & ligatures':'AEIOUY'.includes(ml)?'Vowels':'Consonants',ml,roman,meaning:roman,ipa,note:kind==='letter'?`French letter name /${ipa}/. Common sound: ${sound}.`:'The IPA describes a common sound in the example; an accent is not a separate alphabet letter.',example:{type:'word',itemId:word(example).id},phonetics:{parts:[{label:'Common sound',symbol:ml,ipa:sound,features}],tip}});
const alphabet=letterRows.map((row,n)=>makeSymbol(row,n));
export const vowels=alphabet.filter(i=>i.group==='Vowels'),consonants=alphabet.filter(i=>i.group==='Consonants');
const accents=[
['à','a grave','a','là','a',['open','front','unrounded'],'The grave accent often distinguishes words; à still has an /a/ sound.'],
['â','a circonflexe','ɑ','âge','ɑ ~ a',['open','back / front','unrounded'],'Some speakers distinguish /ɑ/ from /a/; many merge them.'],
['é','e aigu','e','école','e',['close-mid','front','unrounded'],'Keep a steady /e/, without turning it into English ay.'],
['è','e grave','ɛ','mère','ɛ',['open-mid','front','unrounded'],'Open the mouth more than for é.'],
['ê','e circonflexe','ɛ','fête','ɛ',['open-mid','front','unrounded'],'In fête, ê is /ɛ/; a circumflex does not have one universal sound.'],
['ë','e tréma','ɛ','Noël','ɛ',['open-mid','front','unrounded'],'The diaeresis separates a vowel from its neighbor; Noël has two syllables.'],
['î','i circonflexe','i','île','i',['close','front','unrounded'],'Pronounce /i/; the circumflex often records a spelling distinction.'],
['ï','i tréma','i','maïs','i',['close','front','unrounded'],'Keep a separate /i/ in maïs; do not read ai as one vowel here.'],
['ô','o circonflexe','o','hôtel','o',['close-mid','back','rounded'],'Round the lips for a close /o/, without an English-style glide.'],
['ù','u grave','u','où','u',['close','back','rounded'],'In où, the whole ou spelling represents /u/; the accent distinguishes where from or.'],
['û','u circonflexe','y','sûr','y',['close','front','rounded'],'Keep the tongue near /i/ while rounding the lips.'],
['ü','u tréma','y','aigüe','y',['close','front','rounded'],'Aigüe is a reformed spelling of traditional aiguë; the diaeresis makes the u audible.'],
['ç','c cédille','s','ça','s',['alveolar','voiceless','fricative'],'The cedilla keeps c soft /s/ before a, o, or u.'],
['œ','o-e liés','œ','cœur','œ',['open-mid','front','rounded'],'In cœur, use a front vowel with rounded lips; œ has other values in other words.']
];
export const signs=accents.map((row,n)=>makeSymbol(row,n,'sign'));
for(const [ml,roman,ipa,note] of [['ÿ','y tréma','i','Rare in proper names, for example L’Haÿ-les-Roses; not an everyday priority.'],['æ','a-e liés','e','Rare learned ligature, for example ex æquo (equal placing); not a productive everyday spelling.']])signs.push(enrich({id:`fr-sign-${signs.length}`,kind:'sign',section:'script',group:'Accents & ligatures',ml,roman,meaning:roman,ipa,note,example:{type:'teaching',ml,roman,meaning:'Rare spelling example',note},phonetics:{parts:[{label:'Example sound',symbol:ml,ipa,features:[ipa==='i'?'close':'close-mid','front','unrounded']}],tip:'Learn this rare spelling in its particular name or expression.'}}));
export const scriptItems=[...alphabet,...signs];
const course=constructionCourse('fr');export const units=course.units,constructionItems=course.items;
export const phrases=course.items.filter((_,n)=>[0,4,13,17,18,20,24,26].includes(n)).map((i,n)=>({...i,id:`fr-phrase-${n}`,kind:'phrase',section:'phrases',group:'Everyday phrases',question:undefined,answer:undefined,options:undefined}));
export const grammarItems=course.units.slice(0,6).map((u,n)=>({...u.items[0],id:`fr-grammar-${n}`,kind:'grammar',section:'grammar',title:u.title,body:u.rule,group:'Grammar patterns'}));
export const soundTopics=[
{id:'rounded',title:'U and ou are different',body:'French u /y/ is front and rounded; ou /u/ is back and rounded. Keep the tongue position distinct.',examples:['une','où'],question:'Which sound is the usual French u?',answer:'/y/: front and rounded',options:['/y/: front and rounded','/u/: always back','A silent letter in every word','An English-style diphthong']},
{id:'nasals',title:'Nasal vowels',body:'Air passes through mouth and nose for /ɑ̃ ɛ̃ ɔ̃ œ̃/. A following n or m often marks nasalization rather than a separate consonant; regional mergers occur.',examples:['vin','non'],question:'What happens in the vowel of vin?',answer:'Nasal airflow accompanies the vowel',options:['Nasal airflow accompanies the vowel','Always add a final pronounced n','The vowel must be voiced twice','It becomes a consonant']},
{id:'mid',title:'Close and open mid vowels',body:'É often represents close-mid /e/; è and ê often represent open-mid /ɛ/. These are steady vowels, with regional variation in some contrasts.',examples:['école','mère'],question:'How do /e/ and /ɛ/ differ?',answer:'/ɛ/ is more open than /e/',options:['/ɛ/ is more open than /e/','Only /e/ is voiced','Both are always nasal','/e/ is a stop consonant']},
{id:'liaison',title:'Link selected words',body:'Liaison can pronounce an otherwise silent final consonant before a vowel, for example les enfants /le.z‿ɑ̃.fɑ̃/. It depends on grammar and register; do not add a consonant at every word boundary.',examples:['enfant','ami'],question:'What is liaison?',answer:'A final consonant may be pronounced before a vowel',options:['A final consonant may be pronounced before a vowel','Every final consonant is always pronounced','An obligatory glottal stop between all words','A written accent on an adjective']},
{id:'endings',title:'Written endings can be silent',body:'Parle, parles, and parlent commonly sound alike. Written grammar practice checks distinctions that ASR cannot hear. Petite has an audible /t/ that petit normally lacks.',examples:['petit','petite'],question:'Can ASR alone verify silent -s or -ent agreement?',answer:'No; written practice is also needed',options:['No; written practice is also needed','Yes, every written ending is audible','Only if the microphone is louder','Only by adding an English vowel']},
{id:'r',title:'French r and voiced fricatives',body:'A common French r /ʁ/ uses the back of the tongue near the uvula. /ʒ/ in jour is voiced; avoid replacing it with English /dʒ/.',examples:['rue','jour'],question:'Where is common French /ʁ/ made?',answer:'Near the uvula, at the back of the mouth',options:['Near the uvula, at the back of the mouth','Only between both lips','Only with a tongue-tip English r','With the vocal folds completely closed']}
];
export const phoneticsItems=soundTopics.map(t=>({...word(t.examples[0]),id:`fr-sound-${t.id}`,kind:'phonetics',section:'phonetics',group:'Sounds of French',question:t.question,answer:t.answer,options:t.options,note:t.body}));
const starterLessons=[
['vowels','Start with French vowels',vowels,'Read the letter names, then compare the example-word sounds.'],
['consonants','Meet the consonants',consonants.slice(0,8),'Letter names and sounds are different; learn each letter in a word.'],
['accents','Accents change the reading',signs.slice(0,6),'Start with common accent marks before the rare ligatures.'],
['everyday','Everyday words',words.filter(w=>['bonjour','merci','maison','gare','eau','pain','oui','non'].includes(w.ml)),'A few words you can use immediately.'],
['people','People and little words',words.filter(w=>['je','tu','elle','nous','vous','avec','sans','pour'].includes(w.ml)),'Function words help build whole sentences.'],
['phrases','Your first French phrases',phrases,'Listen, understand the gloss, and then try speaking the whole phrase.']
];
export const lessons=[...starterLessons.map(([id,title,items,note])=>({id:`fr-start-${id}`,title,subtitle:note,items,note,tag:'French foundations',icon:'Aa'})),...course.lessons];
export const allItems=[...scriptItems,...words,...phrases,...grammarItems,...phoneticsItems,...course.items],byId=Object.fromEntries(allItems.map(i=>[i.id,i]));
export const sections=[{id:'script',title:'Writing system'},{id:'phonetics',title:'Sounds of French'},{id:'words',title:'Words'},{id:'phrases',title:'Phrases'},{id:'grammar',title:'Grammar'},{id:'constructions',title:'Useful constructions'}];
export const writingItems=[],chillus=[],conjuncts=[],syllableBases=[],syllablePatterns=[],syllableForms=[];
