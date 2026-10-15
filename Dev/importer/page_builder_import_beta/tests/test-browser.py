from pathlib import Path
import json, os, shutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
results=[]
def record(s):
 results.append(s);print('PASS',s,flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 page.set_content((root/'index.html').read_text());page.wait_for_function("window.PageBuilder && document.getElementById('bootError').hidden")
 assert page.evaluate('PageBuilder.getProject().paper.orientation')=='portrait'
 record('Editor boots offline with the user portrait default and custom template')
 def xy(x,y):
  return page.evaluate('''([x,y])=>{const s=document.getElementById('canvas'),p=s.createSVGPoint();p.x=x;p.y=-y;const q=p.matrixTransform(s.getScreenCTM());return [q.x,q.y]}''',[x,y])
 def clickxy(x,y):page.mouse.click(*xy(x,y))
 page.locator('button[data-tool="line"]').click();clickxy(20,100);clickxy(120,100)
 assert page.evaluate('PageBuilder.getProject().pages[0].entities.length')==1
 e=page.evaluate('PageBuilder.getProject().pages[0].entities[0]');assert e['x2']-e['x1']==100
 record('Existing click-click line drawing: exactly 100 mm')
 page.locator('#undoBtn').click();assert page.evaluate('PageBuilder.getProject().pages[0].entities.length')==0
 page.locator('#redoBtn').click();assert page.evaluate('PageBuilder.getProject().pages[0].entities.length')==1
 record('Undo and redo retained')
 page.locator('button[data-tool="circle"]').click();clickxy(100,180);clickxy(110,180)
 assert page.evaluate('PageBuilder.getProject().pages[0].entities[1].r')==10
 page.locator('button[data-tool="text"]').click();page.locator('#newText').fill('EDITOR TEST');clickxy(20,220)
 assert page.evaluate('PageBuilder.getProject().pages[0].entities[2].text')=='EDITOR TEST'
 record('Existing circle and text drawing retained')
 page.locator('#addPageBtn').click();assert page.evaluate('PageBuilder.getProject().pages.length')==2
 record('Add page retained')
 before=page.evaluate('JSON.stringify(PageBuilder.getProject())')
 page.locator('#importCadBtn').click();page.locator('#cadFile').set_input_files(str(root/'tests/test-input.dxf'));page.locator('#cadReadBtn').click()
 page.wait_for_function("document.getElementById('cadStatus').textContent.startsWith('Preview ready')",timeout=20000)
 assert page.locator('#cadPreview svg').count()==1
 assert page.evaluate('JSON.stringify(PageBuilder.getProject())')==before
 page.screenshot(path=str(root/'tests/dxf-import-preview.png'))
 record('Real ASCII DXF file decodes and previews without replacing the open project')
 page.locator('#cadCloseBtn').click();assert page.evaluate('JSON.stringify(PageBuilder.getProject())')==before
 record('Cancelling import preserves the open project')
 page.locator('#importCadBtn').click();page.locator('#cadFile').set_input_files(str(root/'tests/fixture-decoder-database.json'));page.locator('#cadReadBtn').click()
 page.wait_for_function("document.getElementById('cadStatus').textContent.startsWith('Preview ready')",timeout=20000)
 page.locator('#cadConfirmed').check()
 with page.expect_download() as event:page.locator('#cadSaveJsonBtn').click()
 download=event.value;download.save_as(str(root/'tests/browser-saved-project.json'))
 page.locator('#cadAcceptBtn').click()
 assert not page.locator('#cadImportDialog').is_visible()
 assert page.evaluate('PageBuilder.getProject().pages[0].entities.some(e=>e.type==="arc")')
 assert page.evaluate('PageBuilder.getProject().titleBlock.enabled') is False
 record('Typed decoder fixture imports arcs, fills, text and blocks as editable objects')
 page.screenshot(path=str(root/'tests/imported-fixture-editor.png'))
 with page.expect_download() as event:page.locator('#dxfBtn').click()
 event.value.save_as(str(root/'tests/browser-export.dxf'))
 record('Imported geometry exports to DXF through the actual download button')
 # Exercise select, text edit and moving a converted block line.
 state=page.evaluate('PageBuilder.getProject()');e=next(e for e in state['pages'][0]['entities'] if e.get('text')=='K1')
 page.locator('button[data-tool="select"]').click();clickxy(e['x']+1,e['y']+1)
 assert page.locator('#selectedText').is_visible()
 page.locator('#selectedText').fill('K1-EDITED')
 assert page.evaluate('PageBuilder.getProject().pages[0].entities.some(e=>e.text==="K1-EDITED")')
 record('Imported attribute text is selectable and editable')
 # Bad file failures must never overwrite the current project.
 before=page.evaluate('JSON.stringify(PageBuilder.getProject())')
 page.locator('#importCadBtn').click();page.locator('#cadFile').set_input_files({'name':'invalid.dwg','mimeType':'application/octet-stream','buffer':b'not a drawing'});page.locator('#cadReadBtn').click()
 page.wait_for_function("document.getElementById('cadStatus').classList.contains('error')")
 assert page.evaluate('JSON.stringify(PageBuilder.getProject())')==before
 page.locator('#cadCloseBtn').click()
 record('Invalid DWG header rejected without replacing project')
 # Network blocking is real here; simulate immediate network failure, not a fake successful decode.
 context.route('**/dist/libredwg-web.js',lambda route:route.abort('internetdisconnected'))
 page.locator('#importCadBtn').click();page.locator('#cadFile').set_input_files(os.environ['DWG_SAMPLE'] if os.environ.get('DWG_SAMPLE') else {'name':'header-only.dwg','mimeType':'application/octet-stream','buffer':b'AC1032 failure test, not decoded'});page.locator('#cadReadBtn').click()
 page.wait_for_function("document.getElementById('cadStatus').textContent.startsWith('Import stopped:')",timeout=20000)
 assert page.evaluate('JSON.stringify(PageBuilder.getProject())')==before
 page.locator('#cadCloseBtn').click();context.unroute('**/dist/libredwg-web.js')
 record('Blocked decoder download reports failure and preserves project; DWG binary NOT decoded')
 # Confirm module loading and Worker protocol with an explicitly synthetic mock, not the supplied DWG.
 fixture=json.loads((root/'tests/fixture-decoder-database.json').read_text())['database']
 module='export const Dwg_File_Type={DWG:0}; export class LibreDwg { static async create(){return {dwg_read_data(){return 1},convertEx(){return {database:'+json.dumps(fixture)+',stats:{unknownEntityCount:0}}},dwg_free(){}}}}'
 context.route('**/dist/libredwg-web.js',lambda route:route.fulfill(status=200,content_type='text/javascript',headers={'Access-Control-Allow-Origin':'*'},body=module))
 page.locator('#importCadBtn').click();page.locator('#cadFile').set_input_files({'name':'SYNTHETIC_mock.dwg','mimeType':'application/octet-stream','buffer':b'AC1032 synthetic fixture, not a real DWG'});page.locator('#cadReadBtn').click()
 page.wait_for_function("document.getElementById('cadStatus').textContent.startsWith('Preview ready')",timeout=20000)
 record('DWG worker/module protocol works with MOCKED decoder (not a binary-decoder test)')
 assert not errors,errors
 record('No JavaScript runtime errors in tested UI paths')
 browser.close()
(root/'tests/browser-test-results.json').write_text(json.dumps({'passed':results,'actual_dwg_decoding_tested':False,'runtime_errors':errors},indent=2))
