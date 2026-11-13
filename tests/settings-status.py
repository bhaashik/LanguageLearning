"""Save-time feedback with real browser storage and simulated storage failures.
No model discovery, generation, microphone or paid service requests are made.
"""
import os
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4181/').rstrip('/')+'/'
LOCAL_KEY='bhaasa.settings.save-times.v1'
SESSION_KEY='bhaasa.settings.session-save-times.v1'
ACCESS='settings_status_fixture_token_'.ljust(64,'x')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':834,'height':1194},locale='en-GB',timezone_id='Asia/Kolkata',service_workers='block')
    context.add_init_script('''
      window.__settingsNow=Date.parse('2026-11-13T13:40:00Z');Date.now=()=>window.__settingsNow;
      const write=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(window.__failStorage===key)throw new DOMException('Fixture storage full','QuotaExceededError');return write.call(this,key,value)};
    ''')
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#connections')
    expect(page.get_by_role('heading',name='Settings status',exact=True)).to_be_visible()
    for kind in ['ocr','tts','asr','firebase','gateway']:expect(page.locator('#settings-save-'+kind)).to_contain_text('No save time recorded')
    page.locator('#connection-ocr-provider').select_option('none')
    expect(page.locator('#settings-save-ocr')).to_contain_text('Unsaved changes')
    page.locator('#connection-ocr-save').click()
    saved=page.locator('#settings-save-ocr time').get_attribute('datetime')
    assert saved=='2026-11-13T13:40:00.000Z'
    expect(page.locator('#settings-save-ocr')).to_contain_text('Saved on this device')
    expect(page.locator('#settings-save-ocr')).to_contain_text(re.compile(r'19:10:00.*(?:GMT\+5:30|IST)'))
    page.reload();expect(page.locator('#settings-save-ocr time')).to_have_attribute('datetime',saved)
    assert 'Unsaved changes' not in page.locator('.settings-save-panel').inner_text()
    print('PASS: exact save time, device timezone and reload persistence without inventing historical save times')

    page.locator('#connection-ocr-provider').select_option('gemini')
    page.locator('#connection-ocr-endpoint').fill('https://fixture.example/api/ocr')
    page.locator('#connection-ocr .connection-manual summary').click()
    page.locator('#connection-ocr-model').fill('vision-fixture')
    expect(page.locator('#settings-save-ocr')).to_contain_text('Unsaved changes')
    expect(page.locator('#settings-save-ocr time')).to_have_attribute('datetime',saved)
    page.evaluate("window.__settingsNow+=60000;window.__failStorage='bhaasa.ocr.preferences.v1'")
    page.locator('#connection-ocr-save').click()
    expect(page.locator('#settings-save-ocr')).to_contain_text('Save failed')
    expect(page.locator('#settings-save-ocr time')).to_have_attribute('datetime',saved)
    page.evaluate('window.__failStorage=null;window.__settingsNow+=60000')
    page.locator('#connection-ocr-save').click()
    expect(page.locator('#settings-save-ocr time')).to_have_attribute('datetime','2026-11-13T13:42:00.000Z')
    print('PASS: unsaved changes and storage failures retain the last successful timestamp; retry records success')

    page.locator('#connection-tts-save').click()
    expect(page.locator('#settings-save-tts')).to_contain_text('Saved on this device')
    page.locator('#connection-asr-provider').select_option('browser');page.locator('#connection-asr-save').click()
    with page.expect_navigation(wait_until='load'):
        page.locator('#language-choice').select_option('fr')
    expect(page.locator('.breadcrumb')).to_contain_text('FRENCH')
    page.evaluate("location.hash='connections'")
    expect(page.locator('#settings-save-tts')).to_contain_text('No save time recorded')
    expect(page.locator('#settings-save-asr')).to_contain_text('No save time recorded')
    expect(page.locator('#settings-save-ocr time')).to_have_attribute('datetime','2026-11-13T13:42:00.000Z')
    with page.expect_navigation(wait_until='load'):
        page.locator('#language-choice').select_option('ml')
    expect(page.locator('.breadcrumb')).to_contain_text('MALAYALAM')
    page.evaluate("location.hash='connections'")
    expect(page.locator('#settings-save-tts')).to_contain_text('Saved on this device')
    page.evaluate("window.__failStorage='bhaasa.voices.v1'")
    page.locator('#connection-tts-save').click();expect(page.locator('#settings-save-tts')).to_contain_text('Save failed')
    page.evaluate('window.__failStorage=null')
    print('PASS: shared OCR and language-specific voice/ASR save times; voice storage failure is visible')

    page.locator('#firebase-api-key').fill('AIzaPublicFirebaseWebKeyFixture')
    page.locator('#firebase-site-key').fill('6PublicEnterpriseWebsiteKeyFixture')
    page.locator('#firebase-save').click();expect(page.locator('#settings-save-firebase')).to_contain_text('Saved on this device')
    page.locator('#firebase-clear').click();expect(page.locator('#settings-save-firebase')).to_contain_text('Forgotten on this device')
    page.locator('#connection-base').fill('https://gateway.fixture.example')
    page.locator('#connection-token').locator('..').locator('..').evaluate('e=>e.open=true')
    page.locator('#connection-token').fill(ACCESS);page.locator('#connection-access-save').click()
    expect(page.locator('#settings-save-gateway')).to_contain_text('Saved for this session')
    assert ACCESS not in page.evaluate('JSON.stringify(localStorage)')
    metadata=page.evaluate('(key)=>localStorage.getItem(key)',LOCAL_KEY)
    assert 'gateway' not in metadata and 'Fixture' not in metadata and 'https:' not in metadata
    page.reload();expect(page.locator('#settings-save-gateway')).to_contain_text('Saved for this session')
    page.locator('#connection-token').locator('..').locator('..').evaluate('e=>e.open=true')
    page.evaluate("window.__failStorage='bhaasa.gateway.access.v1'")
    page.locator('#connection-token').fill(ACCESS);page.locator('#connection-access-save').click()
    expect(page.locator('#settings-save-gateway')).to_contain_text('Save failed')
    page.evaluate('window.__failStorage=null')
    page.locator('#connection-access-clear').click();expect(page.locator('#settings-save-gateway')).to_contain_text('Forgotten for this session')
    assert page.evaluate("sessionStorage.getItem('bhaasa.gateway.access.v1')") is None
    print('PASS: Firebase forget and session-only access timestamps; metadata contains no endpoints or credentials')

    page.evaluate("window.__failStorage='bhaasa.settings.save-times.v1'")
    page.locator('#connection-ocr-save').click();expect(page.locator('#settings-save-ocr')).to_contain_text('save time could not be stored')
    page.evaluate('window.__failStorage=null')
    page.locator('#connection-ocr-save').click()
    for width in [320,390,834,1440]:
        page.set_viewport_size({'width':width,'height':1194})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.set_viewport_size({'width':834,'height':1194});(ROOT/'test-results').mkdir(exist_ok=True)
    page.locator('.settings-save-panel').screenshot(path=str(ROOT/'test-results/settings-status.png'))
    assert not errors,errors
    print('PASS: timestamp-storage warning, responsive status panel, and no browser errors')
    browser.close()
