import subprocess, time, os, base64
from playwright.sync_api import sync_playwright
DATA=subprocess.check_output(['mktemp','-d']).decode().strip()
srv=subprocess.Popen(['node','/tmp/harness_server.cjs'],env=dict(os.environ,DATA_DIR=DATA,PORT='4021'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT); time.sleep(1.2)
B='http://localhost:4021'; P=F=0
def ok(l,v,x=''):
    global P,F
    P+=bool(v); F+=(not v); print(('PASS' if v else 'FAIL')+'  '+l,x)
PNG=base64.b64decode(open('/tmp/pic480.b64').read())
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':1000}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:120])); pg.on('console',lambda m:errs.append(m.text[:120]) if m.type=='error' and 'Failed to load' not in m.text else None)
    pg.goto(B+'/builder'); pg.wait_for_selector('button:has-text("Start from scratch")'); pg.click('button:has-text("Start from scratch")')
    pg.wait_for_selector('[data-tour=name]'); pg.wait_for_timeout(1300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    def add(label):
        pg.click('button:has-text("+ Add a section")'); pg.wait_for_timeout(250); pg.locator(f'button:has-text("{label}")').first.click(); pg.wait_for_timeout(500)
    for l in ['Services / features','About / story','FAQ']: add(l)
    order=lambda: pg.evaluate("[...document.querySelectorAll('[id^=ed-][data-sort-index]')].map(e=>e.innerText.split('\\n')[0].replace(/[▸▾]/g,'').trim().slice(0,22))")
    o=order(); print('order now:',o)
    ok('section rows show real icons, not icon names as text', not any(w in ' '.join(o) for w in ('compass','rocket','sparkles','help-circle')))
    grips=pg.locator('[id^=ed-][data-sort-index] > div:first-child [data-sort-grip]'); n=grips.count(); ok('drag handles on movable sections', n>=3, n)
    last=grips.nth(n-1).bounding_box(); first=grips.nth(0).bounding_box()
    pg.mouse.move(last['x']+last['width']/2,last['y']+last['height']/2); pg.mouse.down()
    for s in range(1,15): pg.mouse.move(last['x']+last['width']/2,last['y']+last['height']/2+(first['y']-last['y']-6)*s/14); pg.wait_for_timeout(15)
    ok('row follows the pointer while dragging', pg.evaluate("[...document.querySelectorAll('[data-sort-index]')].some(e=>e.style.transform.includes('translateY')&&e.style.zIndex==='30')"))
    pg.mouse.up(); pg.wait_for_timeout(500); o2=order(); print('after drag:',o2)
    ok('dragged section moved up to the first movable slot', o2!=o and o2[1]==o[-2], f'{o[-2]} -> position 2')
    ok('menu stays first and footer stays last', o2[0]==o[0] and o2[-1]==o[-1])
    grips.nth(0).focus(); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(400); o3=order()
    ok('keyboard ArrowDown moves the item', o3!=o2); ok('screen readers are told', any('Moved to position' in t for t in pg.locator('[role=status]').all_inner_texts()))
    srcdoc=pg.evaluate("document.querySelector('iframe[title=\"Live preview of your website\"]').getAttribute('srcdoc')||''"); ok('live preview reflects the sections', 'What we offer' in srcdoc)
    pg.locator('[id^=ed-] button:has-text("Services")').first.click(); pg.wait_for_timeout(400)
    names=('Fast delivery','Smart ideas','Friendly support')
    items=lambda: [x for x in pg.evaluate("[...document.querySelectorAll('ul > li[data-sort-index]')].map(e=>e.innerText.split('\\n')[0].replace(/[▸▾]/g,'').trim().slice(0,24))") if x in names]
    it=items(); print('items:',it)
    if len(it)>=2:
        g=pg.locator('ul > li[data-sort-index] [data-sort-grip]'); a=g.nth(len(it)-1).bounding_box(); t=g.nth(0).bounding_box()
        pg.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2); pg.mouse.down()
        for s in range(1,13): pg.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2+(t['y']-a['y']-4)*s/12); pg.wait_for_timeout(15)
        pg.mouse.up(); pg.wait_for_timeout(500); it2=items(); ok('items inside a section can be dragged too', it2!=it and it2[0]==it[-1], it2[:3])
    pg.locator('[id^=ed-] button:has-text("About")').first.click(); pg.wait_for_timeout(500)
    h=pg.evaluate_handle("[...document.querySelectorAll('span')].find(s=>s.textContent.includes('drop a picture here'))?.parentElement")
    if h.as_element():
        pg.evaluate("""([el,b64])=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],'pic.png',{type:'image/png'}));
          el.dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}))}""",[h.as_element(),base64.b64encode(PNG).decode()]); pg.wait_for_timeout(1800)
        ok('dropping a picture file uploads it', pg.evaluate("[...document.querySelectorAll('img')].some(i=>i.src.startsWith('data:image/'))"))
    else: ok('picture drop zone present', False)
    # live price
    ok('live price chip is shown', pg.locator('[data-tour=price]').count()==1, pg.locator('[data-tour=price]').inner_text() if pg.locator('[data-tour=price]').count() else '')
    pg.locator('[data-tour=price]').click(); pg.wait_for_timeout(300)
    ok('price breakdown lists what you pay for', pg.locator('[role=dialog][aria-label="Price breakdown"] li').count()>=3, pg.locator('[role=dialog][aria-label="Price breakdown"] li').count())
    ok('no browser errors', not errs, errs[:2])
    b.close()
finally: srv.terminate()
print(f"\nDRAG & DROP + PRICE: {P} passed, {F} failed")
