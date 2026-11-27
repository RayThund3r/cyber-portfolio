import subprocess, time, os, json, datetime
from playwright.sync_api import sync_playwright
DATA=subprocess.check_output(['mktemp','-d']).decode().strip()
srv=subprocess.Popen(['node','/tmp/harness_server.cjs'],env=dict(os.environ,DATA_DIR=DATA,PORT='4031',RESEND_API_KEY='re_t'),stdout=subprocess.PIPE,stderr=subprocess.STDOUT); time.sleep(1.2)
B='http://localhost:4031'; P=F=0
def ok(l,v,x=''):
    global P,F
    P+=bool(v); F+=(not v); print(('PASS' if v else 'FAIL')+'  '+l,x)
today=datetime.date.today(); tom=today+datetime.timedelta(days=1); dat=today+datetime.timedelta(days=2)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1280,'height':1000}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:120])); pg.on('console',lambda m:errs.append(m.text[:120]) if m.type=='error' and 'Failed to load' not in m.text else None)
    def contact(name,phone,d,t,ip):
        r=ctx.request.post(B+'/api/contact',data=json.dumps({'formType':'repair','name':name,'phone':phone,'details':'Cracked screen on my phone','slot':{'date':d.isoformat(),'time':t}}),headers={'content-type':'application/json','origin':B,'cf-connecting-ip':ip}); return r.status
    s=[contact('Amina K','0700123456',tom,'10:00','1.0.0.1'),contact('Amina K','0700123456',dat,'14:00','1.0.0.2'),contact('Brian O','0755987654',tom,'09:00','1.0.0.3')]; print('seeded 3 requests:',s)
    print('── calendar'); pg.goto(B+'/panel/calendar'); pg.wait_for_selector('h2'); pg.wait_for_timeout(400)
    ok('month title shown', str(today.year) in pg.locator('h2').first.inner_text())
    if tom.month!=today.month: pg.click('button[aria-label="Next month"]')
    ok('days with visits show a count', pg.locator(f'button[aria-label^="{tom.day} "][aria-label*="visit"]').first.get_attribute('aria-label').endswith('2 visits'))
    pg.locator(f'button[aria-label^="{tom.day} "]').first.click(); pg.wait_for_timeout(300)
    txt=pg.locator('h3:has-text("%s")' % tom.isoformat()).locator('xpath=..').inner_text()
    ok("the chosen day's agenda lists both visits, earliest first", txt.index('09:00')<txt.index('10:00') and 'Brian O' in txt and 'Amina K' in txt)
    pg.locator('h3:has-text("%s")' % tom.isoformat()).locator('xpath=..').locator('text=Amina K').first.click(); pg.wait_for_timeout(200); ok('clicking a visit opens that request', pg.evaluate('window.__opened||""').startswith('SYS-'))
    pg.click('button[aria-label="Next month"]'); pg.click('button:has-text("Today")'); ok('next month / today buttons work', str(today.year) in pg.locator('h2').first.inner_text())
    print('── customers'); pg.goto(B+'/panel/customers'); pg.wait_for_selector('text=Customers'); pg.wait_for_timeout(400)
    ok('two requests from the same phone become ONE repeat customer', pg.locator('span:text-is("REPEAT")').count()==1 and pg.locator('li:has-text("Amina K")').count()==1)
    pg.fill('input[aria-label="Search customers"]','brian'); ok('search narrows the list', pg.locator('li:has-text("Amina K")').count()==0 and pg.locator('li:has-text("Brian O")').count()==1)
    pg.fill('input[aria-label="Search customers"]',''); pg.locator('li:has-text("Amina K") button').first.click(); pg.wait_for_timeout(300)
    ok('expanding shows WhatsApp / call buttons and requests', pg.locator('a:has-text("WhatsApp")').count()==1 and pg.locator('li:has-text("SYS-")').count()>=2)
    print('── pricing'); pg.goto(B+'/panel/pricing'); pg.wait_for_selector('text=SMART PRICING'); pg.wait_for_timeout(800)
    tot=lambda: pg.locator('li:has(strong) >> span.font-mono').first.inner_text()
    before=tot(); inp=pg.locator('input[aria-label="Base price (every website)"]'); inp.fill('400000'); pg.wait_for_timeout(300); after=tot()
    ok('changing the base price updates every template total live', before!=after, f'{before} -> {after}')
    ok('save is enabled only after a change', pg.locator('button:has-text("Save prices")').is_enabled()); pg.click('button:has-text("Save prices")'); pg.wait_for_timeout(600)
    saved=json.loads(ctx.request.post(B+'/api/admin',data=json.dumps({'action':'pricing.get'}),headers={'content-type':'application/json','origin':B}).text())
    ok('the new price is stored on the server', saved['card']['base']==400000)
    pg.click('button:has-text("Reset to suggestions")'); ok('reset puts the suggested prices back (unsaved)', inp.input_value()=='150000' and pg.locator('text=unsaved changes').count()==1)
    print('── settings'); pg.goto(B+'/panel/settings'); pg.wait_for_selector('text=SITE SETTINGS'); pg.wait_for_timeout(800)
    pg.fill('input[placeholder="256700000000"]','+256 700 111 222'); pg.locator('button[role=switch]:has-text("Show the announcement bar")').click(); pg.fill('input[placeholder="Free diagnosis this week!"]','Free diagnosis this week')
    ok('services start on the built-in list', pg.locator('text=Showing the built-in list').count()==1)
    pg.click('button:has-text("Customise the services")'); pg.wait_for_timeout(300); n0=pg.locator('input[aria-label="Service title"]').count(); ok(f'customising loads the built-in services to edit ({n0})', n0>=3)
    pg.locator('input[aria-label="Service title"]').first.fill('Phone & PC Repair (edited)'); pg.click('button:has-text("Add a service")'); pg.wait_for_timeout(200)
    ok('a service can be added', pg.locator('input[aria-label="Service title"]').count()==n0+1)
    pg.locator('button[aria-label="Move down"]').first.click(); pg.wait_for_timeout(200); ok('services can be reordered', pg.locator('input[aria-label="Service title"]').first.input_value()!='Phone & PC Repair (edited)')
    pg.locator('button[aria-label="Delete service"]').last.click(); ok('and deleted', pg.locator('input[aria-label="Service title"]').count()==n0)
    pg.click('button:has-text("Save settings")'); pg.wait_for_timeout(800)
    st=json.loads(ctx.request.post(B+'/api/admin',data=json.dumps({'action':'settings.get'}),headers={'content-type':'application/json','origin':B}).text())['settings']
    ok('everything was saved on the server', st['business']['whatsapp']=='256700111222' and st['announce']['enabled'] and any(x['title']=='Phone & PC Repair (edited)' for x in st['services']) and len(st['services'])==n0, f"{len(st['services'])} services")
    pg.locator('button[role=switch]:has-text("Maintenance mode")').click(); pg.once('dialog',lambda d:d.dismiss()); pg.click('button:has-text("Save settings")'); pg.wait_for_timeout(500)
    st2=json.loads(ctx.request.post(B+'/api/admin',data=json.dumps({'action':'settings.get'}),headers={'content-type':'application/json','origin':B}).text())['settings']
    ok('turning on maintenance mode asks first (cancel = not saved)', st2['maintenance']['enabled']==False)
    ok('no browser errors', not errs, errs[:2])
    b.close()
finally: srv.terminate()
print(f"\nADMIN PANELS IN A BROWSER: {P} passed, {F} failed")
