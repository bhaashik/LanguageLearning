"""Optional end-to-end checks. Run the local server first; see README.md."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
BASE = os.environ.get('BHAASA_URL', os.environ.get('AKSHARAM_URL', 'http://127.0.0.1:4173/')).rstrip('/') + '/'
DATA = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {byId,lessons} from './content.js';console.log(JSON.stringify({byId,lessons}));"
], cwd=ROOT))
KEY = 'bhaasa.progress.v2'


def navigate(page, route):
    page.evaluate('(route) => location.hash = route', route)
    page.wait_for_function('(route) => document.body.dataset.route === route', arg=route)


def answer_quiz(page, wrong_first=False):
    count = 0
    while not page.locator('.result-card').count():
        expect(page.locator('.quiz-prompt')).to_be_visible()
        item_id = page.locator('.quiz-prompt [data-speak]').get_attribute('data-speak')
        item = DATA['byId'][item_id]
        answer = item['meaning'] if item['kind'] in ('word', 'phrase') else item['roman']
        options = page.locator('.answer').all()
        selected = None
        for option in options:
            text = option.evaluate('(el) => [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("").trim()')
            if (text != answer if wrong_first and count == 0 else text == answer):
                selected = option
                break
        assert selected, f'No valid answer for {item_id}: {answer}'
        selected.click()
        expect(page.locator('#answer-feedback')).to_be_visible()
        expect(page.locator('.answer:enabled')).to_have_count(0)
        page.locator('[data-action="quiz-next"]').click()
        count += 1
        assert count <= 8
    return count


with sync_playwright() as p:
    executable = os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if executable:
        launch['executable_path'] = executable
    browser = p.chromium.launch(**launch)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    expect(page.locator('h1')).to_contain_text('A new language.')
    expect(page.locator('#offline-status')).to_have_text('Available offline', timeout=15000)
    page.wait_for_function('!!navigator.serviceWorker.controller')
    page.evaluate('document.fonts.ready')
    assert page.evaluate('document.fonts.check("30px Malayalam")')
    page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
    print('PASS: application and font load; all offline assets cached')

    # A real quiz, one error, completion, due review, then a reload.
    page.get_by_role('link', name='Begin your first lesson').click()
    expect(page.locator('.study-content > .ml')).to_have_text('അ')
    page.locator('[data-action="next-card"]').click()
    expect(page.locator('.study-content > .ml')).to_have_text('ആ')
    page.locator('[data-card="0"]').click()
    expect(page.locator('.study-content > .ml')).to_have_text('അ')
    page.get_by_role('button', name='Start practice', exact=False).click()
    assert answer_quiz(page, wrong_first=True) == 6
    expect(page.locator('.result-card h2')).to_have_text('5 out of 6')
    state = page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)
    assert state['lessons']['first-vowels'] == 5 / 6
    assert sum(i['attempts'] for i in state['items'].values()) == 6
    navigate(page, 'learn')
    navigate(page, 'review')
    expect(page.locator('.review-count')).to_have_text('1items due')
    page.locator('[data-action="due-quiz"]').click()
    assert answer_quiz(page) == 1
    page.reload()
    navigate(page, 'progress')
    expect(page.locator('.stat-card').first).to_contain_text('1')
    expect(page.locator('.score-row').first).to_contain_text('83%')
    print('PASS: lesson feedback, completion, immediate error review, persistence')

    # Export/import is exercised with an actual downloaded file.
    with page.expect_download() as info:
        page.locator('[data-action="export"]').click()
    backup = OUT / 'progress.json'
    info.value.save_as(backup)
    saved = json.loads(backup.read_text())
    assert saved['lessons']['first-vowels'] == 5 / 6
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('[data-action="reset"]').click()
    assert page.evaluate('(key) => Object.keys(JSON.parse(localStorage.getItem(key)).items).length', KEY) == 0
    page.locator('#import-progress').set_input_files(str(backup))
    expect(page.locator('#toast')).to_contain_text('restored')
    assert page.evaluate('(key) => JSON.parse(localStorage.getItem(key)).lessons["first-vowels"]', KEY) == 5 / 6
    page.locator('#import-progress').set_input_files({'name': 'bad.json', 'mimeType': 'application/json', 'buffer': b'{"version":99}'})
    expect(page.locator('#toast')).to_contain_text('Could not import')
    print('PASS: backup download, reset, restore, invalid backup rejection')

    # Search both scripts, filters, and empty results.
    navigate(page, 'words')
    expect(page.locator('.word-card')).to_have_count(76)
    page.locator('#word-search').fill('വെള്ളം')
    expect(page.locator('.word-card')).to_have_count(2)
    assert page.locator('#word-search').evaluate('(el) => el === document.activeElement')
    page.locator('#word-group').select_option('Food & shopping')
    expect(page.locator('.word-card')).to_have_count(1)
    page.locator('#word-search').fill('kāppi')
    expect(page.locator('.word-main strong')).to_have_text('coffee')
    page.locator('#word-search').fill('no-such-word')
    expect(page.locator('.empty-state')).to_be_visible()
    page.locator('#word-search').fill('')
    page.locator('#word-group').select_option('All words')
    print('PASS: Malayalam and Roman search, categories, empty state')

    navigate(page, 'script')
    for label, count in [('Vowels', 16), ('Consonants', 36), ('Vowel signs', 14), ('Chillus', 6), ('Conjuncts', 12)]:
        page.locator(f'[data-script="{label}"]').click()
        expect(page.locator('.letter-tile')).to_have_count(count)
    navigate(page, 'item/vel-0')
    page.evaluate('document.fonts.ready')
    expect(page.locator('#trace-plan')).to_contain_text('Suggested guide:')
    canvas = page.locator('#writing-canvas')
    before = canvas.evaluate('(el) => el.toDataURL()')
    box = canvas.bounding_box()
    page.mouse.move(box['x'] + 30, box['y'] + 30)
    page.mouse.down()
    page.mouse.move(box['x'] + 140, box['y'] + 80, steps=8)
    page.mouse.up()
    assert canvas.evaluate('(el) => el.toDataURL()') != before
    page.get_by_role('button', name='Undo', exact=True).click()
    assert canvas.evaluate('(el) => el.toDataURL()') == before
    page.locator('#show-guide').uncheck()
    assert canvas.evaluate('(el) => el.toDataURL()') != before
    page.locator('#show-guide').check()
    page.screenshot(path=str(OUT / 'writing.png'), full_page=True)
    print('PASS: complete script reference; writing, undo, and guide toggle')

    for lesson in DATA['lessons']:
        navigate(page, 'lesson/' + lesson['id'])
        page.locator('[data-quiz]').click()
        assert answer_quiz(page) == min(8, len(lesson['items']))
        expect(page.locator('.result-card p')).to_contain_text('Lesson complete')
    navigate(page, 'progress')
    expect(page.locator('.stat-card').first).to_contain_text('10')
    assert all(score == 1 for score in page.evaluate('(key) => Object.values(JSON.parse(localStorage.getItem(key)).lessons)', KEY))
    print('PASS: all ten lesson quizzes complete with valid answer choices')

    # Responsive layouts across routes, including a long sentence on the writing pad.
    for width in (320, 390, 768, 1440):
        page.set_viewport_size({'width': width, 'height': 900})
        for route in ('learn', 'script', 'words', 'grammar', 'review', 'progress', 'about', 'item/phrase-4'):
            navigate(page, route)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, route, 'horizontal overflow')
        if width == 390:
            navigate(page, 'learn')
            page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
    print('PASS: no page overflow at 320, 390, 768, and 1440 pixels')

    # A fresh navigation with network disabled verifies actual offline use.
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.goto(BASE + '?offline-check=1#script')
    context.set_offline(True)
    page.reload()
    expect(page.locator('h1')).to_contain_text('A script full of curves.')
    expect(page.locator('.letter-tile')).to_have_count(12)
    navigate(page, 'lesson/first-vowels')
    expect(page.locator('.study-content > .ml')).to_have_text('അ')
    page.locator('[data-quiz]').click()
    assert answer_quiz(page) == 6
    context.set_offline(False)
    print('PASS: offline reload, script navigation, quiz, and progress saving')
    assert not errors, errors

    # Device speech: explicitly test both absent and supported Malayalam voices.
    for available in (False, True):
        speech_context = browser.new_context()
        speech_context.add_init_script('''
          window.testSpeech=[];
          const voices=VOICE_LIST;
          Object.defineProperty(window,'speechSynthesis',{value:{
            getVoices:()=>voices,addEventListener:()=>{},cancel:()=>{},speak:u=>window.testSpeech.push({lang:u.lang,text:u.text,voice:u.voice.lang})
          }});
          window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
        '''.replace('VOICE_LIST', json.dumps([{'name':'English','lang':'en-US','localService':True}] + ([{'name':'Malayalam test','lang':'ml-IN','localService':True}] if available else []))))
        speech_page = speech_context.new_page()
        speech_page.goto(BASE + '#item/food-0')
        speech_page.locator('[data-speak]').click()
        calls = speech_page.evaluate('window.testSpeech')
        if available:
            assert calls == [{'lang':'ml-IN','text':'വെള്ളം','voice':'ml-IN'}]
            expect(speech_page.locator('#voice-note')).to_contain_text('Malayalam speech available')
        else:
            assert calls == []
            expect(speech_page.locator('#toast')).to_contain_text('No Malayalam voice found')
        speech_context.close()
    print('PASS: Malayalam voice selection and honest missing-voice fallback')
    browser.close()
    print('All browser checks passed. Screenshots saved in test-results/.')
