from playwright.sync_api import sync_playwright
HTML = """<!doctype html><html class="motion-ready"><head><style>
.motion-ready [data-hero-item],.motion-ready [data-hero-title]{opacity:0}
@media print{[data-reveal],[data-hero-item],[data-hero-title]{opacity:1!important;translate:none!important}}
body{margin:0} .blk{height:420px;margin:20px;background:#ddd}
</style></head><body>
<header data-hero><h1 data-hero-title>Title</h1><p data-hero-item>Intro</p></header>
<div class="blk" id="top" data-reveal>above the fold</div>
""" + "".join(f'<div class="blk" id="b{i}" data-reveal>block {i}</div>' for i in range(8)) + """
<script src="file:///tmp/reveal.iife.js"></script></body></html>"""
open('/tmp/reveal_page.html','w').write(HTML)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':800,'height':700})
    pg.goto('file:///tmp/reveal_page.html')
    # watch for ANY attribute change on the revealed elements (what React would flag as a hydration mismatch)
    pg.evaluate("window.__attr=0; new MutationObserver(r=>r.forEach(x=>window.__attr++)).observe(document.body,{attributes:true,subtree:true,attributeFilter:['style','class']})")
    op=lambda sel: pg.evaluate(f"getComputedStyle(document.querySelector('{sel}')).opacity")
    print('hero hidden before intro:', op('[data-hero-title]')=='0')
    pg.evaluate("window.__r=__rv.createRevealer(); __rv.playHeroIntro(document); __r.reveal([...document.querySelectorAll('[data-reveal]')])"); pg.wait_for_timeout(1200)
    print('hero visible after intro :', op('[data-hero-title]')=='1' and op('[data-hero-item]')=='1')
    print('above-the-fold untouched :', op('#top')=='1' and pg.evaluate("document.querySelector('#top').getAnimations().length")==0)
    print('below-the-fold held back :', op('#b5')=='0', '| waiting animations:', pg.evaluate("document.getAnimations().filter(a=>a.playState==='paused').length"))
    pg.evaluate("document.querySelector('#b5').scrollIntoView()"); pg.wait_for_timeout(1500)
    print('revealed on scroll       :', op('#b5')=='1', '| animation cleaned up:', pg.evaluate("document.querySelector('#b5').getAnimations().length")==0)
    print('attribute changes made to the page (must be 0):', pg.evaluate('window.__attr'))
    pg.evaluate("window.scrollTo(0,0)"); print('still-hidden far block (b7):', op('#b7')=='0')
    pg.emulate_media(media='print'); print('print/PDF shows everything:', op('#b7')=='1'); pg.emulate_media(media='screen')
    pg.evaluate("__r.destroy()"); pg.wait_for_timeout(200); print('destroy() reveals anything still waiting:', op('#b7')=='1')
    pg2=b.new_page(viewport={'width':800,'height':700}); pg2.emulate_media(reduced_motion='reduce'); pg2.goto('file:///tmp/reveal_page.html')
    b.close()
