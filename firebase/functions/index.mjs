import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret,defineString} from 'firebase-functions/params';
import {createCloudGateway,geminiEnvironment} from './lib/gateway/cloud-handler.mjs';

const apiKey=defineSecret('BHAASA_GEMINI_API_KEY');
const accessToken=defineSecret('BHAASA_GATEWAY_TOKEN');
const origins=defineString('BHAASA_ALLOWED_ORIGINS',{default:'https://bhaashik.github.io'});
const ocrModel=defineString('BHAASA_OCR_GEMINI_MODEL',{default:'gemini-3.1-flash-lite'});
const asrModel=defineString('BHAASA_ASR_GEMINI_MODEL',{default:'gemini-3.1-flash-lite'});
const ttsModel=defineString('BHAASA_TTS_GEMINI_MODEL',{default:'gemini-2.5-flash-preview-tts'});
const voice=defineString('BHAASA_TTS_GEMINI_VOICE',{default:'Kore'});

export const bhaasaApi=onRequest({
  region:'us-central1',invoker:'public',cors:false,
  secrets:[apiKey,accessToken],timeoutSeconds:120,
  memory:'512MiB',minInstances:0,maxInstances:2,concurrency:2
},async(req,res)=>{
  const env=geminiEnvironment({apiKey:apiKey.value(),origins:origins.value(),
    ocrModel:ocrModel.value(),asrModel:asrModel.value(),ttsModel:ttsModel.value(),voice:voice.value()});
  await createCloudGateway({env,accessToken:accessToken.value()})(req,res);
});
