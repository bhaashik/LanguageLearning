"""Optional real-browser checks for curved tracing and blind OCR. No paid API calls."""
import base64
import io
import json
import os
from pathlib import Path
import shutil
from PIL import Image
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
KEY='bhaasa.progress.v2'

def state(page):return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',KEY)
def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)
def guides(page,id):
    return page.evaluate('''async id=>{const d=await (await fetch(new URL('data/tracing-guides.json',location.href))).json();const {fitGuide}=await import(new URL('tracing.js',location.href));return fitGuide(d.guides[id]).paths}''',id)
def draw(page,paths):
    canvas=page.locator('#writing-canvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
    for path in paths:
        p=path[0];page.mouse.move(box['x']+p['x']/800*box['width'],box['y']+p['y']/600*box['height']);page.mouse.down()
        for p in path[1:]:page.mouse.move(box['x']+p['x']/800*box['width'],box['y']+p['y']/600*box['height'])
        page.mouse.up()

with sync_playwright() as p:
    options={'headless':True,'args':['--no-sandbox']};executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    if executable:options['executable_path']=executable
    browser=p.chromium.launch(**options)
    context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#item/vel-0')
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide: 1 continuous stroke')
    expect(page.locator('#offline-status')).to_have_text('Available offline')
    expect(page.locator('#check-trace')).to_be_disabled();expect(page.locator('#check-handwriting')).to_be_disabled()
    expect(page.locator('#trace-status')).to_contain_text('Draw over the pale guide')
    page.locator('#demo-trace').click();expect(page.locator('#demo-trace')).to_have_text('Stop demonstration')
    page.locator('#demo-trace').click();expect(page.locator('#demo-trace')).to_have_text('Watch the strokes')
    scribble=[[{'x':100 if i%2==0 else 700,'y':100+i*12} for i in range(25)]]
    draw(page,scribble);page.locator('#check-trace').click()
    expect(page.locator('#trace-feedback h3')).to_have_text('A few curves to revisit.')
    assert state(page)['writing']['vel-0']['last']['fit']<.5
    page.locator('[data-action="clear-canvas"]').click()
    template=guides(page,'vel-0');draw(page,template)
    page.locator('#check-trace').click()
    expect(page.locator('#trace-feedback h3')).to_have_text('A good trace of this guide.')
    before=state(page);assert before['writing']['vel-0']['bestFit']>.97
    page.locator('#check-trace').click()
    assert state(page)['writing']['vel-0']['attempts']==2
    page.reload();expect(page.locator('#trace-plan')).to_contain_text('1 drawn')
    expect(page.locator('#trace-feedback')).to_contain_text('Saved tracing check')
    page.locator('#check-trace').click();assert state(page)['writing']['vel-0']['attempts']==2
    assert state(page)['items']=={},'handwriting must not alter quiz scores'
    print('PASS: curved demo, scribble rejection, good tracing, draft resume, and no duplicate score')

    calls=[];reply={'text':'മ','legible':True};pending=[]
    def recognize(route):
        body=route.request.post_data_json
        assert set(body)<= {'image','provider','model'} and body.get('provider')=='openai','only ink and recognition settings may be sent'
        raw=base64.b64decode(body['image'].split(',')[1]);image=Image.open(io.BytesIO(raw)).convert('RGB')
        assert image.size==(512,512)
        pixels=image.tobytes()
        assert pixels[0::3]==pixels[1::3]==pixels[2::3],'guide, markers, or colored paper leaked into OCR'
        assert sum(r<128 for r in pixels[0::3])>100
        calls.append(body)
        if reply.get('delay'):pending.append(route)
        else:route.fulfill(status=reply.get('status',200),json={k:v for k,v in reply.items() if k not in ('status','delay')})
    page.route('**/api/ocr',recognize)
    page.locator('#check-handwriting').click()
    expect(page.locator('#ocr-feedback')).to_contain_text('different symbol')
    assert state(page)['writing']['vel-0']['ocr']['correct']==0
    page.locator('#check-handwriting').click();assert len(calls)==1
    page.reload();expect(page.locator('#ocr-feedback')).to_contain_text('Saved OCR reading')
    page.locator('#check-handwriting').click();assert len(calls)==1
    page.locator('[data-action="undo-stroke"]').click();draw(page,template)
    reply.update(text='ക',legible=True)
    page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('you were practising')
    assert state(page)['writing']['vel-0']['ocr']['correct']==1
    page.locator('[data-action="undo-stroke"]').click();draw(page,template)
    reply.update(text=None,legible=False)
    page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('could not be read reliably')
    o=state(page)['writing']['vel-0']['ocr'];assert o['requests']==3 and o['judged']==2 and o['correct']==1
    print('PASS: ink-only blind OCR, mismatch/match feedback, uncertain readings, and no repeated paid request')

    page.locator('[data-action="undo-stroke"]').click();draw(page,template)
    reply.update(text='ക',legible=True,delay=True)
    page.locator('#check-handwriting').click()
    expect(page.locator('#check-handwriting')).to_be_disabled()
    draw(page,[[{'x':150,'y':150},{'x':170,'y':180},{'x':200,'y':150}]])
    expect(page.locator('#check-handwriting')).to_be_disabled()
    assert len(pending)==1
    pending.pop().fulfill(json={'text':'ക','legible':True})
    expect(page.locator('#toast')).to_contain_text('drawing changed')
    assert state(page)['writing']['vel-0']['ocr']['requests']==3
    reply.update(delay=False,status=503)
    page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('selected OCR provider is not configured')
    assert state(page)['writing']['vel-0']['ocr']['requests']==3
    page.locator('#check-trace').click();expect(page.locator('#trace-feedback')).to_be_visible()
    print('PASS: edits during OCR discard stale results; missing gateway does not block local tracing')

    page.locator('[data-action="clear-canvas"]').click();draw(page,template)
    page.locator('.trace-settings').evaluate('e=>e.open=true')
    with page.expect_download() as download:page.locator('#export-trace').click()
    trace=OUT/'ka-stroke-guide.json';download.value.save_as(trace)
    exported=json.loads(trace.read_text());assert exported['itemId']=='vel-0' and len(exported['paths'])==1
    page.locator('#import-stroke-guide').set_input_files(str(trace))
    expect(page.locator('#trace-plan')).to_contain_text('Custom guide:')
    assert state(page)['writing']['vel-0']['customGuide']['source']=='imported practice guide'
    page.locator('#use-font-guide').click();expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    assert state(page)['writing']['vel-0']['customGuide'] is None
    bad={**exported,'ml':'മ'}
    page.locator('#import-stroke-guide').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
    expect(page.locator('#toast')).to_contain_text('exact symbol')
    print('PASS: stroke export, custom guide import, font-guide restore, and wrong-symbol guide rejection')

    context.set_offline(True)
    nav(page,'item/sign-7');expect(page.locator('#trace-plan')).to_contain_text('2 continuous strokes')
    multi=guides(page,'sign-7');draw(page,[multi[0]])
    page.locator('#check-trace').click();expect(page.locator('#trace-feedback h3')).to_have_text('A few curves to revisit.')
    draw(page,[multi[1]]);page.locator('#check-trace').click();expect(page.locator('#trace-feedback h3')).to_have_text('A good trace of this guide.')
    page.reload();expect(page.locator('#trace-plan')).to_contain_text('2 drawn')
    page.locator('#check-trace').click();assert state(page)['writing']['sign-7']['attempts']==2
    nav(page,'progress');expect(page.locator('.writing-summary')).to_contain_text('Drawing practice')
    expect(page.locator('.writing-records a')).to_have_count(2)
    context.set_offline(False)
    print('PASS: offline multi-part tracing, missing-vowel-mark detection, saved drafts, and separate writing progress')

    for width in (320,390,768,1440):
        page.set_viewport_size({'width':width,'height':1000})
        nav(page,'item/vel-0');expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
        page.locator('.trace-settings').evaluate('e=>e.open=true')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.screenshot(path=str(OUT/'tracing.png'),full_page=True)
    assert not errors,errors
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mp=mobile.new_page();mp.goto(BASE+'#item/vel-0');expect(mp.locator('#trace-plan')).to_contain_text('Suggested guide:')
    points=guides(mp,'vel-0')[0];mp.locator('#writing-canvas').scroll_into_view_if_needed();box=mp.locator('#writing-canvas').bounding_box()
    cdp=mobile.new_cdp_session(mp)
    def touch(phase,point=None):
        cdp.send('Input.dispatchTouchEvent',{'type':phase,'touchPoints':[] if point is None else [{'x':box['x']+point['x']/800*box['width'],'y':box['y']+point['y']/600*box['height'],'id':1}]})
    touch('touchStart',points[0])
    for point in points[1:]:touch('touchMove',point)
    touch('touchEnd')
    mp.locator('#check-trace').click();expect(mp.locator('#trace-feedback h3')).to_have_text('A good trace of this guide.')
    mp.screenshot(path=str(OUT/'tracing-mobile.png'),full_page=True)
    print('PASS: responsive pad and continuous finger tracing with native touch events')

    recovery=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
    rp=recovery.new_page();guide_requests=[];ocr_requests=[];fail_guide=[True]
    def guide_response(route):
        guide_requests.append(route.request.url)
        if fail_guide[0]:route.fulfill(status=503,body='Temporarily unavailable')
        else:route.continue_()
    rp.route('**/data/tracing-guides.json',guide_response)
    rp.on('request',lambda r:ocr_requests.append(r.url) if '/api/ocr' in r.url else None)
    rp.goto(BASE+'#item/vel-0')
    expect(rp.locator('#retry-trace-guide')).to_be_visible()
    expect(rp.locator('#trace-status')).to_contain_text('practice guide is unavailable')
    expect(rp.locator('#check-trace')).to_be_disabled();expect(rp.locator('#demo-trace')).to_be_disabled()
    draw(rp,template);saved=state(rp)['writing']['vel-0']
    rp.locator('#retry-trace-guide').click();expect(rp.locator('#retry-trace-guide')).to_be_enabled()
    assert len(guide_requests)==2,'a failed download must not remain cached as a rejected promise'
    fail_guide[0]=False
    rp.locator('#retry-trace-guide').click()
    expect(rp.locator('#trace-status')).to_contain_text('No API key or gateway is needed')
    expect(rp.locator('#retry-trace-guide')).to_be_hidden()
    expect(rp.locator('#check-trace')).to_be_enabled()
    assert state(rp)['writing']['vel-0']['draft']==saved['draft']
    assert state(rp)['writing']['vel-0']['draftId']==saved['draftId']
    rp.locator('#ocr-provider').select_option('none')
    rp.locator('#check-trace').click();expect(rp.locator('#trace-feedback')).to_contain_text('A good trace')
    assert state(rp)['writing']['vel-0']['attempts']==1 and not ocr_requests
    rp.locator('[data-action="clear-canvas"]').click()
    expect(rp.locator('#trace-status')).to_contain_text('Draw over the pale guide')
    draw(rp,[[{'x':100,'y':100},{'x':105,'y':105}]])
    expect(rp.locator('#check-trace')).to_be_disabled()
    expect(rp.locator('#trace-status')).to_contain_text('tap or short line is too small')
    rp.locator('.trace-settings').evaluate('e=>e.open=true')
    expect(rp.locator('#ocr-gateway-help')).to_contain_text('http://127.0.0.1:4173/api/ocr')
    assert rp.evaluate('document.documentElement.scrollWidth<=innerWidth')
    rp.screenshot(path=str(OUT/'tracing-readiness.png'),full_page=True)
    recovery.close()
    print('PASS: visible readiness reasons, repeated guide retry without lost ink, and tracing without a gateway')
    browser.close()
    print('All tracing browser checks passed. OCR responses were test fixtures, not paid OpenAI calls.')
