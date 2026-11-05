import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Filesystem,Directory} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {TextToSpeech} from '@capacitor-community/text-to-speech';
import {createBridge} from './bridge.js';

window.BhaasaNative=createBridge({Capacitor,Filesystem,Share,TextToSpeech,Directory});
if(Capacitor.isNativePlatform()){
  document.documentElement.dataset.native=Capacitor.getPlatform();
  App.addListener('backButton',({canGoBack})=>{if(canGoBack)history.back();else App.exitApp();});
  App.addListener('appStateChange',({isActive})=>{if(!isActive)window.dispatchEvent(new Event('bhaasa:pause'));});
}
