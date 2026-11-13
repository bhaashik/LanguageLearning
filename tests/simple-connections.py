"""One gateway setup on the built Pages app and local web, using fixtures only."""
import json
import mimetypes
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
PUBLIC='https://bhaashik.github.io/LanguageLearning/'
LOCAL=os.environ.get('BHAASA_URL','http://127.0.0.1:4185/LanguageLearning/').rstrip('/')+'/'
GATEWAY='https://gateway.bhaasa.test'
ACCESS='simple_connection_fixture_access_'.ljust(64,'x')
calls=[];modes={};pending=[]

def assets(route):
    name=urlsplit(route.request.url).path.removeprefix('/LanguageLearning/') or 'index.html'
    target=(ROOT/'dist'/name).resolve()
    if not target.is_relative_to((ROOT/'dist').resolve()) or not target.is_file():route.fulfill(status=404);return
    route.fulfill(content_type=mimetypes.guess_type(target)[0] or 'application/octet-stream',body=target.read_bytes())
def gateway(route):
    req=route.request;path=urlsplit(req.url).path
    headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Accept,X-Bhaasa-Gateway-Token','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}
    if req.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
    calls.append({'path':path,'method':req.method,'authorized':req.headers.get('x-bhaasa-gateway-token')==ACCESS,'local':urlsplit(req.url).hostname=='127.0.0.1'})
    assert req.method=='GET','Setup must not generate paid content'
    if urlsplit(req.url).hostname=='127.0.0.1':assert 'x-bhaasa-gateway-token' not in req.headers
    elif req.headers.get('x-bhaasa-gateway-token')!=ACCESS:route.fulfill(status=401,json={'error':'gateway_access_required'},headers=headers);return
    mode=modes.get(path)
    if mode=='pending':pending.append(route);return
    if mode=='html':route.fulfill(content_type='text/html',body='<html>Not a model API</html>',headers=headers);return
    if mode=='network':route.abort('accessdenied');return
    if path=='/api/speech/models':data={'configured':True,'provider':'gemini','models':[{'id':'tts-a','voices':[{'id':'Kore'}]},{'id':'tts-b','voices':[{'id':'Aoede'},{'id':'Kore'}]}]}
    else:data={'provider':'gemini','providers':[{'id':'openai','configured':False,'models':[]},{'id':'gemini','configured':mode!='unconfigured','model':'vision-a' if path=='/api/ocr' else 'asr-a','models':['vision-a','vision-b'] if path=='/api/ocr' else ['asr-a','asr-b']}]}
    route.fulfill(json=data,headers=headers)
