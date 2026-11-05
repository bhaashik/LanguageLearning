"""Desktop UI checks against a running packaged app; no paid provider requests."""
import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4174/').rstrip('/')+'/'
OUT=Path(__file__).resolve().parents[1]/'test-results';OUT.mkdir(exist_ok=True)

def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)

def only_local(route):
    if urlsplit(route.request.url).netloc==urlsplit(BASE).netloc:route.continue_()
    else:route.abort('internetdisconnected')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':1000},accept_downloads=True)
    context.route('**/*',only_local)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#about')
    assert page.evaluate('window.BhaasaDesktop?.isDesktop===true')
    assert page.evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)')==0
    expect(page.locator('#offline-status')).to_have_text('Available offline')
    page.get_by_role('link',name='Desktop settings',exact=True).click()
    expect(page.locator('h1')).to_have_text('Desktop settings')
    page.locator('#browser').select_option('firefox');page.locator('#save').click()
    expect(page.locator('#result')).to_contain_text('Browser preference saved')
    page.reload();expect(page.locator('#browser')).to_have_value('firefox')
    page.locator('#browser').select_option('auto');page.locator('#save').click()
    expect(page.locator('#result')).to_contain_text('Browser preference saved')
    page.get_by_role('link',name='Back to Bhaasa',exact=False).click()
    nav(page,'item/vel-0')
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    assert page.locator('#ocr-endpoint').input_value()==BASE+'api/ocr'
    page.locator('#writing-canvas').evaluate('''canvas=>{
      const r=canvas.getBoundingClientRect();
      for(let i=0;i<30;i++)canvas.dispatchEvent(new PointerEvent(i===0?'pointerdown':i===29?'pointerup':'pointermove',{
        pointerId:1,pointerType:'pen',isPrimary:true,buttons:i===29?0:1,clientX:r.x+30+i*3,clientY:r.y+40+i*2,bubbles:true}));
    }''')
    expect(page.locator('#export-trace')).to_be_enabled();page.locator('.trace-settings summary').click()
    with page.expect_download() as download:page.locator('#export-trace').click()
    assert 'strokes' in download.value.suggested_filename
    page.reload();expect(page.locator('#trace-plan')).to_contain_text('1 drawn')
    nav(page,'progress')
    with page.expect_download() as download:page.locator('[data-action="export"]').click()
    data=json.loads(Path(download.value.path()).read_text());assert data['writing']['vel-0']['draft']
    nav(page,'about');page.get_by_role('link',name='Desktop build & setup guide',exact=True).click()
    expect(page.locator('h1')).to_have_text('Bhaasa on Linux and Windows')
    assert page.evaluate('window.BhaasaDesktop.isDesktop')
    page.go_back();expect(page.locator('[data-route="about"]')).to_be_visible()
    assert not errors,errors
    context.close();browser.close()
    print('PASS: desktop browser preferences, loopback-only offline reload, bundled tracing, browser downloads, persisted drafts, and help navigation')
