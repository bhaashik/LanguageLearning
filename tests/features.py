"""Bhaasa additions: resume, section scores, answer keys, speech caching, audio backups."""
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import wave
import zipfile
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
DATA=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {byId} from './content.js';console.log(JSON.stringify(byId));"],cwd=ROOT))
KEY='bhaasa.progress.v2'
stream=io.BytesIO()
with wave.open(stream,'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b'\0\0'*1600)
WAV=stream.getvalue()

def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)

def desktop_wan_offline(route):
    # A desktop app's bundled files are on its loopback server. Browser-wide
    # network emulation would disable that too, unlike disconnecting Wi-Fi.
    if urlsplit(route.request.url).netloc==urlsplit(BASE).netloc:route.continue_()
    else:route.abort('internetdisconnected')

def set_offline(context,page,enabled):
    if page.evaluate('Boolean(window.BhaasaDesktop?.isDesktop)'):
        if enabled:context.route('**/*',desktop_wan_offline)
        else:context.unroute('**/*',desktop_wan_offline)
    else:context.set_offline(enabled)

def finish(page):
    while not page.locator('.result-card').count():
        item=DATA[page.locator('.quiz-prompt [data-speak]').get_attribute('data-speak')]
        answer=item.get('answer') or (item['meaning'] if item['kind'] in ('word','phrase') else item['roman'])
        for option in page.locator('.answer').all():
            text=option.evaluate("el=>[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()")
            if text==answer:
                option.click();break
        else:raise AssertionError('No correct option')
        page.locator('[data-action="quiz-next"]').click()

def clips(page):
    return page.evaluate("async()=>{const {listClips}=await import(new URL('audio-store.js',location.href));return (await listClips()).map(({blob,...c})=>({...c,size:blob.size}));}")

def add_profile(page,model='v1'):
    form=page.locator('#voice-form')
    for field,value in {'name':'Fixture '+model,'provider':'fixture','model':model,'voice':'voice-a','endpoint':'https://bhaasa-speech.test/api/speech'}.items():
        form.locator(f'[name="{field}"]').fill(value)
    form.locator('[name="gender"]').select_option('female')
    form.get_by_role('button',name='Add voice profile').click()
    expect(page.locator('#active-voice')).not_to_have_value('device')

