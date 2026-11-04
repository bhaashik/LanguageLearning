"""Development-only glyph rasterization for generate-tracing.py; no API calls.
Run the app server first, then: python3 scripts/render-tracing.py /tmp/bhaasa-guide-refs
Requires Python Playwright and Chromium. The browser uses the bundled font.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('output',type=Path);args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
items=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{scriptItems}from './content.js';console.log(JSON.stringify(scriptItems.map(({id,ml})=>({id,ml}))));"],cwd=ROOT))
with sync_playwright() as p:
    options={'headless':True,'args':['--no-sandbox']};executable=os.environ.get('BROWSER_EXECUTABLE') or shutil.which('chromium')
    if executable:options['executable_path']=executable
    browser=p.chromium.launch(**options);page=browser.new_page();page.goto(os.environ.get('BHAASA_URL','http://127.0.0.1:4173/'))
    page.evaluate('document.fonts.load("200px Malayalam")')
    for item in items:
        data=page.evaluate('''item=>{const c=document.createElement('canvas');c.width=400;c.height=200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,400,200);x.fillStyle='black';x.textAlign='center';x.textBaseline='middle';x.font='100px Malayalam';x.fillText(item.ml,200,102,360);return c.toDataURL('image/png').split(',')[1]}''',item)
        (args.output/(item['id']+'.png')).write_bytes(base64.b64decode(data))
    browser.close()
(args.output/'items.json').write_text(json.dumps(items,ensure_ascii=False))
print('Rendered',len(items),'local glyph references.')
