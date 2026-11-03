export const exampleRows=[
  ['ഈ','ī','this (before a noun)'],['ഉപ്പ്','uppŭ','salt'],['ഊണ്','ūṇŭ','meal'],['ഏത്','ētŭ','which'],
  ['ഐക്യം','aikyaṃ','unity'],['ഔഷധം','auṣadhaṃ','medicine (formal)'],['ഋഷി','ṛṣi','sage'],
  ['കഥ','katha','story'],['ഖരം','kharaṃ','hard / solid (learned)'],['ഗതി','gati','course / movement'],
  ['ഘടികാരം','ghaṭikāraṃ','clock'],['അങ്ങാടി','aṅṅāṭi','market'],['ഛായ','chāya','shade / image'],
  ['ജലം','jalaṃ','water (formal)'],['ഝടിതി','jhaṭiti','quickly (Sanskritic / literary)'],
  ['പാഠം','pāṭhaṃ','lesson'],['ദൃഢം','dṛḍhaṃ','firm'],['ദിവസം','divasaṃ','day'],['ധനം','dhanaṃ','wealth'],
  ['ഫലം','phalaṃ','fruit / result'],['ഭാഷ','bhāṣa','language'],['യാത്ര','yātra','journey'],
  ['മരം','maraṃ','tree'],['ലത','lata','creeper / vine'],['ശബ്ദം','śabdaṃ','sound'],['ഹരി','hari','Hari (a name)'],
  ['മഴ','maḻa','rain'],['കിളി','kiḷi','bird'],['കീടം','kīṭaṃ','insect'],['കൂട്','kūṭŭ','nest'],
  ['കൃഷ്ണൻ','kṛṣṇan','Krishnan (a name)'],['കെട്ട്','keṭṭŭ','knot / bundle'],['കൈ','kai','hand'],
  ['കൊടി','koṭi','flag'],['കോഴി','kōḻi','chicken'],['കൗതുകം','kautukaṃ','curiosity'],['വാക്ക്','vākkŭ','word'],
  ['ആൺ','āṇ','male'],['അപ്പം','appaṃ','appam / rice pancake'],['കത്ത്','kattŭ','letter / message'],
  ['എന്ത്','entŭ','what'],['അങ്കം','aṅkaṃ','act / section (literary)'],['അഞ്ച്','añcŭ','five'],
  ['ജ്ഞാനം','jñānaṃ','knowledge'],['പറ്റി','paṯṯi','about'],['വല','vala','net'],['വള','vaḷa','bangle'],
  ['കടി','kaṭi','bite'],['കട്ടി','kaṭṭi','lump / thickness'],['കുടം','kuṭaṃ','pot'],['കൂടം','kūṭaṃ','hall']
];
// Each entry is a word containing the symbol. Exceptional learned symbols are explicit teaching examples.
export const exampleSpellings={
  Vowels:['അച്ഛൻ','ആൾ','ഇത്','ഈ','ഉപ്പ്','ഊണ്','എവിടെ','ഏത്','ഐക്യം','ഒപ്പ്','ഓഫീസ്','ഔഷധം','ഋഷി',null,null,null],
  Consonants:['കഥ','ഖരം','ഗതി','ഘടികാരം','അങ്ങാടി','ചായ','ഛായ','ജലം','ഝടിതി','ഞാൻ','ടിക്കറ്റ്','പാഠം','ഡോക്ടർ','ദൃഢം','പണം','തീയതി','കഥ','ദിവസം','ധനം','പനി','പാൽ','ഫലം','ബസ്','ഭാഷ','അമ്മ','യാത്ര','മരം','ലത','വഴി','ശബ്ദം','ഭാഷ','സമയം','ഹരി','വെള്ളം','മഴ','ചോറ്'],
  'Vowel signs':['കഥ','കാപ്പി','കിളി','കീടം','കുട്ടി','കൂട്','കൃഷ്ണൻ','കെട്ട്','കേൾക്കുക','കൈ','കൊടി','കോഴി','കൗതുകം','വാക്ക്'],
  Chillus:['ആൺ','അച്ഛൻ','ഡോക്ടർ','പാൽ','ആൾ',null],
  Conjuncts:['താക്കോൽ','അപ്പം','കുട്ടി','കത്ത്','എന്ത്','നമ്പർ','അങ്കം','അഞ്ച്','വണ്ടി','ഭക്ഷണം','ജ്ഞാനം','പറ്റി']
};

export const soundTopics=[
  {id:'length',title:'Vowel length changes meaning',body:'Hold a long vowel longer. Malayalam distinguishes short e /e/ and o /o/ from long ē /eː/ and ō /oː/. The macron in Roman spelling marks length.',examples:['കുടം','കൂടം'],question:'Which has a long ū vowel?',target:'കൂടം',answer:'Long vowel ū',options:['Long vowel ū','Short vowel u','No vowel','A chillu ending']},
  {id:'place',title:'Where the tongue goes',body:'Dental ത /t̪/ touches the upper teeth. Retroflex ട /ʈ/ retracts the tongue tip. Malayalam contrasts these places of articulation; English t is not an exact guide to either.',examples:['തീയതി','ടിക്കറ്റ്'],question:'Where is the tongue tip for ട /ʈ/?',target:'ടിക്കറ്റ്',answer:'Retracted / retroflex',options:['Retracted / retroflex','At the upper teeth','Both lips together','At the soft palate']},
  {id:'laterals',title:'ല, ള, and ഴ are different',body:'ല /l/ is a front lateral. ള /ɭ/ is a retroflex lateral with airflow at the sides of the tongue. ഴ /ɻ/ is a retroflex approximant without complete closure; it is not the Hindi flap ड़.',examples:['വല','വള','മഴ'],question:'Which sound is the retroflex approximant in മഴ?',target:'മഴ',answer:'ഴ /ɻ/',options:['ഴ /ɻ/','ല /l/','ള /ɭ/','ട /ʈ/']},
  {id:'gemination',title:'A longer consonant matters',body:'Gemination means holding a consonant longer, not inserting another vowel. Compare കടി (bite) and കട്ടി (lump / thickness). Double letters in Roman spelling mark consonant length.',examples:['കടി','കട്ടി'],question:'What does the doubled ട്ട in കട്ടി indicate?',target:'കട്ടി',answer:'A longer consonant',options:['A longer consonant','A long vowel','A missing vowel sign','A question ending']},
  {id:'context',title:'Letters and speech do not match one to one',body:'Stops may be voiced in some contexts. Aspirated consonants are most characteristic of Sanskritic and learned vocabulary and can lose aspiration in casual speech. IPA here is broad and spelling-oriented, not a recording of a specific dialect.',examples:['ഖരം','ഭാഷ'],question:'How should aspirated letters be interpreted?',target:'ഭാഷ',answer:'Pronunciation can vary with register',options:['Pronunciation can vary with register','Every speaker always aspirates them','They are silent letters','They only mark vowel length']},
  {id:'endings',title:'Endings, syllables, and chillus',body:'A consonant normally carries an inherent vowel. Chillus represent consonants without that vowel. Final chandrakala can occur with a reduced vowel (often approximated [ɯ]); interpret it from the word and dialect. Chillus are an orthographic category, not a separate place of articulation.',examples:['പാൽ','വീട്'],question:'What is the role of the final ൽ in പാൽ?',target:'പാൽ',answer:'A consonant without an inherent vowel',options:['A consonant without an inherent vowel','An independent vowel','A plural ending','An aspirated consonant']}
];
