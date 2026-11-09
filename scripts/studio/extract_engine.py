#!/usr/bin/env python3
# Developer tool, not needed to run the site: re-extracts the shared engine from sample sites (edit the SITES paths).
# Run:  ENGINE_TS_OUT=src/lib/studio/engineData.ts python3 scripts/studio/extract_engine.py
"""Extracts the shared site engine from the three sample sites and checks they are the same engine.

Per site, the only things that differ are: the config object C, the palette/fonts/radius, a small
"skin" CSS block, the site-specific translations, and a few hard-coded per-site hooks (mode, booking
text, deposits, gallery categories, logo files). Those hooks are rewritten to read from C, then the three
engines are compared: they must be byte-identical or this script fails.
"""
import re, json, sys, hashlib

SITES = {
    'elegant': '/home/claude/samples/elegant_hair___glam/index.html',
    'olam': '/home/claude/samples/OLAM_creations/index.html',
    'age': '/home/claude/samples/A_G_E_Concepts/index.html',
}

SHA256_JS = (
    "const SHA256JS=(()=>{const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,"
    "0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,"
    "0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,"
    "0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);"
    "return t=>{const m=new TextEncoder().encode(t),n=m.length,p=new Uint8Array(((n+9+63)>>6)<<6);p.set(m);p[n]=128;const v=new DataView(p.buffer);v.setUint32(p.length-4,(n*8)>>>0);v.setUint32(p.length-8,Math.floor(n*8/4294967296));"
    "const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64),r=(x,k)=>(x>>>k)|(x<<(32-k));"
    "for(let o=0;o<p.length;o+=64){for(let i=0;i<16;i++)w[i]=v.getUint32(o+i*4);for(let i=16;i<64;i++){const a=r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3),b=r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+a+w[i-7]+b)>>>0}"
    "let[a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const S1=r(e,6)^r(e,11)^r(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=r(a,2)^r(a,13)^r(a,22),mj=(a&b)^(a&c)^(b&c),t2=(S0+mj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}"
    "H[0]+=a;H[1]+=b;H[2]+=c;H[3]+=d;H[4]+=e;H[5]+=f;H[6]+=g;H[7]+=h}return[...H].map(x=>x.toString(16).padStart(8,'0')).join('')}})();\n"
)

def balanced(s, start, open_ch='{', close_ch='}'):
    """Index just past the block that opens at s[start] (handles strings and template literals)."""
    depth, i, n = 0, start, len(s)
    while i < n:
        c = s[i]
        if c in '"\'`':
            q = c; i += 1
            while i < n and s[i] != q:
                if s[i] == '\\': i += 1
                elif q == '`' and s[i] == '$' and s[i+1:i+2] == '{':
                    j = balanced(s, i + 1); i = j - 1
                i += 1
        elif c == open_ch: depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0: return i + 1
        i += 1
    raise ValueError('unbalanced')

def remove_function(js, name):
    out = js
    while True:
        m = re.search(r'(?:^|\n)function %s\(' % re.escape(name), out)
        if not m: return out
        start = m.start() + (1 if out[m.start()] == '\n' else 0)
        brace = out.index('{', m.end())
        end = balanced(out, brace)
        out = out[:start] + out[end:].lstrip('\n')

def parse(path):
    s = open(path, encoding='utf-8').read()
    head = s[:s.index('<style>')]
    css = re.search(r'<style>(.*?)</style>', s, re.S).group(1)
    js = re.search(r'<script>(.*?)</script>', s, re.S).group(1)
    return s, head, css, js

def split_css(css):
    m = re.match(r"\s*:root\{(.*?)\}\n@media\(prefers-color-scheme:dark\)\{:root:not\(\[data-theme=light\]\)\{(.*?)\}\}\n:root\[data-theme=dark\]\{(.*?)\}\n", css, re.S)
    assert m, 'root rules not found'
    def kv(block): return dict(re.findall(r'(--[a-z0-9]+):([^;]+);', block))
    light, dark1, dark2 = kv(m.group(1)), kv(m.group(2)), kv(m.group(3))
    assert dark1 == dark2, 'dark palettes differ between the media query and the attribute rule'
    rest = css[m.end():]
    marker = '@media(prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:.01s!important}}\n'
    i = rest.index(marker) + len(marker)
    j = rest.index('\n.cartb{', i) + 1
    return light, dark1, rest[:i], rest[i:j], rest[j:]

