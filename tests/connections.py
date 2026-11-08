"""Public-host/tablet connection setup with local model fixtures. No paid APIs.
The GitHub Pages origin is simulated from local files; no live site is fetched.
"""
import io
import json
import mimetypes
import os
import shutil
import subprocess
import wave
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
LOCAL=os.environ.get('BHAASA_URL','http://127.0.0.1:4181/').rstrip('/')+'/'
PUBLIC='https://bhaashik.github.io/LanguageLearning/'
GATEWAY='https://gateway.bhaasa.test'
TARGET=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getCatalog} from './catalog.js';console.log(JSON.stringify(getCatalog('ml').units[0].items[0]));"],cwd=ROOT))
stream=io.BytesIO()
with wave.open(stream,'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(b'\0\0'*3200)
WAV=stream.getvalue()
def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':834,'height':1194},service_workers='block',has_touch=True,user_agent='Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1')
    context.add_init_script('''
      window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;
      Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});
      speechSynthesis.getVoices=()=>[{name:'Malayalam fixture',lang:'ml-IN',voiceURI:'ml-fixture',localService:true},{name:'French fixture',lang:'fr-FR',voiceURI:'fr-fixture',localService:true}];
      if(location.hostname==='bhaashik.github.io'&&!localStorage.getItem('connection-fixture-seeded')){
        localStorage.setItem('connection-fixture-seeded','1');
        localStorage.setItem('bhaasa.ocr.preferences.v1',JSON.stringify({provider:'gemini',profiles:{gemini:{endpoint:location.origin+'/LanguageLearning/api/ocr',model:'vision-saved'}}}));
        localStorage.setItem('bhaasa.asr.ml.v1',JSON.stringify({provider:'openai',profiles:{openai:{endpoint:location.origin+'/LanguageLearning/api/transcribe',model:'asr-saved'}}}));
      }
    ''')
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    public_api=[];calls=[];modes={};pending=[]
    def pages(route):
        path=urlsplit(route.request.url).path.removeprefix('/LanguageLearning/') or 'index.html'
        if '/api/' in '/'+path:
            public_api.append(path);route.fulfill(status=404,content_type='text/html',body='<html>Pages has no API</html>');return
        target=(ROOT/path).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():route.fulfill(status=404);return
        route.fulfill(content_type=mimetypes.guess_type(target)[0] or 'application/octet-stream',body=target.read_bytes())
    def gateway(route):
        request=route.request;path=urlsplit(request.url).path
        headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Accept','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}
        if request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
        calls.append({'method':request.method,'path':path,'body':request.post_data_json if request.method=='POST' else None})
        if request.method=='POST':
            body=request.post_data_json
            if path=='/api/speech':
                assert body['provider']=='gemini' and body['model']=='tts-b' and body['voice']=='voice-b'
                assert body['language']=='ml-IN';route.fulfill(content_type='audio/wav',body=WAV,headers=headers);return
            assert path=='/api/transcribe' and set(body)=={'audio','language','provider','model'}
            assert body['model']=='asr-b' and body['language']=='ml';route.fulfill(json={'text':TARGET['ml']},headers=headers);return
        if modes.get(path)=='html':route.fulfill(content_type='text/html',body='<html>Not a model API</html>',headers=headers);return
        if modes.get(path)=='error':route.fulfill(status=503,json={'error':'fixture'},headers=headers);return
        if modes.get(path)=='network':route.abort('accessdenied');return
        if modes.get(path)=='pending':pending.append(route);return
        if path=='/api/speech/models':data={'configured':True,'provider':'gemini','models':[{'id':'tts-a','voices':[{'id':'voice-a','name':'Fixture A'}]},{'id':'tts-b','voices':[{'id':'voice-b','name':'Fixture B'}]}]}
        elif path=='/api/ocr':data={'providers':[{'id':'gemini','configured':True,'model':'vision-a','models':['vision-a','vision-b']},{'id':'openai','configured':False,'models':[]}]}
        else:data={'providers':[{'id':'openai','configured':True,'model':'asr-a','models':['asr-a','asr-b']},{'id':'gemini','configured':False,'models':[]}]}
        route.fulfill(json=data,headers=headers)
    page.route(PUBLIC+'**',pages);page.route(GATEWAY+'/**',gateway)
    page.goto(PUBLIC+'#connections')
    expect(page.locator('h1')).to_have_text('Connections & models')
    expect(page.locator('#connection-ocr-provider')).to_have_value('gemini')
    expect(page.locator('#connection-ocr-endpoint')).to_have_value('')
    expect(page.locator('#connection-asr-endpoint')).to_have_value('')
    page.locator('#connection-ocr-discover').click();expect(page.locator('#connection-ocr-status')).to_contain_text('gateway address')
    assert not calls and not public_api
    expect(page.locator('#connection-tts-device')).to_contain_text('Malayalam fixture')
    print('PASS: tablet model controls visible, old static URLs removed, saved provider retained, no pretend Pages API calls')

    page.locator('#connection-base').fill(GATEWAY);page.locator('#connection-fill').click()
    page.locator('#connection-tts-provider').select_option('gemini')
    for kind in ['ocr','tts','asr']:
        expect(page.locator('#connection-'+kind+'-endpoint')).to_have_value(GATEWAY+'/api/'+{'ocr':'ocr','tts':'speech','asr':'transcribe'}[kind])
        page.locator('#connection-'+kind+'-discover').click()
        expect(page.locator('#connection-'+kind+'-status')).to_contain_text('2 configured model(s)')
    assert all(c['method']=='GET' for c in calls)
    for kind,model in [('ocr','vision-b'),('tts','tts-b'),('asr','asr-b')]:
        page.locator('#connection-'+kind+'-models').select_option(model)
        if kind=='tts':page.locator('#connection-tts-voices').select_option('voice-b')
        page.locator('#connection-'+kind+'-save').click()
    assert page.evaluate("JSON.parse(localStorage.getItem('bhaasa.ocr.preferences.v1')).profiles.gemini.model")=='vision-b'
    assert page.evaluate("JSON.parse(localStorage.getItem('bhaasa.asr.ml.v1')).profiles.openai.model")=='asr-b'
    print('PASS: native HTML model/voice selectors for all three services; metadata-only discovery and saved settings')

    nav(page,'item/vel-0');expect(page.locator('#ocr-model')).to_have_value('vision-b')
    expect(page.locator('#ocr-endpoint')).to_have_value(GATEWAY+'/api/ocr')
    nav(page,'speaking/'+TARGET['id']);expect(page.locator('#speech-model')).to_have_value('asr-b')
    expect(page.locator('#speech-endpoint')).to_have_value(GATEWAY+'/api/transcribe')
    expect(page.locator('.speech-settings')).to_have_attribute('open','')
    page.locator('#speech-file').set_input_files({'name':'phrase.wav','mimeType':'audio/wav','buffer':WAV})
    page.locator('#speech-check').click();expect(page.locator('#speech-result h3')).to_have_text('The transcript matches.')
    page.locator('[data-speak="'+TARGET['id']+'"]').first.click()
    page.wait_for_function("()=>new Promise(resolve=>{const r=indexedDB.open('bhaasa.audio.v1');r.onsuccess=()=>{const tx=r.result.transaction('clips'),q=tx.objectStore('clips').getAll();q.onsuccess=()=>resolve(q.result.some(c=>c.model==='tts-b'&&c.voice==='voice-b'))}})")
    print('PASS: chosen OCR/ASR settings reach practice; ASR works without AbortSignal.any; TTS uses and saves selected model/voice')

    nav(page,'connections');modes['/api/transcribe']='html';page.locator('#connection-asr-discover').click();expect(page.locator('#connection-asr-status')).to_contain_text('web page')
    modes['/api/transcribe']='error';page.locator('#connection-asr-discover').click();expect(page.locator('#connection-asr-status')).to_contain_text('HTTP 503')
    modes['/api/transcribe']='network';page.locator('#connection-asr-discover').click();expect(page.locator('#connection-asr-status')).to_contain_text('CORS')
    modes['/api/transcribe']='pending';page.locator('#connection-asr-discover').click();page.wait_for_timeout(100)
    page.locator('#connection-asr-provider').select_option('gemini')
    for route in pending:
        try:route.fulfill(json={'providers':[{'id':'openai','configured':True,'models':['stale-model']}]},headers={'Access-Control-Allow-Origin':'*'})
        except Exception:pass
    assert page.locator('#connection-asr-models option[value="stale-model"]').count()==0
    page.locator('#connection-ocr-endpoint').fill(PUBLIC+'api/ocr');before=len(calls)
    page.locator('#connection-ocr-discover').click();expect(page.locator('#connection-ocr-status')).to_contain_text('GitHub Pages hosts the app files')
    assert len(calls)==before and not public_api
    print('PASS: HTML, HTTP, CORS, stale-response cancellation and invalid static API addresses have clear outcomes')

    page.reload();expect(page.locator('#connection-ocr-endpoint')).to_have_value(GATEWAY+'/api/ocr')
    page.locator('#language-choice').select_option('fr');page.wait_for_function("document.querySelector('#language-choice').value==='fr'")
    nav(page,'connections')
    expect(page.locator('#connection-tts-provider')).to_have_value('device')
    expect(page.locator('#connection-tts-device')).to_contain_text('French fixture')
    assert 'Malayalam fixture' not in page.locator('#connection-tts-device').inner_text()
    page.locator('#language-choice').select_option('ml');page.wait_for_function("document.querySelector('#language-choice').value==='ml'")
    nav(page,'connections')
    expect(page.locator('#connection-tts-provider')).to_have_value('gemini')
    expect(page.locator('#connection-tts-model')).to_have_value('tts-b')
    for width,height in [(390,844),(834,1194),(1024,768),(1440,1000)]:
        page.set_viewport_size({'width':width,'height':height})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,height)
    (ROOT/'test-results').mkdir(exist_ok=True)
    page.set_viewport_size({'width':834,'height':1194});page.screenshot(path=str(ROOT/'test-results/connections-tablet.png'),full_page=True)
    desktop=context.new_page();desktop.goto(LOCAL+'#connections')
    expect(desktop.locator('#connection-ocr-endpoint')).to_have_value(LOCAL+'api/ocr')
    expect(desktop.locator('#connection-ocr-provider')).to_have_value('openai')
    assert not errors,errors
    print('PASS: language-specific voices, settings survive reload, portrait/landscape layouts, and unchanged desktop localhost defaults')
    browser.close()
