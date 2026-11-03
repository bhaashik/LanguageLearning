// Comparative script correspondence, not a claim that Hindi has all Malayalam sounds.
const mlChars='അആഇഈഉഊഋൠഌൡഎഏഐഒഓഔകഖഗഘങചഛജഝഞടഠഡഢണതഥദധനപഫബഭമയരറലളഴവശഷസഹ';
const dvChars=['अ','आ','इ','ई','उ','ऊ','ऋ','ॠ','ऌ','ॡ','ऎ','ए','ऐ','ऒ','ओ','औ','क','ख','ग','घ','ङ','च','छ','ज','झ','ञ','ट','ठ','ड','ढ','ण','त','थ','द','ध','न','प','फ','ब','भ','म','य','र','ऱ','ल','ळ','ऴ','व','श','ष','स','ह'];
const devaMap=Object.fromEntries([...mlChars].map((c,i)=>[c,dvChars[i]]));
Object.assign(devaMap,{'ാ':'ा','ി':'ि','ീ':'ी','ു':'ु','ൂ':'ू','ൃ':'ृ','ൄ':'ॄ','ൢ':'ॢ','ൣ':'ॣ','െ':'ॆ','േ':'े','ൈ':'ै','ൊ':'ॊ','ോ':'ो','ൌ':'ौ','ൗ':'ौ','്':'्','ം':'ं','ഃ':'ः','ൺ':'ण्','ൻ':'न्','ർ':'र्','ൽ':'ल्','ൾ':'ळ्','ൿ':'क्'});
export const toDevanagari=text=>[...text.normalize('NFC')].map(c=>devaMap[c]||c).join('');

// A broad, spelling-oriented phonemic teaching approximation, not narrow surface IPA.
const ipaMap={ā:'aː',ī:'iː',ū:'uː',ē:'eː',ō:'oː',ṛ:'r̩',ṝ:'r̩ː',ḹ:'l̩ː',a:'ɐ',i:'i',u:'u',e:'e',o:'o',ŭ:'ɯ',k:'k',g:'ɡ',ṅ:'ŋ',c:'t͡ʃ',j:'d͡ʒ',ñ:'ɲ',ṭ:'ʈ',ḍ:'ɖ',ṇ:'ɳ',t:'t̪',d:'d̪',n:'n',p:'p',b:'b',m:'m',y:'j',r:'r',ṟ:'r̠',ṯ:'t',l:'l',ḷ:'ɭ',ḻ:'ɻ',v:'ʋ',ś:'ʃ',ṣ:'ʂ',s:'s',h:'h',ṃ:'m'};
export function broadIPA(roman) {
  const tokens=roman.normalize('NFC').replace(/acchan/g,'accan').match(/kh|gh|ch|jh|ṭh|ḍh|th|dh|ph|bh|ai|au|[^\s]/gu)||[];
  const aspirates={kh:'kʰ',gh:'ɡʱ',ch:'t͡ʃʰ',jh:'d͡ʒʱ',ṭh:'ʈʰ',ḍh:'ɖʱ',th:'t̪ʰ',dh:'d̪ʱ',ph:'pʰ',bh:'bʱ',ai:'ai̯',au:'au̯'};
  // Process per word to retain word boundaries.
  if(/\s/.test(roman))return roman.trim().split(/\s+/).map(broadIPA).join(' ');
  const mapped=tokens.filter(t=>!/[.,?!]/.test(t)).map(t=>aspirates[t]||ipaMap[t]||t);
  return mapped.map((t,i)=>i>0&&t===mapped[i-1]?'ː':t).join('');
}