def clean_js(js, key):
    # 1) config object
    m = re.search(r'const C=(\{.*?\});\n', js, re.S)
    cfg = json.loads(m.group(1)); js = js[:m.start()] + '/*@@C@@*/\n' + js[m.end():]
    # 2) mode
    js = js.replace("const MODE=C.key==='olam'?'quote':'book'", "const MODE=C.mode==='quote'?'quote':'book'")
    # 3) booking title/text
    bk = re.search(r"const BK=\{.*?\};\n", js, re.S)
    js = js[:bk.start()] + "const BKV=()=>[C.bookTitle||'Book an appointment',C.bookText||'Pick a day and time that suits you.'];\n" + js[bk.end():]
    js = js.replace('(BK[C.key]||BK.age)', 'BKV()').replace('BK[C.key]||BK.age', 'BKV()')
    # 4) gallery categories
    js = re.sub(r"const CAT=\{age:\[.*?\]\}\[C\.key\]\|\|\[\]", "const CAT=C.galCats||[]", js, flags=re.S)
    # 5) default deposits
    dp = re.search(r"const DEPD=\{.*?\};", js, re.S)
    js = js[:dp.start()] + js[dp.end():]
    js = js.replace("(DEPD[C.key]||'')", "(C.deposits||'')")
    # 6) logo + theme: one generic version that supports separate light/dark logos
    js = remove_function(js, 'theme')
    lg = re.search(r'\nfunction logo\(', js)
    start = lg.start() + 1; end = balanced(js, js.index('{', lg.end()))
    generic = ("function theme(t){document.documentElement.dataset.theme=t;ls.s('th_'+C.key,t);const i=$('#main-logo');if(i&&LOGO(t==='dark'))i.src=LOGO(t==='dark')}\n"
               "const LOGO=d=>(DB.s&&DB.s.logo)||(d&&C.logoDark)||C.logoLight||'';\n"
               "function logo(){const s=DB.s,de=document.documentElement,d=de.dataset.theme==='dark'||(!de.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches),src=LOGO(d);"
               "const mark=src?`<img class=\"lg\" id=\"main-logo\" src=\"${esc(src)}\" alt=\"\">`:`<svg class=\"lg\" viewBox=\"0 0 40 40\"><rect width=\"40\" height=\"40\" rx=\"${C.lr||0}\" fill=\"var(--ac)\"/><text x=\"20\" y=\"26\" text-anchor=\"middle\" font-size=\"15\" font-weight=\"700\" fill=\"var(--on)\" font-family=\"serif\">${esc(C.mono||'')}</text></svg>`;"
               "const text=C.logoSub?`<div class=\"logo-text-wrap\"><span>${esc(s.name)}</span><span class=\"logo-sub\">${esc(C.logoSub)}</span></div>`:`<span>${esc(s.name)}</span>`;"
               "return `<a class=\"logo\" href=\"#\">${mark}${text}</a>`}")
    js = js[:start] + generic + js[end:]
    # 6b) honesty + freshness fixes shared by every generated site
    #     - a brand-new dashboard must not show invented visit numbers
    js = js.replace('v:[3,5,4,7,6,9,8]', 'v:[0,0,0,0,0,0,0]').replace('DB.v=[3,5,4,7,6,9,8]', 'DB.v=[0,0,0,0,0,0,0]')
    assert '3,5,4,7,6,9,8' not in js
    #     - when the site's content is republished (C.rev changes) returning visitors get the new content,
    #       while their own orders / bookings / messages stay
    anchor = "let DB=ls.g(K,null)||{s:C.settings,p:C.products,g:C.gallery,sl:C.slides,q:[],v:[0,0,0,0,0,0,0]};"
    assert anchor in js
    js = js.replace(anchor, anchor + "\nif(C.rev&&DB.rev!==C.rev){const old=DB;DB={s:C.settings,p:C.products,g:C.gallery,sl:C.slides,q:[],v:[0,0,0,0,0,0,0],rev:C.rev};['q','o','b','r','rv','pv','v'].forEach(k=>{if(old[k]!==undefined)DB[k]=old[k]})}", 1)
    # 6c) the owner passcode is checked as a SHA-256 hash. crypto.subtle only exists on https:// pages, so a built-in
    #     implementation is used when it is missing (otherwise sign-in would silently fail on plain-http hosting)
    old_sha = "async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(C.key+':'+s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}"
    assert old_sha in js
    sha_js = SHA256_JS + "async function sha(s){const t=C.key+':'+s;if(window.crypto&&crypto.subtle){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){}}return SHA256JS(t)}"
    js = js.replace(old_sha, sha_js, 1)
    # 7) translations
    ti = js.index('const TRD=')
    te = balanced(js, js.index('{', ti))
    trd = json.loads(js[js.index('{', ti):te])
    assert js[te] == ';', js[te:te+20]
    js = js[:ti] + 'const TRD=/*@@TRD@@*/' + js[te:]
    js = re.sub(r'\n[ \t]*\n+', '\n', js)
    return js, cfg, trd

