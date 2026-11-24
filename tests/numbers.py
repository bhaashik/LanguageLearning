"""Numbers course in the built Pages-path app. Audio/provider responses are fixtures."""
import io
import json
import os
from pathlib import Path
import shutil
import struct
import wave
import zipfile
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4190/LanguageLearning/').rstrip('/')+'/'
GATEWAY='https://numbers.bhaasa.test'
ACCESS='numbers_fixture_access_'.ljust(64,'x')
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
buf=io.BytesIO()
with wave.open(buf,'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(24000);wav.writeframes(b'\0\0'*1200)
AUDIO=buf.getvalue();calls=[];failure=False;held=[];hold=False

def seed(ctx):
    ctx.add_init_script("""if(!localStorage.getItem('bhaasa.voices.v1'))localStorage.setItem('bhaasa.voices.v1',JSON.stringify({profiles:[{id:'numbers-test',kind:'service',provider:'gemini',name:'Fixture Gemini',model:'gemini-2.5-flash-preview-tts',voice:'Kore',endpoint:'https://numbers.bhaasa.test/api/speech',gender:'female'}],activeId:'numbers-test',autoSave:true}));""")

def gateway(route):
    global failure
    req=route.request;headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Accept,X-Bhaasa-Gateway-Token','Access-Control-Allow-Methods':'POST,OPTIONS'}
    if req.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
    assert req.method=='POST'
    assert req.headers.get('x-bhaasa-gateway-token')==ACCESS
    data=req.post_data_json;calls.append(data)
    assert data['provider']=='gemini' and data['model']=='gemini-2.5-flash-preview-tts'
    assert data['voice'] in ('Charon','Kore') and data['language'] in ('ml-IN','en-US')
    if hold:held.append(route);return
    if failure and data['language']=='en-US':
        failure=False;route.fulfill(status=429,body='fixture quota error',headers=headers);return
    route.fulfill(content_type='audio/wav',body=AUDIO,headers=headers)

def connect(page):
    page.evaluate("""async ({base,token})=>{const g=await import('./gateway.js');g.saveGatewayConnection(base,token,{remember:true});} """,{'base':GATEWAY,'token':ACCESS})

def set_range(page,start,end):
    page.locator('[name=from]').fill(str(start));page.locator('[name=to]').fill(str(end));page.locator('[name=to]').blur()

def action(page,name):page.locator(f'[data-numbers="{name}"]').click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    ctx.add_init_script("Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true})")
    seed(ctx);ctx.route(GATEWAY+'/**',gateway)
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#numbers');connect(page)
    expect(page.locator('h1')).to_have_text('Numbers 1–100');expect(page.locator('.number-card')).to_have_count(100)
    expect(page.locator('#number-100')).to_contain_text('one hundred');expect(page.locator('#number-91')).to_contain_text('തൊണ്ണൂറ്റിയൊന്ന്')
    expect(page.locator('#numbers-status')).to_contain_text('Ready')
    set_range(page,1,2)
    page.locator('#numbers-settings summary').click()
    for key,value in [('voicePause','.2'),('languagePause','.3'),('numberPause','.5')]:page.locator(f'[name={key}]').fill(value)
    page.locator('#numbers-settings button[type=submit]').click();expect(page.locator('#numbers-settings-status')).to_contain_text('Saved on this device')
    action(page,'generate');expect(page.locator('#numbers-status')).to_contain_text('Saved all 8',timeout=15000)
    assert [(c['input'],c['language'],c['voice']) for c in calls[:4]]==[('ഒന്ന്','ml-IN','Charon'),('ഒന്ന്','ml-IN','Kore'),('one','en-US','Charon'),('one','en-US','Kore')]
    assert len(calls)==8
    action(page,'generate');expect(page.locator('#numbers-status')).to_contain_text('Saved all 8');assert len(calls)==8
    page.reload();expect(page.locator('#numbers-saved')).to_contain_text('8 of 400');expect(page.locator('[name=to]')).to_have_value('2');expect(page.locator('#numbers-settings-status')).to_contain_text('Saved on this device')
    action(page,'play');expect(page.locator('#numbers-status')).to_contain_text('Finished numbers 1–2',timeout=15000);assert len(calls)==8
    with page.expect_download() as download:
        page.locator('#number-1 [data-numbers=one-wav]').click()
    wav_path=OUT/'number-1-fixture.wav';download.value.save_as(wav_path)
    with wave.open(str(wav_path)) as wav:
        assert wav.getframerate()==24000 and wav.getnframes()==21600 # four 50 ms clips + .2/.3/.2 s pauses
    with page.expect_download() as download:action(page,'wav')
    with wave.open(str(download.value.path())) as wav:assert wav.getnframes()==55200 # two numbers + .5 s between
    with page.expect_download() as download:action(page,'export')
    backup=OUT/'numbers-fixture.zip';download.value.save_as(backup)
    with zipfile.ZipFile(backup) as archive:
        manifest=json.loads(archive.read('manifest.json'));assert len(manifest['clips'])==8
        assert any(n.startswith('english/numbers/') for n in archive.namelist())
        assert ACCESS.encode() not in archive.read('manifest.json')
    # A quota error preserves completed Malayalam clips; retry generates just the missing six.
    set_range(page,3,4);failure=True;action(page,'generate');expect(page.locator('#numbers-status')).to_contain_text('HTTP 429')
    expect(page.locator('#numbers-saved')).to_contain_text('10 of 400');before=len(calls)
    action(page,'generate');expect(page.locator('#numbers-status')).to_contain_text('Saved all 8');assert len(calls)-before==6
    # Stop aborts an outstanding request and prevents subsequent voices/numbers.
    set_range(page,5,6);hold=True;action(page,'generate');expect(page.locator('#numbers-status')).to_contain_text('Saving 1/8')
    page.wait_for_timeout(200);action(page,'stop');expect(page.locator('#numbers-status')).to_contain_text('Stopped')
    before=len(calls)
    for route in held:
        try:route.abort()
        except Exception:pass
    held.clear();hold=False;page.wait_for_timeout(200);assert len(calls)==before
    # Navigation cancels playback. All hundred cards fit desktop, tablet and phone widths.
    set_range(page,1,2);action(page,'play');page.locator('a[href="#words"]').first.click();expect(page.locator('body')).to_have_attribute('data-route','words')
    page.goto(BASE+'#numbers')
    for width in (1440,834,390):
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.screenshot(path=str(OUT/'numbers-phone.png'),full_page=False)
    # Offline shell and both-language saved playback survive a reload.
    page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=20000)
    page.wait_for_function("async()=>{const keys=await caches.keys();return keys.some(k=>k.endsWith('-v25'));}")
    ctx.set_offline(True);page.reload();expect(page.locator('.number-card')).to_have_count(100)
    set_range(page,1,2);action(page,'play');expect(page.locator('#numbers-status')).to_contain_text('Finished numbers 1–2',timeout=15000);assert len(calls)==before
    ctx.set_offline(False)
    # Device read-aloud requires explicit gender assignments and follows the same order.
    set_range(page,1,1);page.locator('[name=source]').select_option('device')
    action(page,'play');expect(page.locator('#numbers-status')).to_contain_text('Choose two different Malayalam')
    page.evaluate("""()=>{
      const voices=['ml','en'].flatMap(lang=>['male','female'].map(gender=>({name:lang+' '+gender,voiceURI:lang+'-'+gender,lang:lang+'-'+(lang==='ml'?'IN':'US')})));
      speechSynthesis.getVoices=()=>voices;window.numberDeviceCalls=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
      speechSynthesis.speak=u=>{numberDeviceCalls.push([u.text,u.voice.voiceURI]);setTimeout(()=>u.onend?.(),10)};
      speechSynthesis.cancel=()=>{};
    }""")
    action(page,'voices')
    for key,voice in [('mlMale','ml-male'),('mlFemale','ml-female'),('enMale','en-male'),('enFemale','en-female')]:page.locator(f'[name={key}]').select_option(voice)
    action(page,'play');expect(page.locator('#numbers-status')).to_contain_text('Finished numbers 1–1',timeout=10000)
    assert page.evaluate('numberDeviceCalls')==[['ഒന്ന്','ml-male'],['ഒന്ന്','ml-female'],['one','en-male'],['one','en-female']],page.evaluate('numberDeviceCalls')
    assert len(calls)==before
    # Backups restore all four variants in a new device store, and work from the French UI.
    other=browser.new_context(accept_downloads=True);seed(other);other.route(GATEWAY+'/**',gateway)
    q=other.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.goto(BASE+'#numbers');connect(q)
    q.locator('#numbers-import').set_input_files(backup);expect(q.locator('#numbers-status')).to_contain_text('Imported 8');expect(q.locator('#numbers-saved')).to_contain_text('8 of 400')
    q.locator('#language-choice').select_option('fr');q.wait_for_function("document.querySelector('#language-choice')?.value==='fr'");q.goto(BASE+'#numbers');expect(q.locator('.number-card')).to_have_count(100);expect(q.locator('#number-1')).to_contain_text('ഒന്ന്');expect(q.locator('#numbers-saved')).to_contain_text('8 of 400')
    with q.expect_download() as download:action(q,'list')
    assert len(download.value.path().read_text(encoding='utf-8-sig').splitlines())==101
    assert not errors,errors
    browser.close()
print('Numbers browser checks passed: content, generation/cache/resume, cancel, WAV pauses, ZIP restore, responsive layout and offline bilingual playback. Provider/audio fixtures only.')
