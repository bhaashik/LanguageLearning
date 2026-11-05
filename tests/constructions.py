"""Two-language construction, ASR, microphone cancellation, TTS and backup checks.
All model responses are local browser fixtures; no paid API requests are made.
"""
import io
import json
import os
import shutil
import subprocess
import wave
import zipfile
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
DATA=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {getCatalog} from './catalog.js';console.log(JSON.stringify(Object.fromEntries(['ml','fr'].map(l=>[l,{units:getCatalog(l).units,byId:getCatalog(l).byId}]))));"],cwd=ROOT))
stream=io.BytesIO()
with wave.open(stream,'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(b'\0\0'*3200)
WAV=stream.getvalue()

def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)
def state(page,language):return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))','bhaasa.progress.v2' if language=='ml' else 'bhaasa.progress.fr.v2')
def upload(page,name='practice.wav'):
    page.locator('#speech-file').set_input_files({'name':name,'mimeType':'audio/wav','buffer':WAV})
def correct(page,unit):
    question=page.locator('.quiz-card h1').inner_text();item=next(i for i in unit['items'] if i['question']==question)
    assert item['ml'] not in page.locator('.quiz-prompt').inner_text(),'completed cloze answer leaked before recall'
    for answer in page.locator('.answer').all():
        text=answer.evaluate("el=>[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()")
        if text==item['answer']:answer.click();return item
    raise AssertionError('Missing correct construction option')