def main():
    parts = {}
    for k, p in SITES.items():
        s, head, css, js = parse(p)
        light, dark, cssA, skin, cssB = split_css(css)
        cssB = re.sub(r'\.logo-text-wrap \{.*?\}\n\.logo-sub \{.*?\}\n', '', cssB, flags=re.S)
        js2, cfg, trd = clean_js(js, k)
        tail = s[s.index('</script>'):]
        body = s[s.index('</style>'):s.index('<script>')]
        parts[k] = dict(light=light, dark=dark, cssA=cssA, skin=skin, cssB=cssB, js=js2, cfg=cfg, trd=trd, tail=tail, body=body, head=head)
    ref = parts['elegant']
    ok = True
    for k, p in parts.items():
        for field in ('cssA', 'cssB', 'js', 'tail', 'body'):
            same = p[field] == ref[field]
            if not same:
                ok = False
                import difflib
                a, b = ref[field].replace(';', ';\n').split('\n'), p[field].replace(';', ';\n').split('\n')
                d = [l for l in difflib.unified_diff(a, b, lineterm='', n=0) if not l.startswith(('---', '+++', '@@'))]
                print(f'DIFF in {field} ({k} vs elegant): {len(d)} lines'); [print('   ', l[:200]) for l in d[:10]]
        print(k, 'light keys', sorted(p['light']), '| skin chars', len(p['skin']))
    print('\nENGINES IDENTICAL' if ok else '\nENGINES DIFFER')
    # generic translations = entries identical in all three; the rest are site-specific
    langs = ('sw', 'lg')
    generic = {l: {} for l in langs}
    for l in langs:
        keys = set.intersection(*[set(parts[k]['trd'].get(l, {})) for k in parts])
        for key in keys:
            vals = {parts[k]['trd'][l][key] for k in parts}
            if len(vals) == 1: generic[l][key] = vals.pop()
    for k, p in parts.items():
        extra = {l: {a: b for a, b in p['trd'].get(l, {}).items() if generic[l].get(a) != b} for l in langs}
        print(k, 'translations: generic', {l: len(generic[l]) for l in langs}, '| site-specific', {l: len(extra[l]) for l in langs})
        p['trd_extra'] = extra
    out = dict(ref={f: ref[f] for f in ('cssA', 'cssB', 'js', 'tail', 'body')}, generic=generic,
               sites={k: dict(light=p['light'], dark=p['dark'], skin=p['skin'], cfg=p['cfg'], trd_extra=p['trd_extra'], head=p['head']) for k, p in parts.items()})
    json.dump(out, open('/home/claude/merge/tools/engine.json', 'w'), ensure_ascii=False)
    print('\nwrote engine.json', len(json.dumps(out)), 'bytes')
    if ok:
        def lit(name, v): return f"export const {name} = {json.dumps(v, ensure_ascii=False)};\n"
        logo_css = ".logo-text-wrap{display:flex;flex-direction:column;line-height:1.1}\n.logo-sub{font-family:var(--bf),sans-serif;font-size:8.5px;font-weight:500;letter-spacing:.32em;text-transform:uppercase;color:var(--mut);margin-top:-2px}\n"
        ts = ['// src/lib/studio/engineData.ts', '// GENERATED by scripts/studio/extract_engine.py from three production sites that share one engine. Do not edit by hand.', '']
        ts += [lit('ENGINE_CSS_A', ref['cssA']), lit('ENGINE_CSS_B', ref['cssB'] + logo_css), lit('ENGINE_JS', ref['js']), lit('GENERIC_TRD', generic)]
        import os
        target = os.environ.get('ENGINE_TS_OUT')
        if target: open(target, 'w').write('\n'.join(ts)); print('wrote', target)
    sys.exit(0 if ok else 1)

main()
