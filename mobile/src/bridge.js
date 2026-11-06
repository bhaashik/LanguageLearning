// Plugin-independent adapter so native boundaries can be tested without a phone.
import {randomId} from '../../platform.js';
function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
export function createBridge({Capacitor,Filesystem,Share,TextToSpeech,Directory}){
  let voices=[];
  return {
    isNative:Capacitor.isNativePlatform(),platform:Capacitor.getPlatform(),
    async getVoices(){
      const result=await TextToSpeech.getSupportedVoices();voices=result.voices.map((v,nativeIndex)=>({...v,nativeIndex}));return voices;
    },
    async speak({text,voice,lang}){
      const selected=voices.find(v=>v.voiceURI===voice||v.name===voice);
      const code=String(lang||'ml-IN').toLowerCase().replace('_','-').split('-')[0];
      if(!['ml','fr'].includes(code)||!selected||selected.lang.toLowerCase().replace('_','-').split('-')[0]!==code)throw Error(`Select an installed ${code==='fr'?'French':'Malayalam'} device voice first.`);
      return TextToSpeech.speak({text,lang:selected.lang||lang,voice:selected.nativeIndex,rate:.8,pitch:1,volume:1,category:'ambient'});
    },
    stopSpeech:()=>TextToSpeech.stop(),
    async exportFile(blob,name){
      const safeName=String(name).replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,160)||'bhaasa-backup';
      const path=`exports/${Date.now()}-${randomId()}-${safeName}`;
      // Keep bridge payloads bounded even for a large recording ZIP.
      const chunkSize=512*1024;
      if(!blob.size)await Filesystem.writeFile({directory:Directory.Cache,path,data:'',recursive:true});
      for(let start=0;start<blob.size;start+=chunkSize){
        const data=base64(new Uint8Array(await blob.slice(start,start+chunkSize).arrayBuffer()));
        const options={directory:Directory.Cache,path,data};
        if(start===0)await Filesystem.writeFile({...options,recursive:true});else await Filesystem.appendFile(options);
      }
      const {uri}=await Filesystem.getUri({directory:Directory.Cache,path});
      await Share.share({title:'Bhaasa export',files:[uri],dialogTitle:'Save or share from Bhaasa'});
      return {shared:true};
    }
  };
}
