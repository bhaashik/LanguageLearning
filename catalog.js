import * as malayalam from './content.js';
import * as french from './french.js';
import {constructionCourse} from './course-content.js';
export const LANGUAGES={ml:{name:'Malayalam',native:'മലയാളം',locale:'ml-IN',symbol:'മ'},fr:{name:'French',native:'français',locale:'fr-FR',symbol:'Aa'}};
const course=constructionCourse('ml');
const mlItems=[...malayalam.allItems,...course.items];for(const item of mlItems)item.language='ml';
const ml={...malayalam,units:course.units,constructionItems:course.items,allItems:mlItems,byId:Object.fromEntries(mlItems.map(i=>[i.id,i])),lessons:[...malayalam.lessons,...course.lessons],sections:[...malayalam.sections,{id:'constructions',title:'Useful constructions'}]};
export function getCatalog(language){if(!Object.hasOwn(LANGUAGES,language))throw Error('Unknown learning language');return language==='fr'?french:ml;}
export function selectedLanguage(){try{const value=localStorage.getItem('bhaasa.language');return Object.hasOwn(LANGUAGES,value)?value:'ml';}catch{return 'ml';}}
export const language=selectedLanguage(),catalog=getCatalog(language),languageInfo=LANGUAGES[language];
