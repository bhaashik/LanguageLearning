"""Provider switching, caching and cancellation in a real browser. No external API calls."""
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
def state(page):return page.evaluate("JSON.parse(localStorage.getItem('bhaasa.progress.v2')).writing['vel-0']")
def settings(page):page.locator('.trace-settings').evaluate('e=>e.open=true')
def model(page,value):
    page.locator('#ocr-model').fill(value);page.locator('#ocr-model').press('Tab')

with sync_playwright() as p:
    opts={'headless':True,'args':['--no-sandbox']}
    executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    if executable:opts['executable_path']=executable
    browser=p.chromium.launch(**opts)
    context=browser.new_context(viewport={'width':1440,'height':1050})
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#item/vel-0')
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    paths=page.evaluate('''async()=>{const d=await(await fetch(new URL('data/tracing-guides.json',location.href))).json();const {fitGuide}=await import(new URL('tracing.js',location.href));return fitGuide(d.guides['vel-0']).paths}''')
    canvas=page.locator('#writing-canvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
    for path in paths:
        point=path[0];page.mouse.move(box['x']+point['x']/800*box['width'],box['y']+point['y']/600*box['height']);page.mouse.down()
        for point in path[1:]:page.mouse.move(box['x']+point['x']/800*box['width'],box['y']+point['y']/600*box['height'])
        page.mouse.up()
    page.locator('#check-trace').click();expect(page.locator('#trace-feedback')).to_contain_text('A good trace')
    draft=state(page)['draft'];drawing_id=state(page)['draftId']
    calls=[];checks=[];catalog_checks=[];pending=[];reply={'text':'ക','legible':True}
    def route_ocr(route):
        if route.request.method=='GET':
            if 'action=models' in route.request.url:
                catalog_checks.append(route.request.url)
                assert 'provider=gemini' in route.request.url
                assert 'x-goog-api-key' not in route.request.headers and 'authorization' not in route.request.headers
                route.fulfill(json={'provider':'gemini','configuredModel':'vision-a','configuredModelListed':True,'models':['vision-a','vision-c'],'complete':True});return
            checks.append(route.request.url)
            route.fulfill(json={'providers':[{'id':id,'configured':True,'model':'vision-a','models':['vision-a','vision-b']} for id in ['openai','gemini','anthropic','compatible']]});return
        body=route.request.post_data_json;calls.append(body)
        assert set(body)<= {'image','provider','model'}
        if reply.get('delay'):pending.append(route);return
        result={k:v for k,v in reply.items() if k not in ('status','delay')}
        result.setdefault('provider',body.get('provider','custom'));result.setdefault('model',body.get('model','vision-a'))
        route.fulfill(status=reply.get('status',200),json=result)
    page.route('**/api/ocr*',route_ocr);page.route('**/custom-ocr',route_ocr)
    settings(page);page.locator('#ocr-check-connection').click()
    expect(page.locator('#ocr-connection-status')).to_contain_text('No recognition request was made')
    expect(page.locator('#ocr-connection-status')).to_contain_text('Server default: vision-a')
    expect(page.locator('#ocr-connection-status')).to_contain_text('Enabled models: vision-a, vision-b')
    expect(page.locator('#ocr-model-options option')).to_have_count(2);assert not calls and len(checks)==1
    model(page,'vision-a')
    for provider,label in [('openai','OpenAI'),('gemini','Google Gemini'),('anthropic','Anthropic Claude'),('compatible','Local / OpenAI-compatible')]:
        page.locator('#ocr-provider').select_option(provider);model(page,'vision-a')
        page.locator('#check-handwriting').click()
        expect(page.locator('#ocr-feedback')).to_contain_text('you were practising')
        expect(page.locator('#ocr-feedback')).to_contain_text('Source: '+label)
        assert calls[-1]['provider']==provider and calls[-1]['model']=='vision-a'
        assert state(page)['draft']==draft and state(page)['draftId']==drawing_id
    assert len(calls)==4 and state(page)['ocr']['requests']==4
    page.locator('#ocr-provider').select_option('openai')
    expect(page.locator('#ocr-feedback')).to_contain_text('Saved OCR reading')
    page.locator('#check-handwriting').click();assert len(calls)==4
    page.reload();expect(page.locator('#ocr-feedback')).to_contain_text('Saved OCR reading')
    page.locator('#check-handwriting').click();assert len(calls)==4
    settings(page);page.locator('#ocr-force-recheck').check();page.locator('#check-handwriting').click()
    expect(page.locator('#ocr-feedback')).to_contain_text('you were practising')
    assert len(calls)==5 and state(page)['ocr']['requests']==5
    expect(page.locator('#ocr-force-recheck')).not_to_be_checked()
    model(page,'vision-b');page.locator('#check-handwriting').click()
    expect(page.locator('#ocr-feedback')).to_contain_text('vision-b');assert len(calls)==6
    print('PASS: four providers, connection discovery, retained ink, per-model cache, reload and explicit fresh requests')

    page.locator('#ocr-provider').select_option('custom')
    expect(page.locator('#ocr-model')).to_be_disabled()
    settings(page);page.locator('#ocr-endpoint').fill(BASE+'custom-ocr');page.locator('#ocr-endpoint').press('Tab')
    page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('Source: Custom OCR endpoint')
    assert list(calls[-1])==['image'] and len(calls)==7
    page.locator('#ocr-provider').select_option('gemini');expect(page.locator('#ocr-model')).to_have_value('vision-a')
    model(page,'models/vision-a');settings(page);page.locator('#ocr-check-connection').click()
    expect(page.locator('#ocr-connection-status')).to_contain_text('Google Gemini is configured')
    page.locator('#ocr-list-gemini-models').click()
    expect(page.locator('#ocr-connection-status')).to_contain_text('Google lists vision-a')
    expect(page.locator('#ocr-connection-status')).to_contain_text('vision-c')
    expect(page.locator('#ocr-model-options option')).to_have_count(2)
    assert page.locator('#ocr-model-options option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')==['vision-a','vision-b'],'Google listing must not silently allow new models'
    assert len(catalog_checks)==1 and len(calls)==7 and state(page)['ocr']['requests']==7
    model(page,'vision-b');reply.update(status=503)
    page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('selected OCR provider is not configured')
    assert len(calls)==8 and state(page)['ocr']['requests']==7
    for status,code,fragment in [
        (400,'model_not_allowed','No provider request was made'),
        (400,'invalid_model_id','not an API model ID'),
        (400,'invalid_credentials','rejected the API key'),
        (400,'provider_request_invalid','error came from the provider'),
        (404,'provider_model_unavailable','could not find or access that model'),
        (429,'provider_quota_exceeded','exhausted quota'),
        (503,'provider_unavailable','temporarily unavailable'),
        (502,'provider_unavailable','temporarily unavailable'),
        (502,'recognition_token_limit','stopped at the output-token limit'),
        (502,'recognition_invalid_json','required JSON transcription'),
        (502,'recognition_invalid_result','required Malayalam transcription format'),
        (502,'recognition_no_result','returned no transcription text'),
        (502,'recognition_blocked','filtered this recognition response'),
        (502,'recognition_incomplete','without a completed transcription'),
        (504,'ocr_timeout','timed out waiting'),
        (502,'ocr_connection_failed','could not complete its connection'),
        (502,'ocr_gateway_failed','local gateway failure')
    ]:
        reply.update(status=status,error=code,models=['vision-a'])
        page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text(fragment)
        assert state(page)['ocr']['requests']==7 and state(page)['draft']==draft
    reply.pop('error');reply.pop('models')
    reply.update(status=200,provider='openai')
    page.locator('#check-handwriting').click();expect(page.locator('#ocr-feedback')).to_contain_text('different provider')
    assert state(page)['ocr']['requests']==7
    reply.pop('provider');reply.update(delay=True)
    page.locator('#check-handwriting').click();expect(page.locator('#check-handwriting')).to_be_disabled()
    assert len(pending)==1
    page.locator('#ocr-provider').select_option('anthropic')
    expect(page.locator('#check-handwriting')).to_be_enabled()
    pending.pop().fulfill(json={'text':'മ','legible':True,'provider':'gemini'})
    expect(page.locator('#ocr-feedback')).to_contain_text('Source: Anthropic Claude')
    assert state(page)['ocr']['requests']==7 and state(page)['draft']==draft
    print('PASS: read-only Gemini model listing with unchanged allowlist, drawing and scores')
    print('PASS: distinct local/upstream errors, no false gateway-not-found or missing-key error, retained ink and scores')
    print('PASS: custom image-only contract, no silent fallback, provider mismatch rejection and cancellation')

    page.locator('#ocr-provider').select_option('none')
    expect(page.locator('#check-handwriting')).to_be_disabled();expect(page.locator('#check-trace')).to_be_enabled()
    page.locator('#check-trace').click();assert state(page)['attempts']==1
    page.reload();expect(page.locator('#ocr-provider')).to_have_value('none')
    expect(page.locator('#check-handwriting')).to_be_disabled()
    page.locator('#ocr-provider').select_option('custom');settings(page)
    expect(page.locator('#ocr-endpoint')).to_have_value(BASE+'custom-ocr')
    expect(page.locator('#ocr-feedback')).to_contain_text('Saved OCR reading')
    for width in (320,390,768,1440):
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.screenshot(path=str(OUT/'ocr-providers.png'),full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: persistent tracing-only mode, independent endpoint profiles and responsive provider controls')