def context_for(browser,state=None):
    ctx=browser.new_context(viewport={'width':834,'height':1194},service_workers='block',accept_downloads=True,locale='en-GB',timezone_id='Asia/Kolkata',**({'storage_state':state} if state else {}))
    ctx.route(PUBLIC+'**',assets);ctx.route(GATEWAY+'/**',gateway);ctx.route('http://127.0.0.1:4199/**',gateway)
    return ctx

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    ctx=context_for(browser);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(PUBLIC+'#connections')
    expect(page.locator('#firebase-api-key')).to_be_hidden()
    expect(page.locator('#connection-ocr-provider')).to_be_hidden()
    expect(page.locator('#connection-remember')).not_to_be_checked()
    page.locator('#connection-base').fill(GATEWAY);page.locator('#connection-token').fill(ACCESS)
    page.locator('#connection-connect').click();expect(page.locator('#connection-base-status')).to_contain_text('All three services configured and saved')
    for kind in ['ocr','tts','asr']:
        expect(page.locator('#connection-'+kind+'-provider')).to_have_value('gemini')
        expect(page.locator('#connection-'+kind+'-summary')).to_contain_text('Configured')
        assert page.locator('#connection-'+kind+'-summary time').get_attribute('datetime')
    assert len(calls)==3 and all(c['authorized'] for c in calls)
    assert ACCESS not in page.evaluate('JSON.stringify(localStorage)')
    expect(page.locator('#settings-save-gateway')).to_contain_text('Saved for this session')
    print('PASS: one metadata-only action selects Gemini for all services; advanced keys/providers stay collapsed; session saving is default')

    page.locator('#connection-advanced>summary').click()
    for kind,model in [('ocr','vision-b'),('tts','tts-b'),('asr','asr-b')]:
        page.locator('#connection-'+kind+'-models').select_option(model)
        if kind=='tts':page.locator('#connection-tts-voices').select_option('Aoede')
        page.locator('#connection-'+kind+'-save').click()
    page.locator('#connection-advanced>summary').click()
    page.evaluate("()=>{window.__originalWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='bhaasa.gateway.access.v1')throw new DOMException('Fixture quota','QuotaExceededError');return window.__originalWrite.call(this,key,value)}}")
    count=len(calls);page.locator('#connection-remember').check();page.locator('#connection-connect').click()
    expect(page.locator('#connection-base-status')).to_contain_text('could not remember')
    expect(page.locator('#settings-save-gateway')).to_contain_text('Save failed')
    assert len(calls)==count and page.evaluate("localStorage.getItem('bhaasa.gateway.access.v1')") is None
    page.evaluate('()=>{Storage.prototype.setItem=window.__originalWrite}')
    page.locator('#connection-remember').check();page.locator('#connection-connect').click()
    expect(page.locator('#connection-base-status')).to_contain_text('All three services configured and saved')
    expect(page.locator('#settings-save-gateway')).to_contain_text('Saved on this device')
    assert page.evaluate("sessionStorage.getItem('bhaasa.gateway.access.v1')") is None
    assert ACCESS in page.evaluate("localStorage.getItem('bhaasa.gateway.access.v1')")
    state=ctx.storage_state();ctx.close();ctx=context_for(browser,state);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(PUBLIC+'#connections');expect(page.locator('#connection-base')).to_have_value(GATEWAY)
    expect(page.locator('#connection-remember')).to_be_checked();expect(page.locator('#connection-token')).to_have_value('')
    page.locator('#connection-connect').click();expect(page.locator('#connection-base-status')).to_contain_text('All three services configured and saved')
    expect(page.locator('#connection-ocr-model')).to_have_value('vision-b');expect(page.locator('#connection-asr-model')).to_have_value('asr-b')
    expect(page.locator('#connection-tts-model')).to_have_value('tts-b');expect(page.locator('#connection-tts-voice')).to_have_value('Aoede')
    assert ACCESS not in page.evaluate("localStorage.getItem('bhaasa.progress.v2')||''")
    print('PASS: explicit device saving survives a browser-context restart and retains model/voice preferences without revealing the saved code')

    page.evaluate("location.hash='progress'")
    with page.expect_download() as download:
        page.locator('[data-action="export"]').click()
    backup=Path(download.value.path()).read_text();assert ACCESS not in backup and 'bhaasa.gateway.access' not in backup
    assert json.loads(backup)['version']==2
    exported=page.evaluate("""async()=>{
      const {getCatalog}=await import('./catalog.js');const {saveClip,listClips,exportAudio}=await import('./audio-store.js');const {unpackZip}=await import('./zip.js');
      await saveClip(getCatalog('ml').byId['v-0'],{name:'My recording',provider:'human',model:'recording',voice:'my-voice'},new Blob(['fixture recording'],{type:'audio/wav'}),'file');
      const entries=await unpackZip(await exportAudio(await listClips()));return new TextDecoder().decode(entries.get('manifest.json'));
    }""")
    assert ACCESS not in exported and 'bhaasa.gateway.access' not in exported and len(json.loads(exported)['clips'])==1
    page.evaluate("location.hash='connections'");expect(page.locator('#connection-connect')).to_be_visible()
    print('PASS: real progress download and a nonempty audio ZIP exclude remembered gateway credentials')

    before=page.evaluate("localStorage.getItem('bhaasa.asr.ml.v1')")
    modes['/api/transcribe']='unconfigured';page.locator('#connection-connect').click()
    expect(page.locator('#connection-base-status')).to_contain_text('2 of 3 services')
    expect(page.locator('#connection-asr-summary')).to_contain_text('configured ASR provider')
    assert page.evaluate("localStorage.getItem('bhaasa.asr.ml.v1')")==before
    modes.clear();page.locator('#connection-token').fill('wrong_access_code_'.ljust(64,'z'));page.locator('#connection-connect').click()
    expect(page.locator('#connection-base-status')).to_contain_text('0 of 3 services')
    expect(page.locator('#connection-ocr-summary')).to_contain_text('access was refused')
    page.locator('#connection-token').fill(ACCESS);modes['/api/ocr']='html';page.locator('#connection-connect').click()
    expect(page.locator('#connection-ocr-summary')).to_contain_text('web page')
    modes['/api/ocr']='network';page.locator('#connection-connect').click()
    expect(page.locator('#connection-ocr-summary')).to_contain_text('Could not reach')
    modes.clear();page.locator('#connection-connect').click();expect(page.locator('#connection-base-status')).to_contain_text('All three services configured and saved')
    print('PASS: missing services, wrong access codes, HTML endpoints and network errors have separate outcomes without erasing previous service preferences')

    for width in [320,390,834,1440]:
        page.set_viewport_size({'width':width,'height':1194});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.set_viewport_size({'width':834,'height':1194});(ROOT/'test-results').mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT/'test-results/simple-connections.png'),full_page=True)
    modes['/api/ocr']='pending';before=page.evaluate("localStorage.getItem('bhaasa.ocr.preferences.v1')")
    page.locator('#connection-connect').click();expect(page.locator('#connection-connect')).to_be_disabled()
    page.locator('#connection-base').fill('https://different.example');expect(page.locator('#connection-base-status')).to_contain_text('cancelled')
    for route in pending:
        try:route.fulfill(json={'providers':[{'id':'gemini','configured':True,'model':'stale-model','models':['stale-model']}]},headers={'Access-Control-Allow-Origin':'*'})
        except Exception:pass
    assert page.evaluate("localStorage.getItem('bhaasa.ocr.preferences.v1')")==before
    assert page.evaluate("async()=>{const {gatewayHeaders}=await import('./gateway.js');return gatewayHeaders('https://different.example/api/ocr')}")=={}
    modes.clear();page.locator('#connection-access-clear').click()
    expect(page.locator('#settings-save-gateway')).to_contain_text('Connection forgotten')
    assert page.evaluate("localStorage.getItem('bhaasa.gateway.access.v1')") is None
    assert page.evaluate("sessionStorage.getItem('bhaasa.gateway.access.v1')") is None
    audio=page.evaluate("JSON.parse(localStorage.getItem('bhaasa.voices.v1'))")
    active=next(v for v in audio['profiles'] if v['id']==audio['activeId'])
    assert active['model']=='tts-b' and active['voice']=='Aoede' and active['endpoint']==''
    assert page.evaluate("async()=>{const {listClips}=await import('./audio-store.js');return (await listClips()).length}")==1
    page.reload();expect(page.locator('#connection-base')).to_have_value('')
    print('PASS: cancelled checks ignore stale responses; other gateways receive no code; Forget clears access/addresses while keeping voice identities')

    page.locator('#connection-base').fill(GATEWAY);page.locator('#connection-token').fill(ACCESS);page.locator('#connection-connect').click()
    expect(page.locator('#connection-base-status')).to_contain_text('All three services configured and saved')
    state=ctx.storage_state();assert ACCESS not in json.dumps(state);ctx.close()
    fresh=context_for(browser,state);fp=fresh.new_page();fp.goto(PUBLIC+'#connections');expect(fp.locator('#connection-base')).to_have_value('')
    local=fresh.new_page();local.goto(LOCAL+'#connections');local.locator('#connection-base').fill('http://127.0.0.1:4199')
    local.locator('#connection-connect').click();expect(local.locator('#connection-base-status')).to_contain_text('All three services configured and saved')
    assert any(c['local'] for c in calls) and not errors,errors
    print('PASS: session-only codes do not survive a fresh context; the same simple flow works with a local gateway that requires no code')
    browser.close()