const phraseParts={
  'ഇത് എന്റെ വീടാണ്.':[['ഇത്','itŭ','this'],['എന്റെ','ente','1SG.GEN'],['വീട്','vīṭŭ','house'],['ആണ്','āṇŭ','COP']],
  'എനിക്ക് വെള്ളം വേണം.':[['എനിക്ക്','enikkŭ','1SG.DAT'],['വെള്ളം','veḷḷaṃ','water'],['വേണം','vēṇaṃ','need']],
  'ബസ് എവിടെയാണ്?':[['ബസ്','bas','bus'],['എവിടെ','eviṭe','where'],['ആണ്','āṇŭ','COP']],
  'ടിക്കറ്റ് എത്രയാണ്?':[['ടിക്കറ്റ്','ṭikkaṯṯŭ','ticket'],['എത്ര','etra','how.much'],['ആണ്','āṇŭ','COP']],
  'ദയവായി പതുക്കെ പറയൂ.':[['ദയവായി','dayavāyi','please'],['പതുക്കെ','patukke','slowly'],['പറയ്','paṟay','say'],['ഊ','ū','IMP']],
  'എനിക്ക് പനിയുണ്ട്.':[['എനിക്ക്','enikkŭ','1SG.DAT'],['പനി','pani','fever'],['ഉണ്ട്','uṇṭŭ','EXIST']],
  'ഞാൻ നാളെ വരും.':[['ഞാൻ','ñān','1SG'],['നാളെ','nāḷe','tomorrow'],['വര്','var','come'],['ഉം','um','FUT']],
  'ദയവായി കാത്തിരിക്കുക.':[['ദയവായി','dayavāyi','please'],['കാത്തിരിക്ക്','kāttirikk','wait'],['ഉക','uka','INF / polite.instruction']],
  'പ്രവേശനമില്ല':[['പ്രവേശനം','pravēśanaṃ','entry'],['ഇല്ല','illa','NEG.EXIST']],
  'ആശുപത്രി എവിടെയാണ്?':[['ആശുപത്രി','āśupatri','hospital'],['എവിടെ','eviṭe','where'],['ആണ്','āṇŭ','COP']],
  'അവൾ പുസ്തകം വായിക്കുന്നു.':[['അവൾ','avaḷ','3SG.F'],['പുസ്തകം','pustakaṃ','book'],['വായിക്ക്','vāyikk','read'],['ഉന്നു','unnu','NPST']],
  'വീട്ടിൽ':[['വീട്ട്','vīṭṭ','house.OBL'],['ഇൽ','il','LOC']],
  'പോയില്ല':[['പോയി','pōyi','go.PST'],['ഇല്ല','illa','NEG']],
  'വീട്ടിൽ വെള്ളമുണ്ട്.':[['വീട്ട്','vīṭṭ','house.OBL'],['ഇൽ','il','LOC'],['വെള്ളം','veḷḷaṃ','water'],['ഉണ്ട്','uṇṭŭ','EXIST']]
};
export function glossParts(item) {
  if(phraseParts[item.ml])return phraseParts[item.ml].map(([ml,roman,gloss])=>({ml,roman,gloss}));
  if(item.id.startsWith('verb-'))return [{ml:item.ml.slice(0,-1),roman:item.roman.slice(0,-2),gloss:item.meaning.replaceAll(' / ','.')},{ml:'ക',roman:'ka',gloss:'INF'}];
  if(['letter','chillu','sign','conjunct'].includes(item.kind))return [{ml:item.ml,roman:item.roman,gloss:item.kind==='letter'?'LETTER':item.kind==='sign'?'SYLLABLE':item.kind.toUpperCase()}];
  const pronouns={'ഞാൻ':'1SG','നിങ്ങൾ':'2.POL/PL','ഇത്':'this','അത്':'that','വേണം':'need','ഇല്ല':'NEG.EXIST','അല്ല':'NEG.COP'};
  return [{ml:item.ml,roman:item.roman,gloss:pronouns[item.ml]||item.meaning.replaceAll(' / ','.').replaceAll(' ','.')}];
}
export function enrich(item) {
  item.devanagari=toDevanagari(item.ml);
  item.ipa ||= broadIPA(item.roman);
  item.ipaType=['letter','sign','chillu','conjunct'].includes(item.kind)?'sound reference':'broad spelling-based approximation';
  item.gloss=glossParts(item);
  item.glossType=['letter','sign','chillu','conjunct'].includes(item.kind)?'sound unit (not a morpheme)':'simplified morpheme gloss';
  item.section ||= ['letter','sign','chillu','conjunct'].includes(item.kind)?'script':item.kind==='phrase'?'phrases':item.kind==='grammar'?'grammar':item.kind==='phonetics'?'phonetics':'words';
  return item;
}

export const glossLegend='1SG: I/me · 2: second person · 3SG.F: she · POL: polite · PL: plural · GEN: possessive · DAT: to/for · COP: is · EXIST: exists · NEG: negative · IMP: imperative · INF: infinitive · FUT: future · PST: past · NPST: nonpast · OBL: inflected stem · LOC: location. Hyphens/columns show analysis, not necessarily surface spelling; sound changes may join parts.';