with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required'])
    c=b.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,permissions=['microphone'])
    c.add_init_script('''window.SpeechRecognition=class {constructor(){window.fixtureRecognition=this}start(){}stop(){this.onend?.()}abort(){this.onend?.()}};''')
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    response={'text':'','status':200,'pending':False};calls=[];pending=[]
    def recognize(route):
        if route.request.method=='GET':route.fulfill(json={'providers':[{'id':'openai','configured':True,'models':['fixture-transcribe']}]});return
        body=route.request.post_data_json;assert set(body)<={'audio','language','provider','model'};assert body['audio'].startswith('data:audio/');calls.append(body)
        if response['pending']:pending.append(route)
        else:route.fulfill(status=response['status'],json={'text':response['text']} if response['status']==200 else {'error':'asr_provider_unavailable'})
    page.route('**/api/transcribe',recognize)
    page.goto(BASE+'#constructions')
    expect(page.locator('.construction-grid>.panel')).to_have_count(16)
    unit=DATA['ml']['units'][0];nav(page,'constructions/'+unit['id'])
    expect(page.locator('.construction-rule')).to_contain_text('does not change')
    nav(page,'item/'+unit['items'][0]['id']);expect(page.locator('#writing-canvas')).to_have_count(0)
    nav(page,'constructions/'+unit['id']);page.locator('[data-quiz]').click()
    first=correct(page,unit);page.reload();expect(page.locator('#answer-feedback')).to_contain_text('Constraint:')
    page.locator('[data-action="quiz-next"]').click();correct(page,unit);page.locator('[data-action="quiz-next"]').click()
    expect(page.locator('.correct-answer')).to_have_count(2)
    assert state(page,'ml')['session']['sections']['constructions']=={'total':2,'correct':2}
    print('PASS: Malayalam constructions, constraints, hidden cloze answers, quiz resume, and complete answer key')

    target=unit['items'][0];nav(page,'speaking/'+target['id'])
    page.locator('.speech-settings summary').click();page.locator('#speech-provider').select_option('openai')
    page.locator('#speech-connection').click()
    expect(page.locator('#speech-connection-status')).to_contain_text('No recording was sent');assert not calls
    upload(page);response['text']=target['ml'];page.locator('#speech-check').click()
    expect(page.locator('#speech-result h3')).to_have_text('The transcript matches.')
    assert state(page,'ml')['speaking'][target['id']]['attempts']==1
    expect(page.locator('#speech-check')).to_be_disabled();assert calls[0]['language']=='ml'
    page.locator('#speech-save').click();expect(page.locator('#toast')).to_contain_text('My recordings')
    upload(page,'different.wav');response['text']='അല്ല';page.locator('#speech-check').click()
    expect(page.locator('#speech-result h3')).to_have_text('Compare what was heard.')
    assert state(page,'ml')['speaking'][target['id']]['matches']==1
    assert state(page,'ml')['speaking'][target['id']]['attempts']==2
    upload(page,'empty.wav');response['text']='';page.locator('#speech-check').click();expect(page.locator('#speech-status')).to_contain_text('Nothing was scored')
    assert state(page,'ml')['speaking'][target['id']]['attempts']==2
    upload(page,'failure.wav');response['status']=503;page.locator('#speech-check').click();expect(page.locator('#speech-status')).to_contain_text('temporarily unavailable')
    assert state(page,'ml')['speaking'][target['id']]['attempts']==2
    response.update(status=200,pending=True);upload(page,'cancel.wav');page.locator('#speech-check').click();page.wait_for_function("document.querySelector('#speech-cancel').disabled===false")
    page.locator('#speech-cancel').click();expect(page.locator('#speech-status')).to_contain_text('cancelled')
    assert state(page,'ml')['speaking'][target['id']]['attempts']==2
    for route in pending:
        try:route.abort()
        except Exception:pass
    response['pending']=False
    print('PASS: blind gateway ASR, saved practice audio, mismatch/empty/failure handling, cancellation, and separate speech scores')

    # A permission prompt resolving after cancellation must never start recording.
    page.evaluate('''()=>{window.originalMic=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=options=>new Promise(resolve=>{window.allowPendingMic=async()=>{window.lateStream=await window.originalMic(options);resolve(window.lateStream)}})}''')
    page.locator('#speech-record').click();page.wait_for_function('Boolean(window.allowPendingMic)');page.locator('#speech-cancel').click()
    page.evaluate('allowPendingMic()');page.wait_for_function('lateStream.getTracks().every(t=>t.readyState==="ended")')
    expect(page.locator('#speech-stop')).to_be_disabled()
    page.evaluate('()=>{navigator.mediaDevices.getUserMedia=window.originalMic;}')
    page.locator('#speech-record').click();expect(page.locator('#speech-stop')).to_be_enabled();page.wait_for_timeout(300);page.locator('#speech-stop').click()
    expect(page.locator('#speech-check')).to_be_enabled()
    page.locator('#speech-record').click();expect(page.locator('#speech-stop')).to_be_enabled();nav(page,'progress')
    assert page.evaluate('document.querySelector("#speech-record")===null')
    print('PASS: actual microphone recording, late permission cancellation, and leaving active recording')

    # French starts with a different progress store, then retains it on return.
    ml_before=state(page,'ml');page.locator('#language-choice').select_option('fr')
    page.wait_for_function("document.querySelector('#language-choice')?.value==='fr'")
    assert state(page,'fr')['language']=='fr';assert state(page,'fr')['items']=={}
    for route in ['script','phonetics','words','grammar','constructions','about']:
        nav(page,route)
        assert 'Malayalam' not in page.locator('.page-heading h1').inner_text()
    nav(page,'script');expect(page.locator('.letter-tile')).to_have_count(6)
    page.locator('[data-script="Vowel signs"]').click();expect(page.locator('.letter-tile')).to_have_count(16)
    fr_unit=next(u for u in DATA['fr']['units'] if u['id']=='fr-use-agreement')
    nav(page,'constructions/'+fr_unit['id']);page.locator('[data-quiz]').click()
    while not page.locator('.result-card').count():
        correct(page,fr_unit);page.locator('[data-action="quiz-next"]').click()
    assert state(page,'fr')['session']['sections']['constructions']=={'total':2,'correct':2}
    assert state(page,'ml')['items']==ml_before['items']
    fr_target=fr_unit['items'][0];nav(page,'speaking/'+fr_target['id']);page.locator('.speech-settings summary').click();page.locator('#speech-provider').select_option('browser')
    page.locator('#speech-record').click()
    page.evaluate('(text)=>fixtureRecognition.onresult({resultIndex:0,results:[[{transcript:text}]]})',fr_target['ml'])
    expect(page.locator('#speech-result h3')).to_have_text('The transcript matches.')
    assert page.evaluate('fixtureRecognition.lang')=='fr-FR';assert state(page,'fr')['speaking'][fr_target['id']]['matches']==1
    page.evaluate('(text)=>fixtureRecognition.onresult({resultIndex:0,results:[[{transcript:text}]]})',fr_target['ml'])
    assert state(page,'fr')['speaking'][fr_target['id']]['attempts']==1
    print('PASS: French alphabet/accents, agreement quiz, browser-ASR language and deduplication, and isolated language progress')

    # French service TTS and saved clips keep their own language and ZIP folder.
    tts=[]
    def speak(route):
        body=route.request.post_data_json;tts.append(body);assert body['language']=='fr-FR';route.fulfill(content_type='audio/wav',body=WAV)
    page.route('https://bhaasa-fixture.test/speech',speak)
    nav(page,'audio/'+fr_target['id']);expect(page.locator('.clip-row')).to_have_count(0)
    form=page.locator('#voice-form')
    for key,value in {'name':'French fixture','provider':'fixture','model':'fr-fixture','voice':'speaker','endpoint':'https://bhaasa-fixture.test/speech'}.items():form.locator(f'[name="{key}"]').fill(value)
    form.get_by_role('button',name='Add voice profile').click();page.locator('[data-audio="generate"]').click()
    expect(page.locator('.clip-row')).to_have_count(1);assert len(tts)==1
    with page.expect_download() as download:page.locator('[data-audio="export"]').click()
    with zipfile.ZipFile(download.value.path()) as archive:
        manifest=json.loads(archive.read('manifest.json'));assert manifest['clips'][0]['language']=='fr';assert manifest['clips'][0]['path'].startswith('french/')
    nav(page,'progress')
    with page.expect_download() as download:page.locator('[data-action="export"]').click()
    french_backup=json.loads(Path(download.value.path()).read_text());assert french_backup['language']=='fr';assert french_backup['speaking'][fr_target['id']]['attempts']==1
    page.locator('#language-choice').select_option('ml');page.wait_for_function("document.querySelector('#language-choice')?.value==='ml'")
    assert state(page,'ml')['items']==ml_before['items']
    page.locator('#language-choice').select_option('fr');page.wait_for_function("document.querySelector('#language-choice')?.value==='fr'")
    assert state(page,'fr')['speaking'][fr_target['id']]['attempts']==1
    expect(page.locator('#offline-status')).to_have_text('Available offline')
    desktop=page.evaluate('Boolean(window.BhaasaDesktop?.isDesktop)')
    def only_local(route):
        if urlsplit(route.request.url).netloc==urlsplit(BASE).netloc:route.continue_()
        else:route.abort('internetdisconnected')
    if desktop:c.route('**/*',only_local)
    else:c.set_offline(True)
    page.reload();nav(page,'constructions/fr-use-agreement');expect(page.locator('.construction-rule')).to_contain_text('agree')
    nav(page,'audio/'+fr_target['id']);page.locator('[data-audio="play"]').click();assert len(tts)==1,'offline playback must reuse the cached French clip'
    if desktop:c.unroute('**/*',only_local)
    else:c.set_offline(False)
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for route in ['constructions','constructions/fr-use-agreement','speaking/'+fr_target['id'],'script','progress']:
            nav(page,route)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,route)
    assert not errors,errors
    c.close();b.close()
    print('PASS: French TTS language, separate audio library/export, offline course/audio reuse, speech backup/resume, and responsive course/speech UI')
