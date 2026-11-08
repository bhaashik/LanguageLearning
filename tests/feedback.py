"""In-app feedback and Google receipt flow. All Google responses are fixtures.
No Google deployment, spreadsheet, or paid speech/vision API is contacted.
"""
import json
import os
import shutil
from pathlib import Path
from urllib.parse import parse_qs,quote,urlsplit
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
URL='https://script.google.com/macros/s/test-deployment/exec'
KEY='bhaasa.feedback.v1'
VERSION=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']

def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)
def reports(page):return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))?.reports||[]',KEY)
def choose(page):
    page.locator('#feedback-feature-lessons').select_option('worked')
    page.locator('#feedback-ease').select_option('easy')
def collector(page):
    page.locator('.feedback-settings summary').click()
    page.locator('#feedback-collector').fill(URL)
    page.locator('#feedback-settings-form button[type="submit"]').click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    c=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,service_workers='block')
    page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    mode={'value':'ok'};calls=[];rows={}
    def google(route):
        if route.request.method!='POST':route.fulfill(status=404);return
        payload=json.loads(parse_qs(route.request.post_data)['payload'][0]);calls.append(payload)
        assert set(payload)=={'requestId','report'}
        report=payload['report'];assert set(report)=={'id','createdAt','appVersion','language','platform','system','answers'}
        assert report['id']!=payload['requestId'];assert report['appVersion']==VERSION
        duplicate=report['id'] in rows;rows[report['id']]=report
        if mode['value']=='error':
            result={'ok':False,'code':'write_failed'}
        else:result={'ok':True,'receivedAt':'2026-11-06T12:00:00.000Z','duplicate':duplicate}
        receipt={'type':'bhaasa-feedback-receipt-v1','requestId':payload['requestId'],'reportId':report['id'],**result}
        if mode['value']=='wrong_nonce':receipt['requestId']='unrelated-nonce'
        if mode['value']=='html_only':route.fulfill(content_type='text/html',body='<p>Request received. No validated receipt.</p>');return
        # Use a nested HtmlService-like Google frame to exercise source ancestry.
        target='https://n-fixture-script.googleusercontent.com/receipt?data='+quote(json.dumps(receipt))
        route.fulfill(content_type='text/html',body=f'<iframe src="{target}"></iframe>')
    def receipt_frame(route):
        receipt=json.loads(parse_qs(urlsplit(route.request.url).query)['data'][0])
        route.fulfill(content_type='text/html',body='<script>top.postMessage('+json.dumps(receipt)+',"*")</script>')
    page.route('https://script.google.com/**',google)
    page.route('https://n-fixture-script.googleusercontent.com/**',receipt_frame)
    page.goto(BASE+'#feedback')
    expect(page.locator('h1')).to_have_text('Give feedback')
    expect(page.locator('[name^="feature-"]')).to_have_count(8)
    assert all(select.input_value()=='not_tried' for select in page.locator('[name^="feature-"]').all())
    choose(page);page.locator('[name="issue"][value="audio"]').check();page.locator('[name="issue"][value="none"]').check()
    expect(page.locator('[name="issue"][value="audio"]')).not_to_be_checked()
    page.locator('[name="issue"][value="slow"]').check();expect(page.locator('[name="issue"][value="none"]')).not_to_be_checked()
    page.locator('#feedback-comment').fill('<img src=x onerror=alert(1)> Test note')
    page.reload();expect(page.locator('#feedback-comment')).to_have_value('<img src=x onerror=alert(1)> Test note')
    expect(page.locator('#feedback-ease')).to_have_value('easy')
    page.locator('#feedback-save').click();expect(page.locator('#feedback-status')).to_contain_text('saved on this device')
    assert len(reports(page))==1 and reports(page)[0]['delivery']['status']=='local';assert not calls
    expect(page.locator('#feedback-feature-lessons')).to_have_value('not_tried')
    with page.expect_download() as download:page.locator('[data-feedback="export"]').click()
    assert '<img src=x onerror=alert(1)> Test note' in open(download.value.path()).read()
    assert not page.locator('#feedback-reports img').count()
    print('PASS: option-based form, per-language draft resume, exclusive issue choices, local save and text export')

    collector(page);assert not calls
    page.locator('[data-feedback="retry"]').click()
    expect(page.locator('.feedback-delivery')).to_contain_text('Collector confirmed receipt')
    assert reports(page)[0]['delivery']['status']=='confirmed';assert len(rows)==1
    choose(page);page.locator('#feedback-comment').fill('');page.locator('#feedback-save').click()
    expect(page.locator('#feedback-status')).to_contain_text('confirmed receipt');assert len(rows)==2
    assert calls[-1]['report']['answers']['comment']==''
    print('PASS: no submission on configuration; validated Google nested-frame receipt confirms a Sheet write')

    # A row can reach Google while its receipt is lost. Retry must retain its ID.
    mode['value']='wrong_nonce';choose(page);page.locator('#feedback-save').click()
    expect(page.locator('[data-feedback="cancel"]')).to_be_visible()
    page.wait_for_function('document.querySelectorAll("iframe").length>0')
    page.wait_for_timeout(200)
    assert reports(page)[0]['delivery']['status']=='pending'
    page.locator('[data-feedback="cancel"]').click();expect(page.locator('#feedback-status')).to_contain_text('cancelled')
    assert reports(page)[0]['delivery']['status']=='unconfirmed'
    saved_id=reports(page)[0]['id'];before=len(rows)
    mode['value']='ok';page.locator('[data-feedback="retry"]').click()
    expect(page.locator('[data-report="'+saved_id+'"] .feedback-delivery')).to_contain_text('confirmed receipt')
    assert len(rows)==before;assert calls[-1]['report']['id']==saved_id
    print('PASS: wrong nonce cannot confirm; explicit retry keeps the report ID and deduplicates a lost receipt')

    mode['value']='html_only';choose(page);page.locator('#feedback-save').click()
    expect(page.locator('[data-feedback="cancel"]')).to_be_visible()
    page.wait_for_timeout(150);assert reports(page)[0]['delivery']['status']=='pending'
    page.evaluate("window.dispatchEvent(new MessageEvent('message',{origin:'https://evil.example',data:{type:'bhaasa-feedback-receipt-v1',ok:true}}))")
    assert reports(page)[0]['delivery']['status']=='pending'
    nav(page,'learn');nav(page,'feedback');expect(page.locator('.feedback-delivery').first).to_contain_text('not confirmed')
    mode['value']='error';page.locator('[data-feedback="retry"]').first.click()
    expect(page.locator('#feedback-status')).to_contain_text('did not confirm saving')
    assert reports(page)[0]['delivery']['status']=='unconfirmed'
    mode['value']='html_only'
    timeout=page.evaluate('''async url=>{const {sendToAppsScript}=await import('./feedback-transport.js');const {readReports}=await import('./feedback.js');try{await sendToAppsScript(readReports()[0],url,{timeoutMs:150});return ''}catch(e){return e.message}}''',URL)
    assert 'did not confirm receipt' in timeout
    print('PASS: HTML-only/forged/error responses and navigation/timeouts keep reports unconfirmed')

    page.locator('#feedback-collector').evaluate("el=>el.closest('details').open=true")
    page.locator('#feedback-collector').fill('https://docs.google.com/spreadsheets/d/demo/edit')
    page.locator('#feedback-settings-form button[type="submit"]').click()
    expect(page.locator('#feedback-status')).to_contain_text('script.google.com')
    assert page.evaluate("localStorage.getItem('bhaasa.feedback.collector.v1')")==URL
    # Disable centrally collected feedback and verify offline local saving.
    page.locator('#feedback-collector').fill('');page.locator('#feedback-settings-form button[type="submit"]').click()
    c.set_offline(True);choose(page);page.locator('#feedback-save').click();expect(page.locator('#feedback-status')).to_contain_text('saved on this device')
    c.set_offline(False)
    # Sharing uses the existing mobile file bridge rather than a browser download.
    page.evaluate("window.shared=[];window.BhaasaNative={isNative:true,platform:'android',exportFile:async (blob,name)=>shared.push({text:await blob.text(),name})}")
    page.locator('[data-feedback="export"]').first.click();page.wait_for_function('shared.length===1');assert 'Bhaasa tester feedback' in page.evaluate('shared[0].text')
    page.evaluate('delete window.BhaasaNative')
    with page.expect_download() as download:page.locator('[data-feedback="export-all"]').click()
    assert json.load(open(download.value.path()))['format']=='bhaasa-feedback-v1'
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':950})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        assert page.locator('a[href="#feedback"]').is_visible()
    print('PASS: invalid collector rejected, offline saving, native sharing, batch export, and responsive layouts')

    page.locator('#language-choice').select_option('fr');page.wait_for_function("document.querySelector('#language-choice').value==='fr'")
    nav(page,'feedback');expect(page.locator('#feedback-feature-tracing')).to_have_count(0)
    expect(page.locator('[name^="feature-"]')).to_have_count(7)
    choose(page);page.locator('#feedback-save').click()
    assert reports(page)[0]['language']=='fr' and reports(page)[0]['answers']['features']['tracing']=='not_tried'
    page.on('dialog',lambda dialog:dialog.accept())
    count=len(reports(page));page.locator('[data-feedback="delete"]').first.click();assert len(reports(page))==count-1
    page.evaluate('''()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='bhaasa.feedback.v1')throw new DOMException('Full','QuotaExceededError');return window.originalSet.call(this,k,v)}}''')
    choose(page);page.locator('#feedback-save').click();expect(page.locator('#feedback-status')).to_contain_text('could not be saved')
    assert len(reports(page))==count-1
    assert page.locator('#feedback-ease').input_value()=='easy'
    assert not errors,errors
    print('PASS: French form, local-only removal and storage failure preserve unsaved answers; no page errors')
    browser.close()
