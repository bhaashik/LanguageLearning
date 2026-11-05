"""Conjunct/syllable tracing, blind OCR, saved speech, resume and offline help. Fixture APIs only."""
import io
import json
import os
from pathlib import Path
import shutil
import wave
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)
def state(page):return page.evaluate("JSON.parse(localStorage.getItem('bhaasa.progress.v2'))")
def draw(page,paths):
    canvas=page.locator('#writing-canvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
    for path in paths:
        point=path[0];page.mouse.move(box['x']+point['x']/800*box['width'],box['y']+point['y']/600*box['height']);page.mouse.down()
        for point in path[1:]:page.mouse.move(box['x']+point['x']/800*box['width'],box['y']+point['y']/600*box['height'])
        page.mouse.up()
def guide(page,id):return page.evaluate('''async id=>{const d=await(await fetch(new URL('data/tracing-guides.json',location.href))).json();const {fitGuide}=await import(new URL('tracing.js',location.href));return fitGuide(d.guides[id]).paths}''',id)

wav=io.BytesIO()
with wave.open(wav,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(b'\0\0'*2400)
with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox']};executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    if executable:opts['executable_path']=executable
    browser=p.chromium.launch(**opts);context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    calls=[];reading=['മ്മ']
    def ocr(route):
        body=route.request.post_data_json;assert set(body)<={'image','provider','model'} and body['provider']=='gemini'
        assert body['image'].startswith('data:image/png;base64,');calls.append(body)
        route.fulfill(json={'text':reading[0],'legible':True,'provider':'gemini','model':'fixture-vision'})
    page.route('**/api/ocr',ocr)
    page.goto(BASE+'#script');expect(page.locator('#offline-status')).to_have_text('Available offline')
    page.locator('[data-script="Conjuncts"]').click();expect(page.locator('.letter-tile')).to_have_count(32)
    page.locator('a.letter-main[href="#item/cj-12"]').click()
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    draw(page,guide(page,'cj-12'));page.locator('#check-trace').click()
    expect(page.locator('#trace-feedback')).to_contain_text('A good trace')
    page.locator('#ocr-provider').select_option('gemini');page.locator('#check-handwriting').click()
    expect(page.locator('#ocr-feedback')).to_contain_text('you were practising')
    assert state(page)['writing']['cj-12']['ocr']['correct']==1
    print('PASS: added conjunct card, curved guide, tracing check and ink-only OCR')

    nav(page,'script');page.locator('[data-script="Syllables"]').click()
    page.locator('#syllable-base').select_option('cj-0');page.locator('#syllable-pattern').select_option('oo')
    expect(page.locator('.syllable-preview')).to_contain_text('ക്കോ')
    expect(page.locator('[data-syllable]')).to_have_count(14)
    page.reload();expect(page.locator('#syllable-base')).to_have_value('cj-0');expect(page.locator('#syllable-pattern')).to_have_value('oo')
    page.locator('#open-syllable').click();expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    id='syll-cj-0-oo';paths=guide(page,id);assert len(paths)>=2
    draw(page,[paths[0]]);page.locator('#check-trace').click();expect(page.locator('#trace-feedback')).to_contain_text('A few curves')
    draw(page,paths[1:]);page.locator('#check-trace').click();expect(page.locator('#trace-feedback')).to_contain_text('A good trace')
    reading[0]='ക്കോ';page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('you were practising')
    records=state(page)['writing'];assert records[id]['ocr']['correct']==1
    assert records.get('cj-0',{}).get('ocr',{}).get('requests',0)==0
    saved=state(page)['writing'][id];page.reload();expect(page.locator('#trace-feedback')).to_contain_text('Saved tracing check')
    expect(page.locator('#ocr-feedback')).to_contain_text('Saved OCR reading');page.locator('#check-handwriting').click();assert len(calls)==2
    assert state(page)['writing'][id]['draft']==saved['draft']
    print('PASS: conjunct vowel marks, missing-part rejection, full-form recognition, reload and distinct saved scores')

    nav(page,'script');page.locator('#syllable-base').select_option('lab-0');page.locator('#syllable-pattern').select_option('ai')
    expect(page.locator('.syllable-preview')).to_contain_text('പൈ');page.locator('#open-syllable').click()
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:');draw(page,guide(page,'syll-lab-0-ai'))
    page.locator('#check-trace').click();expect(page.locator('#trace-feedback')).to_contain_text('A good trace')
    print('PASS: another consonant with a preposed vowel mark uses the same tracing controls')

    speech_calls=[]
    def speech(route):
        body=route.request.post_data_json;speech_calls.append(body)
        assert body['provider']=='gemini' and body['model']=='gemini-2.5-flash-preview-tts' and body['voice']=='Kore' and body['input']=='പൈ'
        assert 'authorization' not in route.request.headers and 'x-goog-api-key' not in route.request.headers
        route.fulfill(body=wav.getvalue(),content_type='audio/wav')
    page.route('**/api/speech',speech)
    nav(page,'audio/syll-lab-0-ai');form=page.locator('#voice-form')
    for field,value in [('name','Gemini test voice'),('provider','gemini'),('model','gemini-2.5-flash-preview-tts'),('voice','Kore')]:form.locator('[name="'+field+'"]').fill(value)
    form.locator('button[type="submit"]').click();page.locator('[data-audio="generate"]').click()
    expect(page.locator('.clip-row')).to_contain_text('gemini-2.5-flash-preview-tts')
    expect(page.locator('.clip-row')).to_contain_text('syllable');assert len(speech_calls)==1
    context.set_offline(True);page.locator('[data-audio="play"]').click();assert len(speech_calls)==1
    nav(page,'script');page.locator('#syllable-base').select_option('cj-18');page.locator('#syllable-pattern').select_option('ee')
    page.locator('#open-syllable').click();expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    draw(page,guide(page,'syll-cj-18-ee'));page.locator('#check-trace').click();expect(page.locator('#trace-feedback')).to_contain_text('A good trace')
    print('PASS: syllable-specific model/voice audio caching and offline conjunct tracing')

    page.locator('.trace-settings').evaluate('e=>e.open=true')
    with page.expect_popup() as popup:page.locator('a[href="./docs/PROVIDERS.html#ocr"]').click()
    help=popup.value;expect(help.locator('h1')).to_have_text('Set up OCR and speech models')
    expect(help.locator('#gemini-tts')).to_be_visible();assert help.locator('code').filter(has_text='BHAASA_TTS_PROVIDER=gemini').count()>0
    help.close();context.set_offline(False)
    for width in (320,390,768,1440):
        page.set_viewport_size({'width':width,'height':1000});nav(page,'script')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.wait_for_function("getComputedStyle(document.querySelector('#toast')).opacity==='0'")
    page.screenshot(path=str(OUT/'syllables.png'),full_page=True)
    assert not errors,errors;browser.close()
    print('PASS: offline setup guide, responsive builder and no browser errors; APIs used fixtures')