with sync_playwright() as p:
    executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    launch={'headless':True,'args':['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']}
    if executable:launch['executable_path']=executable
    browser=p.chromium.launch(**launch)
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,permissions=['microphone'])
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#lesson/first-vowels')
    page.locator('[data-card="2"]').click()
    expect(page.locator('.study-content>.ml')).to_have_text('ഇ')
    page.goto(BASE)
    expect(page.locator('.study-content>.ml')).to_have_text('ഇ')
    expect(page.locator('.recap')).to_be_visible()
    page.locator('[data-action="dismiss-recap"]').click()
    page.locator('[data-quiz]').click()
    page.locator('.answer').first.click()
    count=page.evaluate('(k)=>Object.values(JSON.parse(localStorage.getItem(k)).items).reduce((n,i)=>n+i.attempts,0)',KEY)
    question=page.locator('.quiz-prompt>.ml').inner_text()
    page.goto(BASE)
    expect(page.locator('.quiz-prompt>.ml')).to_have_text(question)
    expect(page.locator('#answer-feedback')).to_be_visible()
    expect(page.locator('.answer:enabled')).to_have_count(0)
    assert page.evaluate('(k)=>Object.values(JSON.parse(localStorage.getItem(k)).items).reduce((n,i)=>n+i.attempts,0)',KEY)==count
    page.locator('[data-action="quiz-next"]').click();finish(page)
    expect(page.locator('.correct-answer')).to_have_count(6)
    assert page.locator('.correct-answer').filter(has_text='Your answer:').count()==6
    nav(page,'progress')
    state=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
    assert state['session']['sections']['script']['total']==6
    page.locator('[data-action="new-session"]').click()
    new=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
    assert new['session']['sections']=={} and new['items']==state['items']
    for section in ('phonetics','grammar'):
        nav(page,section)
        page.locator('[data-practice]').click();finish(page)
        expect(page.locator('.result-card h2')).to_have_text('6 out of 6')
        expect(page.locator('.correct-answer')).to_have_count(6)
    nav(page,'progress')
    state=page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
    assert state['session']['sections']['phonetics']=={'total':6,'correct':6}
    assert state['session']['sections']['grammar']=={'total':6,'correct':6}
    expect(page.locator('.section-score-grid .panel')).to_have_count(5)
    page.screenshot(path=str(OUT/'section-scores.png'),full_page=True)
    print('PASS: card and quiz resume, recap, no double scoring, full answer key, section/session scores')

    nav(page,'item/phrase-1')
    expect(page.locator('.detail-card .gloss-parts')).to_contain_text('1SG.DAT')
    expect(page.locator('.detail-card .deva')).to_contain_text('ऎनिक्क्')
    nav(page,'script')
    expect(page.locator('.example-word')).to_have_count(16)
    expect(page.locator('.example-word').filter(has_text='TEACHING EXAMPLE')).to_have_count(3)
    nav(page,'phonetics')
    expect(page.locator('.grammar-card')).to_have_count(6)
    print('PASS: script examples, IPA/Devanagari/gloss, and phonetics material')

    calls=[]
    def generate(route):
        calls.append(route.request.post_data_json)
        route.fulfill(status=200,content_type='audio/wav',body=WAV,headers={'Access-Control-Allow-Origin':'*'})
    page.route('https://bhaasa-speech.test/api/speech',generate)
    page.route('https://bhaasa-speech.test/api/speech/models',lambda route:route.fulfill(json={'models':[{'id':'v1','provider':'fixture','voices':[{'id':'voice-a','gender':'female'}]}]},headers={'Access-Control-Allow-Origin':'*'}))
    nav(page,'audio/food-0')
    page.locator('#voice-form [name="endpoint"]').fill('https://bhaasa-speech.test/api/speech')
    page.locator('[data-audio="discover"]').click()
    expect(page.locator('#model-status')).to_contain_text('1 configured speech models')
    add_profile(page)
    page.locator('#voice-gender-filter').select_option('female')
    assert page.locator('#active-voice').evaluate("e=>[...e.options].filter(o=>!o.hidden).length>=1 && [...e.options].filter(o=>!o.hidden).every(o=>o.dataset.gender==='female')")
    page.locator('[data-audio="play"]').click()
    expect(page.locator('.clip-row')).to_have_count(1)
    assert len(calls)==1 and calls[0]['input']=='വെള്ളം'
    page.locator('[data-audio="play"]').click()
    assert len(calls)==1
    set_offline(context,page,True)
    page.reload()
    expect(page.locator('.clip-row')).to_have_count(1)
    page.locator('[data-audio="play"]').click()
    assert len(calls)==1
    set_offline(context,page,False)
    page.locator('[data-audio="generate"]').click()
    expect(page.locator('.clip-row')).to_contain_text('revision 2')
    assert len(calls)==2 and len(clips(page))==1
    add_profile(page,'v2')
    page.locator('[data-audio="generate"]').click()
    expect(page.locator('.clip-row')).to_have_count(2)
    assert len(calls)==3
    assert {c['model'] for c in clips(page)}=={'v1','v2'}
    with page.expect_download() as download:
        page.locator('[data-audio="export"]').click()
    archive=OUT/'bhaasa-audio.zip';download.value.save_as(archive)
    with zipfile.ZipFile(archive) as z:
        manifest=json.loads(z.read('manifest.json'))
        assert len(manifest['clips'])==2
        assert all('malayalam/words/word/food-0/fixture/' in c['path'] for c in manifest['clips'])
        assert all(z.read(c['path'])==WAV for c in manifest['clips'])
    page.evaluate("async()=>{const {listClips,deleteClip}=await import(new URL('audio-store.js',location.href));for(const c of await listClips())await deleteClip(c.key);localStorage.removeItem('bhaasa.voices.v1');}")
    page.reload()
    expect(page.locator('.clip-row')).to_have_count(0)
    page.locator('#audio-backup').set_input_files(str(archive))
    expect(page.locator('.clip-row')).to_have_count(2)
    expect(page.locator('#toast')).to_contain_text('2 audio clips imported')
    assert page.locator('#active-voice option').count()==4
    page.locator('#audio-backup').set_input_files(str(archive))
    expect(page.locator('#toast')).to_contain_text('0 audio clips imported')
    page.locator('#audio-overwrite').check()
    page.locator('#audio-backup').set_input_files(str(archive))
    expect(page.locator('#toast')).to_contain_text('2 audio clips imported')
    assert all(c['revision']==2 for c in clips(page))
    print('PASS: discover/add models, save on first use, cached offline playback, replacement, model-wise ZIP round-trip')

    page.locator('#active-voice').select_option('human')
    page.locator('#audio-file').set_input_files({'name':'sample.wav','mimeType':'audio/wav','buffer':WAV})
    expect(page.locator('.clip-row')).to_have_count(3)
    page.locator('[data-audio="record"]').click()
    expect(page.locator('[data-audio="stop"]')).to_be_enabled()
    page.wait_for_timeout(550)  # capture a real MediaRecorder chunk from Chromium's test microphone
    page.locator('[data-audio="stop"]').click()
    expect(page.locator('#toast')).to_contain_text('Recording saved')
    human=[c for c in clips(page) if c['provider']=='human'][0]
    assert human['origin']=='microphone' and human['revision']==2 and human['size']>0
    page.locator('#audio-target').select_option('lesson-first-vowels')
    page.locator('#audio-file').set_input_files({'name':'lesson.wav','mimeType':'audio/wav','buffer':WAV})
    expect(page.locator('.clip-row')).to_have_count(4)
    page.locator('#audio-target').select_option('section-phonetics')
    page.locator('#audio-file').set_input_files({'name':'section.wav','mimeType':'audio/wav','buffer':WAV})
    expect(page.locator('.clip-row')).to_have_count(5)
    assert {c['scope'] for c in clips(page)} >= {'word','lesson','section'}
    print('PASS: audio import, microphone recording/replacement, and saving at word, lesson, and section levels')

    for width in (320,390,768,1440):
        page.set_viewport_size({'width':width,'height':900})
        for route in ('script','phonetics','audio','progress','item/phrase-4'):
            nav(page,route)
            if page.locator('.linguistic-details').count():page.locator('.linguistic-details').first.evaluate('e=>e.open=true')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route)
    nav(page,'audio');page.screenshot(path=str(OUT/'audio-library.png'),full_page=True)
    nav(page,'phonetics');page.screenshot(path=str(OUT/'phonetics.png'),full_page=True)
    assert not errors,errors
    print('PASS: expanded content and audio controls fit mobile, tablet, and desktop layouts')

    legacy=browser.new_context()
    legacy.add_init_script("localStorage.setItem('aksharam.progress.v1',JSON.stringify({version:1,items:{'v-0':{attempts:2,correct:1,stage:0,due:100}},lessons:{'first-vowels':0.5},activity:{'2026-11-03':2}}))")
    lp=legacy.new_page();lp.goto(BASE)
    state=lp.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',KEY)
    assert state['version']==2 and state['items']['v-0']['attempts']==2 and state['lessons']['first-vowels']==.5
    print('PASS: automatic migration from the original app preserves prior learning')

    # OpenAI preference: useful presets, an honest connection check, and saved audio.
    openai=context.browser.new_context(accept_downloads=True)
    op=openai.new_page()
    op.goto(BASE+'#audio/food-0')
    expect(op.locator('#openai-model')).to_have_value('gpt-realtime-2.1-mini')
    expect(op.locator('#openai-voice')).to_have_value('marin')
    expect(op.locator('#openai-voice option')).to_have_count(10)
    op.locator('#openai-model').select_option('tts-1')
    expect(op.locator('#openai-voice')).to_have_value('alloy')
    expect(op.locator('#openai-voice option')).to_have_count(6)
    op.locator('.openai-setup details').evaluate('e=>e.open=true')
    expect(op.locator('.openai-setup')).to_contain_text('January 6, 2027')
    op.locator('#openai-model').select_option('gpt-realtime-2.1-mini')
    op.locator('#openai-voice').select_option('cedar')
    op.locator('#openai-endpoint').fill('https://openai-fixture.test/api/speech')
    op.locator('#openai-voice').click()  # commit the endpoint change before rendering a check
    setup={'ready':False,'calls':0}
    def openai_models(route):
        route.fulfill(json={'provider':'openai','configured':setup['ready'],'models':[{'id':'gpt-realtime-2.1-mini','api':'realtime'}] if setup['ready'] else []},headers={'Access-Control-Allow-Origin':'*'})
    def openai_audio(route):
        assert route.request.post_data_json['model']=='gpt-realtime-2.1-mini'
        assert route.request.post_data_json['voice']=='cedar'
        setup['calls']+=1
        route.fulfill(status=200,content_type='audio/wav',body=WAV,headers={'Access-Control-Allow-Origin':'*'})
    op.route('https://openai-fixture.test/api/speech/models',openai_models)
    op.route('https://openai-fixture.test/api/speech',openai_audio)
    op.locator('[data-audio="openai-check"]').click()
    expect(op.locator('#openai-status')).to_contain_text('Add BHAASA_TTS_API_KEY securely')
    assert setup['calls']==0
    setup['ready']=True
    op.locator('[data-audio="openai-check"]').click()
    expect(op.locator('#openai-status')).to_contain_text('no paid request was made')
    op.locator('[data-audio="openai-preset"]').click()
    preferences=op.evaluate("JSON.parse(localStorage.getItem('bhaasa.voices.v1'))")
    selected=next(p for p in preferences['profiles'] if p['id']==preferences['activeId'])
    assert selected['provider']=='openai' and selected['model']=='gpt-realtime-2.1-mini' and selected['voice']=='cedar' and selected['gender']=='unspecified'
    op.locator('[data-audio="play"]').click()
    expect(op.locator('.clip-row')).to_have_count(1)
    assert clips(op)[0]['mime']=='audio/wav' and setup['calls']==1
    op.locator('[data-audio="play"]').click()
    assert setup['calls']==1
    expect(op.locator('#offline-status')).to_have_text('Available offline')
    set_offline(openai,op,True);op.reload()
    expect(op.locator('.clip-row')).to_have_count(1)
    op.locator('[data-audio="play"]').click()
    assert setup['calls']==1
    set_offline(openai,op,False)
    op.screenshot(path=str(OUT/'openai-setup.png'),full_page=True)
    openai.close()
    print('PASS: OpenAI presets, retirement labels, truthful connection check, WAV caching, and offline reuse')
    browser.close()
    print('All Bhaasa feature checks passed. Speech generation used a test service, not a paid provider.')
