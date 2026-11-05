"""Shared mobile UI smoke test with mocked native plugins; no physical device or paid calls."""
import io
import os
import shutil
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
OUT=Path(__file__).resolve().parents[1]/'test-results';OUT.mkdir(exist_ok=True)

def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':412,'height':915},has_touch=True,is_mobile=True)
    context.add_init_script('''
      window.nativeCalls={voices:0,speech:[],stops:0,exports:[]};
      window.BhaasaNative={isNative:true,platform:'android',
        getVoices:async()=>{nativeCalls.voices++;return [{name:'Malayalam fixture',voiceURI:'ml-fixture',lang:'ml-IN',localService:true}]},
        speak:async options=>nativeCalls.speech.push(options),stopSpeech:async()=>{nativeCalls.stops++},
        exportFile:async(blob,name)=>nativeCalls.exports.push({name,size:blob.size,text:blob.type==='application/json'?await blob.text():null})};
    ''')
    page=context.new_page();errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE+'#item/vel-0')
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    expect(page.locator('#offline-status')).to_have_text('Available offline')
    assert page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)')==0
    assert page.locator('#ocr-endpoint').input_value()==''
    expect(page.locator('#ocr-gateway-help')).to_contain_text('HTTPS')
    page.locator('[data-speak="vel-0"]').first.click()
    page.wait_for_function('nativeCalls.speech.length===1')
    assert page.evaluate('nativeCalls.speech[0].voice')=='ml-fixture'
    # Pen events exercise the same tracing handler used by native touch input.
    page.locator('#writing-canvas').evaluate('''canvas=>{
      const r=canvas.getBoundingClientRect();
      for(let i=0;i<30;i++)canvas.dispatchEvent(new PointerEvent(i===0?'pointerdown':i===29?'pointerup':'pointermove',{
        pointerId:1,pointerType:'touch',isPrimary:true,buttons:i===29?0:1,clientX:r.x+25+i*3,clientY:r.y+40+i*2,bubbles:true}));
    }''')
    expect(page.locator('#export-trace')).to_be_enabled()
    page.locator('.trace-settings summary').click()
    page.locator('#export-trace').click()
    page.wait_for_function('nativeCalls.exports.length===1')
    assert 'strokes' in page.evaluate('nativeCalls.exports[0].name')
    nav(page,'progress')
    page.locator('[data-action="export"]').click()
    page.wait_for_function('nativeCalls.exports.length===2')
    assert page.evaluate('JSON.parse(nativeCalls.exports[1].text).writing["vel-0"].draft.length')>0
    nav(page,'audio/vel-0')
    expect(page.locator('#openai-endpoint')).to_have_value('')
    expect(page.locator('#voice-form [name="endpoint"]')).to_have_value('')
    page.locator('#openai-endpoint').fill('http://127.0.0.1:4173/api/speech')
    page.locator('[data-audio="openai-preset"]').click()
    expect(page.locator('#toast')).to_contain_text('this phone')
    # Human/file audio and ZIP export stay available without a gateway.
    page.locator('#active-voice').select_option('human')
    stream=io.BytesIO()
    with wave.open(stream,'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000);wav.writeframes(b'\0\0'*1600)
    page.locator('#audio-file').set_input_files({'name':'fixture.wav','mimeType':'audio/wav','buffer':stream.getvalue()})
    expect(page.locator('[data-audio="export"]')).to_be_enabled()
    page.locator('[data-audio="export"]').click()
    page.wait_for_function('nativeCalls.exports.length===3')
    assert page.evaluate('nativeCalls.exports[2].name')=='bhaasa-malayalam-audio.zip'
    page.evaluate("window.dispatchEvent(new Event('bhaasa:pause'))")
    assert page.evaluate('nativeCalls.stops')>0
    nav(page,'about')
    link=page.get_by_role('link',name='Mobile build & setup guide')
    assert link.get_attribute('target') is None
    link.click();expect(page.locator('h1')).to_have_text('Bhaasa on Android and iOS')
    assert not errors,errors
    context.close();browser.close()
    print('PASS: mobile defaults, native Malayalam speech, touch draft, shared progress/strokes/audio backups, pause, and help navigation (mock plugins)')
