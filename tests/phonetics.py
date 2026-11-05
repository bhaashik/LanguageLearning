"""Features and concise pronunciation guides across reference, lessons, syllables and offline use."""
import os
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BHAASA_URL','http://127.0.0.1:4173/').rstrip('/')+'/'
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
def nav(page,route):
    page.evaluate('(r)=>location.hash=r',route)
    page.wait_for_function('(r)=>document.body.dataset.route===r',arg=route)
def first_part(page,id):return page.locator('[data-feature-item="'+id+'"] .phonetic-part').first

with sync_playwright() as p:
    options={'headless':True,'args':['--no-sandbox']};executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    if executable:options['executable_path']=executable
    browser=p.chromium.launch(**options);context=browser.new_context(viewport={'width':1440,'height':1050})
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'#phonetics');expect(page.locator('#offline-status')).to_have_text('Available offline')
    expect(page.locator('.sound-feature-card')).to_have_count(16)
    expect(first_part(page,'v-2')).to_contain_text('front');expect(first_part(page,'v-2')).to_contain_text('unrounded')
    expect(first_part(page,'v-4')).to_contain_text('back');expect(first_part(page,'v-4').locator('li')).to_contain_text(['close / high','back','rounded','short','voiced'])
    page.locator('.feature-key summary').click();expect(page.locator('.feature-key')).to_contain_text('vocal-fold vibration')
    expect(page.locator('.feature-key')).to_contain_text('traditional palatal series')
    page.locator('[data-sound-group="Consonants"]').click();expect(page.locator('.sound-feature-card')).to_have_count(36)
    expect(first_part(page,'vel-0')).to_contain_text('unvoiced');expect(first_part(page,'vel-0')).to_contain_text('unaspirated')
    expect(first_part(page,'vel-1').locator('li')).to_contain_text(['velar','stop','unvoiced','aspirated'])
    expect(first_part(page,'vel-2')).to_contain_text('voiced')
    expect(first_part(page,'ret-0')).to_contain_text('retroflex');expect(first_part(page,'den-0')).to_contain_text('dental')
    expect(first_part(page,'pal-0')).to_contain_text('affricate');expect(first_part(page,'pal-0')).to_contain_text('traditional palatal series')
    page.reload();expect(page.locator('[data-sound-group="Consonants"]')).to_have_attribute('aria-pressed','true')
    page.locator('[data-feature-item="ret-0"] .sound-feature-title a').click()
    expect(page.locator('.detail-card .phonetic-features')).to_contain_text('retroflex')
    expect(page.locator('.detail-card .pronunciation-tip')).to_contain_text('Retract the tongue tip')
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    print('PASS: vowel contrasts, voicing/aspiration, place/manner, label glossary and category resume')

    nav(page,'phonetics');page.locator('[data-sound-group="Vowel signs"]').click()
    expect(page.locator('.sound-feature-card')).to_have_count(14)
    expect(page.locator('[data-feature-item="sign-2"] .phonetic-part').nth(1)).to_contain_text('front')
    expect(page.locator('[data-feature-item="sign-13"]')).to_contain_text('no inherent vowel')
    page.locator('[data-sound-group="Chillus"]').click()
    expect(page.locator('.sound-feature-card')).to_have_count(6);expect(first_part(page,'ch-0')).to_contain_text('retroflex')
    expect(page.locator('[data-feature-item="ch-0"]')).to_contain_text('no inherent vowel')
    page.locator('[data-sound-group="Conjuncts"]').click();expect(page.locator('.sound-feature-card')).to_have_count(32)
    mixed=page.locator('[data-feature-item="cj-4"] .phonetic-part')
    expect(mixed.nth(0)).to_contain_text('nasal');expect(mixed.nth(0)).to_contain_text('voiced');expect(mixed.nth(1)).to_contain_text('unvoiced')
    expect(first_part(page,'cj-11')).to_contain_text('alveolar');expect(first_part(page,'cj-11')).to_contain_text('long / geminate')
    assert 'tap / trill' not in first_part(page,'cj-11').inner_text()
    nav(page,'item/syll-cj-0-oo');parts=page.locator('.detail-card .phonetic-part')
    expect(parts.nth(0)).to_contain_text('long / geminate');expect(parts.nth(1)).to_contain_text('back');expect(parts.nth(1)).to_contain_text('rounded')
    assert len(page.locator('.detail-card .pronunciation-tip').inner_text().split())<45
    nav(page,'lesson/first-vowels');page.locator('.study-card>.linguistic-details').evaluate('e=>e.open=true')
    expect(page.locator('.study-card .phonetic-features')).to_contain_text('central')
    nav(page,'script');page.locator('[data-script="Consonants"]').click()
    page.locator('.letter-tile').first.locator('.linguistic-details').first.evaluate('e=>e.open=true')
    expect(page.locator('.letter-tile').first).to_contain_text('soft palate')
    print('PASS: chillu endings, mixed conjunct components, alveolar റ്റ, syllable vowels, lessons and reference cards')

    context.set_offline(True);nav(page,'phonetics');page.reload()
    expect(page.locator('[data-sound-group="Conjuncts"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('.sound-feature-card')).to_have_count(32)
    page.locator('[data-sound-group="Vowels"]').click()
    for width in (320,390,768,1440):
        page.set_viewport_size({'width':width,'height':1000})
        page.locator('.feature-key').evaluate('e=>e.open=true')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.locator('.feature-key').evaluate('e=>e.open=false')
    page.locator('.sound-feature-reference').scroll_into_view_if_needed()
    page.screenshot(path=str(OUT/'phonetic-features.png'))
    assert not errors,errors;browser.close()
    print('PASS: offline feature guide, responsive cards and no browser errors')
