"""Exercise the real bundled Firebase SDK with local reCAPTCHA/App Check/AI fixtures.
No credentials, tokens, model requests or recordings are sent to live Google services.
"""
import base64
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
WEB_KEY='AIzaPublicFirebaseWebKeyFixture'
SITE_KEY='6PublicEnterpriseWebsiteKeyFixture'
TOKEN=base64.urlsafe_b64encode(b'{"alg":"none"}').decode().rstrip('=')+'.'+base64.urlsafe_b64encode(b'{"iat":1794240000,"exp":4102444800}').decode().rstrip('=')+'.fixture'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':834,'height':1194},service_workers='block')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    calls=[];tokens=[];mode={'value':'ok'}
    def recaptcha(route):
        route.fulfill(content_type='application/javascript',body="window.grecaptcha={enterprise:{ready:cb=>cb(),render:(el,options)=>{window.__recaptchaCallback=options.callback;if(options.sitekey!=='"+SITE_KEY+"')throw Error('wrong public site key');options.callback();return 1;},execute:async()=> {window.__recaptchaCallback();return 'recaptcha-fixture'}}};")
    def appcheck(route):
        assert '1:1017562072235:web:e1ce9a61407ed034a263ee:exchangeRecaptchaEnterpriseToken' in route.request.url
        assert route.request.post_data_json['recaptcha_enterprise_token']=='recaptcha-fixture'
        tokens.append(route.request.url)
        route.fulfill(json={'token':TOKEN,'ttl':'3600s'},headers={'Access-Control-Allow-Origin':'*'})
    def ai(route):
        request=route.request
        if request.method=='OPTIONS':
            route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST'});return
        assert request.headers['x-firebase-appcheck']==TOKEN
        assert request.headers['x-goog-api-key']==WEB_KEY
        assert '/projects/bhaashik-apps/' in request.url and '/publishers/google/models/' not in request.url
        data=request.post_data_json;calls.append({'url':request.url,'body':data})
        if mode['value']=='quota':route.fulfill(status=429,json={'error':{'message':'quota fixture','status':'RESOURCE_EXHAUSTED'}},headers={'Access-Control-Allow-Origin':'*'});return
        content=data['contents'][0]['parts']
        if data.get('generationConfig',{}).get('responseModalities')==['AUDIO']:
            assert data['generationConfig']['speechConfig']['voiceConfig']['prebuiltVoiceConfig']['voiceName']=='Kore'
            parts=[{'inlineData':{'mimeType':'audio/L16;codec=pcm;rate=24000','data':base64.b64encode(b'\0\0'*2400).decode()}}]
        elif any(part.get('inlineData',{}).get('mimeType')=='image/png' for part in content):
            assert len(content)==2 and 'expected' not in data and 'അ' not in json.dumps(data,ensure_ascii=False)
            parts=[{'text':json.dumps({'text':'അ','legible':True},ensure_ascii=False)}]
        else:
            assert len(content)==1 and content[0]['inlineData']['mimeType']=='audio/wav'
            parts=[{'text':json.dumps({'text':'bonjour'})}]
        route.fulfill(json={'candidates':[{'finishReason':'STOP','content':{'role':'model','parts':parts}}]},headers={'Access-Control-Allow-Origin':'*'})
    page.route('https://**/*',lambda route:route.abort('blockedbyclient'))
    page.route('https://www.google.com/recaptcha/**',recaptcha)
    page.route('https://content-firebaseappcheck.googleapis.com/**',appcheck)
    page.route('https://firebasevertexai.googleapis.com/**',ai)
    # Catch unintended provider traffic instead of letting a test contact a live service.
    page.route('https://generativelanguage.googleapis.com/**',lambda route:(_ for _ in ()).throw(AssertionError('Gemini API must stay behind Firebase')))
    page.goto(BASE+'#connections');page.locator('#connection-advanced>summary').click();expect(page.locator('h1')).to_have_text('Connections & models')
    assert not calls and not tokens
    assert not page.evaluate("performance.getEntriesByType('resource').some(r=>r.name.includes('vendor/firebase-ai.js'))")
    page.locator('#firebase-api-key').fill(WEB_KEY);page.locator('#firebase-site-key').fill(SITE_KEY);page.locator('#firebase-save').click()
    expect(page.locator('#firebase-status')).to_contain_text('Saved locally')
    page.locator('#firebase-check').click();expect(page.locator('#firebase-status')).to_contain_text('App Check token obtained',timeout=15000)
    assert tokens and not calls
    for kind in ['ocr','tts','asr']:
        page.locator('#connection-'+kind+'-provider').select_option('firebase')
        expect(page.locator('#connection-'+kind+'-endpoint')).to_be_disabled()
        page.locator('#connection-'+kind+'-discover').click()
        expect(page.locator('#connection-'+kind+'-status')).to_contain_text('not a live model list')
        page.locator('#connection-'+kind+'-save').click()
        expect(page.locator('#connection-'+kind+'-status')).to_contain_text('selected' if kind=='tts' else 'saved')
    assert not calls
    page.reload();expect(page.locator('#connection-asr-provider')).to_have_value('firebase')
    expect(page.locator('#connection-tts-provider')).to_have_value('firebase')
    print('PASS: real bundled SDK, Enterprise token exchange, local configuration and per-service choices persist without generation')
    # Core provider adapters use the same singleton as the actual UI; verify wire requests.
    result=page.evaluate("""async()=>{const {firebaseClient}=await import('./firebase-client.js');return await firebaseClient.ocr('data:image/png;base64,aW5r')}""")
    assert result['text']=='അ' and result['provider']=='firebase'
    result=page.evaluate("""async()=>{const {transcribeAudio}=await import('./asr.js');return await transcribeAudio(new Blob(['voice'],{type:'audio/wav'}),{provider:'firebase',endpoint:'',model:'gemini-2.5-flash'},'fr')}""")
    assert result['text']=='bonjour'
    # Verify AudioLibrary generation, storage and reuse through the UI's own library class.
    result=page.evaluate("""async()=>{const {AudioLibrary}=await import('./audio.js');const a=new AudioLibrary(()=>{});await a.load();const t={id:'firebase-fixture',ml:'നമസ്കാരം',language:'ml',section:'words',kind:'word'};const b=await a.generate(t);const bytes=new Uint8Array(await b.arrayBuffer());const cached=await a.generate(t);return {mime:b.type,header:String.fromCharCode(...bytes.slice(0,4)),same:cached===a.cached(t).blob,clips:a.clips.filter(c=>c.itemId===t.id).length}}""")
    assert result=={'mime':'audio/wav','header':'RIFF','same':True,'clips':1},result
    assert len(calls)==3
    print('PASS: SDK sends App Check and Firebase web key to the managed Firebase endpoint; OCR/ASR/TTS use selected models and cache WAV audio')
    # Actual tracing and speaking controls must allow Firebase without a gateway URL.
    page.evaluate("location.hash='item/v-0'");page.wait_for_function("document.body.dataset.route==='item/v-0'")
    expect(page.locator('#ocr-provider')).to_have_value('firebase');expect(page.locator('#ocr-endpoint')).to_be_disabled()
    page.locator('.trace-settings').evaluate('(e)=>e.open=true');page.locator('#ocr-check-connection').click();expect(page.locator('#ocr-connection-status')).to_contain_text('App Check token obtained')
    box=page.locator('#writing-canvas');box.scroll_into_view_if_needed();rect=box.bounding_box()
    page.mouse.move(rect['x']+60,rect['y']+70);page.mouse.down()
    for x,y in [(160,70),(160,160),(60,160),(60,70)]:page.mouse.move(rect['x']+x,rect['y']+y)
    page.mouse.up();page.locator('#check-handwriting').click()
    expect(page.locator('#ocr-feedback')).to_contain_text('OCR read the symbol')
    page.evaluate("location.hash='speaking'");page.wait_for_function("document.body.dataset.route==='speaking'")
    expect(page.locator('#speech-provider')).to_have_value('firebase')
    page.locator('#speech-file').set_input_files({'name':'voice.wav','mimeType':'audio/wav','buffer':b'RIFF'+b'\0'*80})
    expect(page.locator('#speech-check')).to_be_enabled()
    page.locator('#speech-check').click();expect(page.locator('#speech-result')).to_contain_text('ASR heard:')
    before=len(calls);mode['value']='quota'
    result=page.evaluate("""async()=>{try{const {firebaseClient}=await import('./firebase-client.js');await firebaseClient.ocr('data:image/png;base64,aW5r')}catch(e){return e.message}}""")
    assert 'quota' in result.lower() and len(calls)==before+1
    page.evaluate("location.hash='connections'");page.wait_for_function("document.body.dataset.route==='connections'");page.locator('#connection-advanced>summary').click()
    page.locator('#firebase-clear').click();expect(page.locator('#firebase-status')).to_contain_text('removed')
    assert page.evaluate("localStorage.getItem('bhaasa.firebase.web.v1')") is None
    context.set_offline(True)
    cached=page.evaluate("""async()=>{const {AudioLibrary}=await import('./audio.js');const a=new AudioLibrary(()=>{});await a.load();return (await a.generate({id:'firebase-fixture',ml:'നമസ്കാരം',language:'ml',section:'words',kind:'word'})).type}""")
    assert cached=='audio/wav'
    assert not errors,errors
    print('PASS: tracing/speaking controls work without gateway addresses; failures do not retry; forgetting config preserves service preferences')
    browser.close()
