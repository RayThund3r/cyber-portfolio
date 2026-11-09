// src/lib/builder/generate.ts
//
// SiteConfig → a real, standalone website (HTML + CSS + JS, Bootstrap 5.3).
// Isomorphic and pure: the editor's live preview and the downloaded .zip are produced by the SAME code.
// Every user-supplied string goes through e() (HTML-escaped) or safeUrl()/asset resolution — nothing is trusted.
import { FONT_PAIRS, SECTION_DEFS, type SectionInstance, type SiteConfig } from './schema';
import { ASSET_RE, safeUrl } from './sanitize';

export const BS_VERSION = '5.3.3';
export const BS_CDN = {
  css: `https://cdn.jsdelivr.net/npm/bootstrap@${BS_VERSION}/dist/css/bootstrap.min.css`,
  js: `https://cdn.jsdelivr.net/npm/bootstrap@${BS_VERSION}/dist/js/bootstrap.bundle.min.js`,
};

export interface BuildOptions {
  /** preview = editor canvas (selection + inline editing) · view = finished interactive site · export = files for the zip */
  mode: 'preview' | 'view' | 'export';
  /** Resolves an asset id to a URL: a data: URI in the editor, `assets/<file>` in the zip. */
  assetSrc: (id: string) => string;
  /** Local Bootstrap paths (when vendored into the zip). Defaults to the CDN. */
  bootstrap?: { css: string; js: string };
}
export interface BuiltSite { html: string; css: string; js: string; customCss: string; customJs: string }

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const nl2br = (s: unknown) => e(s).replace(/\n/g, '<br>');
const paras = (s: unknown) => e(s).split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
const lines = (s: unknown) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const isExt = (u: string) => /^https?:/i.test(u);

/* ───────── colour helpers ───────── */
const hexN = (h: string) => parseInt(h.slice(1), 16);
function lum(h: string) {
  const n = hexN(h);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (h: string) => (lum(h) > 0.45 ? '#111827' : '#ffffff');
function mix(a: string, b: string, t: number) {
  const x = hexN(a), y = hexN(b);
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('');
}

const I18N: Record<string, { name: string; email: string; msg: string; top: string; call: string }> = {
  en: { name: 'Your name', email: 'Your email', msg: 'Message', top: 'Back to top', call: 'Chat on WhatsApp' },
  sw: { name: 'Jina lako', email: 'Barua pepe yako', msg: 'Ujumbe', top: 'Juu', call: 'Ongea WhatsApp' },
  fr: { name: 'Votre nom', email: 'Votre e-mail', msg: 'Message', top: 'Haut de page', call: 'Discuter sur WhatsApp' },
  ar: { name: 'اسمك', email: 'بريدك الإلكتروني', msg: 'الرسالة', top: 'للأعلى', call: 'واتساب' },
  pt: { name: 'Seu nome', email: 'Seu e-mail', msg: 'Mensagem', top: 'Voltar ao topo', call: 'Conversar no WhatsApp' },
};

/* ───────── CSS ───────── */
export function buildCss(cfg: SiteConfig): string {
  const t = cfg.theme;
  const fp = FONT_PAIRS.find((f) => f.id === t.fontPair) || FONT_PAIRS[0];
  const r = { none: '0', sm: '.35rem', md: '.75rem', lg: '1.25rem', pill: '1rem' }[t.radius] ?? '.75rem';
  const rb = t.radius === 'pill' ? '999px' : r;
  return `:root{--c-primary:${t.primary};--c-primary-h:${mix(t.primary, lum(t.primary) > 0.45 ? '#000000' : '#ffffff', 0.18)};--c-on-primary:${onColor(t.primary)};--c-secondary:${t.secondary};--c-bg:${t.bg};--c-alt:${t.alt};--c-text:${t.text};--c-muted:color-mix(in srgb,var(--c-text) 68%,transparent);--c-line:color-mix(in srgb,var(--c-text) 13%,transparent);--c-card:color-mix(in srgb,var(--c-text) 4%,var(--c-bg));--r:${r};--rb:${rb};--f-head:${fp.head};--f-body:${fp.body}}
html{${t.smooth ? 'scroll-behavior:smooth;' : ''}scroll-padding-top:4.5rem}
body{background:var(--c-bg);color:var(--c-text);font-family:var(--f-body);line-height:1.65;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4,h5,h6{font-family:var(--f-head);line-height:1.2}
a{color:var(--c-primary)}
img{max-width:100%}
.img-broken{color:transparent;background:linear-gradient(135deg,var(--c-alt),var(--c-card));min-height:140px;object-fit:cover}
.btn{border-radius:var(--rb);padding:.7rem 1.5rem;font-weight:600;transition:transform .15s,background .15s,color .15s}
.btn:hover{transform:translateY(-1px)}
.btn-brand{background:var(--c-primary);border:2px solid var(--c-primary);color:var(--c-on-primary)}
.btn-brand:hover,.btn-brand:focus{background:var(--c-primary-h);border-color:var(--c-primary-h);color:var(--c-on-primary)}
.btn-outline-brand{background:transparent;border:2px solid var(--c-primary);color:var(--c-primary)}
.btn-outline-brand:hover{background:var(--c-primary);color:var(--c-on-primary)}
.sec-primary .btn-brand,.sec-primary .btn-outline-brand:hover{background:var(--c-on-primary);border-color:var(--c-on-primary);color:var(--c-primary)}
.sec-primary .btn-outline-brand,.sec-dark .btn-outline-brand,.hero-image .btn-outline-brand{border-color:currentColor;color:inherit}
.sec-dark .btn-brand,.hero-image .btn-brand{background:var(--c-primary);border-color:var(--c-primary);color:var(--c-on-primary)}
.sec{position:relative}
.sec-default{background:var(--c-bg)}
.sec-alt{background:var(--c-alt)}
.sec-primary{background:var(--c-primary);color:var(--c-on-primary)}
.sec-primary a:not(.btn){color:inherit}
.sec-dark{background:#0d1117;color:#e6edf3}
.sec-dark a:not(.btn){color:#9ecbff}
.sp-compact{padding:2.5rem 0}.sp-normal{padding:4.5rem 0}.sp-spacious{padding:7rem 0}
.section-head{max-width:720px;margin:0 auto 2.5rem}
.section-title{font-weight:800;font-size:clamp(1.7rem,3.4vw,2.4rem);margin-bottom:.6rem}
.section-sub{color:var(--c-muted);font-size:1.1rem;margin:0}
.sec-primary .section-sub,.sec-dark .section-sub{color:inherit;opacity:.85}
.eyebrow{display:inline-block;padding:.25rem .8rem;border-radius:999px;background:color-mix(in srgb,var(--c-primary) 14%,transparent);color:var(--c-primary);font-weight:600;font-size:.85rem;margin-bottom:1rem}
.hero{padding:7rem 0 5rem}
.hero .lead{color:var(--c-muted);margin:1.1rem 0 1.8rem;font-size:1.2rem}
.hero-image{color:#fff;overflow:hidden;min-height:78vh;display:flex;align-items:center}
.hero-image .lead{color:rgba(255,255,255,.88)}
.hero-image .eyebrow{background:rgba(255,255,255,.18);color:#fff}
.hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-overlay{position:absolute;inset:0}
.ov-light{background:rgba(0,0,0,.3)}.ov-medium{background:rgba(0,0,0,.52)}.ov-dark{background:rgba(0,0,0,.72)}
.rounded-brand{border-radius:var(--r)}
.card{background:var(--c-card);border:1px solid var(--c-line);border-radius:var(--r);color:inherit}
.sec-alt .card{background:var(--c-bg)}
.feature .icon{font-size:2rem;margin-bottom:.6rem}
.feature{transition:transform .2s,box-shadow .2s}.feature:hover{transform:translateY(-4px);box-shadow:0 10px 30px rgba(0,0,0,.08)}
.ticks{list-style:none;padding:0;margin:1.2rem 0 0}.ticks li{margin:.4rem 0}.tick{color:var(--c-primary);font-weight:800;margin-right:.4rem}
.stat-num{font-family:var(--f-head);font-weight:800;font-size:clamp(2rem,4vw,3rem);color:var(--c-primary)}
.sec-primary .stat-num,.sec-dark .stat-num{color:inherit}
.stat-label{color:var(--c-muted)}
.gal{margin:0;overflow:hidden;border-radius:var(--r);position:relative;cursor:zoom-in;background:var(--c-card)}
.gal img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;transition:transform .4s}
.gal:hover img{transform:scale(1.05)}
.gal figcaption{position:absolute;left:0;right:0;bottom:0;padding:.6rem .9rem;background:linear-gradient(transparent,rgba(0,0,0,.7));color:#fff;font-size:.9rem}
.lightbox{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;padding:1rem;cursor:zoom-out}
.lightbox.open{display:flex}.lightbox img{max-width:100%;max-height:100%;border-radius:.5rem}
.testi{padding:1.6rem}.testi blockquote{font-size:1.1rem;margin:0 0 1rem}
.who{display:flex;align-items:center;gap:.8rem}.carousel .who{justify-content:center}
.avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none}
.avatar.ph{display:inline-flex;align-items:center;justify-content:center;background:var(--c-primary);color:var(--c-on-primary);font-weight:700}
.carousel-indicators [data-bs-target]{background-color:var(--c-primary)}
.price{padding:1.6rem;text-align:center;height:100%}
.price.featured{border:2px solid var(--c-primary);box-shadow:0 14px 40px rgba(0,0,0,.12);transform:scale(1.03)}
.price .amount{font-family:var(--f-head);font-size:2.2rem;font-weight:800}
.price ul{margin:1.2rem 0;text-align:left}.price li{padding:.3rem 0;border-bottom:1px dashed var(--c-line)}.price li::before{content:"✓ ";color:var(--c-primary);font-weight:700}
.team-photo{width:130px;height:130px;border-radius:50%;object-fit:cover;margin-bottom:.8rem}
.team-photo.ph{display:inline-flex;align-items:center;justify-content:center;background:var(--c-primary);color:var(--c-on-primary);font-size:2.4rem;font-weight:700}
.accordion{--bs-accordion-bg:var(--c-card);--bs-accordion-color:var(--c-text);--bs-accordion-border-color:var(--c-line);--bs-accordion-btn-color:var(--c-text);--bs-accordion-btn-bg:var(--c-card);--bs-accordion-active-bg:color-mix(in srgb,var(--c-primary) 12%,var(--c-bg));--bs-accordion-active-color:var(--c-text);--bs-accordion-btn-focus-box-shadow:none;--bs-accordion-border-radius:var(--r)}
.contact-info li{margin:.5rem 0;list-style:none}.contact-info{padding:0}
.form-control{border-radius:var(--rb);background:var(--c-bg);color:var(--c-text);border:1px solid var(--c-line);padding:.7rem 1rem}
.form-control:focus{border-color:var(--c-primary);box-shadow:0 0 0 .2rem color-mix(in srgb,var(--c-primary) 22%,transparent);background:var(--c-bg);color:var(--c-text)}
.map{border:0;width:100%;height:240px;border-radius:var(--r)}
.site-nav{background:var(--c-bg);border-bottom:1px solid var(--c-line);transition:background .25s,box-shadow .25s}
.site-nav .navbar-brand{font-family:var(--f-head);font-weight:800;color:var(--c-text)}
.site-nav .nav-link{color:var(--c-text);font-weight:500}.site-nav .nav-link:hover{color:var(--c-primary)}
.site-nav.scrolled{box-shadow:0 4px 20px rgba(0,0,0,.08)}
.nav-transparent:not(.scrolled){background:transparent;border-color:transparent}
.nav-transparent:not(.scrolled) .navbar-collapse.show{background:var(--c-bg);padding:1rem;border-radius:var(--r)}
.site-footer a{text-decoration:none}.site-footer a:hover{text-decoration:underline}
.site-footer ul{list-style:none;padding:0;margin:0}.site-footer li{margin:.35rem 0}
#toTop{position:fixed;right:1rem;bottom:1rem;width:44px;height:44px;border-radius:50%;border:0;background:var(--c-primary);color:var(--c-on-primary);opacity:0;pointer-events:none;transition:opacity .25s;z-index:1030;font-size:1.2rem}
#toTop.show{opacity:1;pointer-events:auto}
.js [data-reveal]{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s ease}
.js [data-reveal].in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.js [data-reveal]{opacity:1;transform:none;transition:none}.btn,.feature,.gal img{transition:none}}
@media (max-width:991px){.hero{padding:5.5rem 0 3.5rem}.sp-spacious{padding:4.5rem 0}.price.featured{transform:none}}
`;
}

/* ───────── JS ───────── */
export const SITE_JS = `(function(){
  var d=document;
  d.querySelectorAll('img').forEach(function(im){function bad(){im.classList.add('img-broken')}im.addEventListener('error',bad);if(im.complete&&im.naturalWidth===0&&im.getAttribute('src'))bad()});
  var nav=d.querySelector('.site-nav'),top=d.getElementById('toTop');
  function onScroll(){if(nav)nav.classList.toggle('scrolled',window.scrollY>24);if(top)top.classList.toggle('show',window.scrollY>600)}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  if(top)top.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
  var rv=d.querySelectorAll('[data-reveal]');
  if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12});
    rv.forEach(function(el,i){el.style.transitionDelay=((i%5)*70)+'ms';io.observe(el)})}else{rv.forEach(function(el){el.classList.add('in')})}
  var cs=d.querySelectorAll('.counter');
  function run(el){var to=parseFloat(el.getAttribute('data-to'))||0,t0=null,dur=1400;function f(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1);el.textContent=Math.round(to*(1-Math.pow(1-p,3))).toLocaleString();if(p<1)requestAnimationFrame(f);else el.textContent=to.toLocaleString()}requestAnimationFrame(f)}
  if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){var io2=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){run(x.target);io2.unobserve(x.target)}})},{threshold:.6});cs.forEach(function(c){io2.observe(c)})}
  d.querySelectorAll('.navbar-collapse .nav-link,.navbar-collapse .btn').forEach(function(a){a.addEventListener('click',function(){var c=d.querySelector('.navbar-collapse.show');if(c&&window.bootstrap)bootstrap.Collapse.getOrCreateInstance(c).hide()})});
  var lb=d.createElement('div');lb.className='lightbox';lb.innerHTML='<img alt="">';d.body.appendChild(lb);
  lb.addEventListener('click',function(){lb.classList.remove('open')});
  d.querySelectorAll('.gal img').forEach(function(im){im.addEventListener('click',function(){lb.firstChild.src=im.src;lb.firstChild.alt=im.alt;lb.classList.add('open')})});
  d.addEventListener('keydown',function(ev){if(ev.key==='Escape')lb.classList.remove('open')});
  d.querySelectorAll('form[data-mailto]').forEach(function(f){f.addEventListener('submit',function(ev){ev.preventDefault();var fd=new FormData(f);
    var body=(fd.get('message')||'')+'\\n\\n'+(fd.get('name')||'')+' ('+(fd.get('email')||'')+')';
    location.href='mailto:'+f.getAttribute('data-mailto')+'?subject='+encodeURIComponent('Website message from '+(fd.get('name')||''))+'&body='+encodeURIComponent(body)})});
})();`;

const PREVIEW_CSS = ``;

// ── editor canvas script: selection overlay + floating toolbar + inline text editing ──
const PREVIEW_JS = `(function(){
var d=document,w=window,P=function(m){parent.postMessage(m,'*')};
var Y=/*Y*/0;if(Y)w.scrollTo(0,Y);
var st=d.createElement('style');st.textContent='#__sel,#__hov{position:fixed;pointer-events:none;z-index:99990;display:none;box-sizing:border-box}#__sel{border:2px solid #6366f1;box-shadow:0 0 0 1px rgba(255,255,255,.55)}#__hov{border:1.5px dashed #818cf8}#__bar{position:fixed;z-index:99999;display:none;align-items:center;gap:2px;background:#6366f1;color:#fff;font:600 11px/1 system-ui,sans-serif;border-radius:6px;padding:3px;box-shadow:0 4px 14px rgba(0,0,0,.3)}#__bar b{padding:4px 7px;font-weight:600;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#__bar button{all:unset;cursor:pointer;padding:5px 8px;border-radius:4px;font-size:13px}#__bar button:hover{background:rgba(255,255,255,.25)}[data-f]{cursor:text}.__ed{outline:2px solid #22d3ee!important;outline-offset:2px;background:rgba(34,211,238,.1);min-width:1ch}';
d.head.appendChild(st);
var sel=d.createElement('div'),hov=d.createElement('div'),bar=d.createElement('div');sel.id='__sel';hov.id='__hov';bar.id='__bar';
d.body.appendChild(hov);d.body.appendChild(sel);d.body.appendChild(bar);
var cur=null,hovEl=null,editing=null;
function secOf(el){return el&&el.closest?el.closest('[data-sec]'):null}
function put(el,box){var r=el.getBoundingClientRect();box.style.display='block';box.style.left=r.left+'px';box.style.top=r.top+'px';box.style.width=r.width+'px';box.style.height=r.height+'px'}
function upd(){
 if(cur&&d.body.contains(cur)){put(cur,sel);var r=cur.getBoundingClientRect();bar.style.display='flex';bar.style.left=Math.max(4,Math.min(r.left,w.innerWidth-190))+'px';bar.style.top=(r.top>=34?r.top-30:r.top+4)+'px'}else{sel.style.display='none';bar.style.display='none'}
 if(hovEl&&hovEl!==cur&&!editing)put(hovEl,hov);else hov.style.display='none';
}
function buildBar(){bar.textContent='';var b=d.createElement('b');b.textContent=cur.getAttribute('data-label')||'Section';bar.appendChild(b);
 if(cur.hasAttribute('data-fixed'))return;
 [['up','↑','Move up'],['down','↓','Move down'],['dup','⧉','Duplicate'],['del','🗑','Delete']].forEach(function(x){var bt=d.createElement('button');bt.setAttribute('data-a',x[0]);bt.title=x[2];bt.textContent=x[1];bar.appendChild(bt)})}
function select(s,notify){cur=s;if(s)buildBar();upd();if(notify&&s)P({t:'sel',id:s.getAttribute('data-sec')})}
function startEdit(el){if(editing)return;editing=el;el.__o=el.innerText;el.contentEditable='true';el.classList.add('__ed');el.focus();try{var r=d.createRange();r.selectNodeContents(el);var sl=w.getSelection();sl.removeAllRanges();sl.addRange(r)}catch(e){}}
function endEdit(save){var el=editing;if(!el)return;editing=null;el.contentEditable='false';el.classList.remove('__ed');var v=el.innerText.replace(/\\u00a0/g,' ').replace(/\\n+$/,'');if(!save){el.innerText=el.__o}else if(v!==el.__o){P({t:'edit',f:el.getAttribute('data-f'),v:v})}}
d.addEventListener('mousemove',function(ev){if(editing)return;var s=secOf(ev.target);if(s!==hovEl){hovEl=s;upd()}},{passive:true});
d.addEventListener('mouseleave',function(){hovEl=null;upd()});
d.addEventListener('click',function(ev){var t=ev.target;
 if(bar.contains(t)){var bt=t.closest('button');if(bt){ev.preventDefault();ev.stopPropagation();P({t:'act',id:cur&&cur.getAttribute('data-sec'),a:bt.getAttribute('data-a')})}return}
 if(editing&&editing.contains(t))return;
 var a=t.closest&&t.closest('a');if(a){var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'&&h.length>1){var x=d.querySelector(h);if(x)x.scrollIntoView({behavior:'smooth'})}ev.preventDefault()}
 var s=secOf(t);if(!s)return;var f=t.closest&&t.closest('[data-f]');var was=(cur===s);select(s,true);if(f&&was)startEdit(f)},true);
d.addEventListener('dblclick',function(ev){var f=ev.target.closest&&ev.target.closest('[data-f]');if(f){select(secOf(f),true);startEdit(f)}},true);
d.addEventListener('keydown',function(ev){if(!editing)return;if(ev.key==='Escape'){ev.preventDefault();endEdit(false)}else if(ev.key==='Enter'&&!ev.shiftKey&&!editing.hasAttribute('data-ml')){ev.preventDefault();endEdit(true)}},true);
d.addEventListener('focusout',function(ev){if(editing&&ev.target===editing)endEdit(true)},true);
d.addEventListener('paste',function(ev){if(!editing)return;ev.preventDefault();d.execCommand('insertText',false,(ev.clipboardData||w.clipboardData).getData('text/plain'))},true);
d.addEventListener('submit',function(ev){ev.preventDefault()},true);
var tm;w.addEventListener('scroll',function(){upd();clearTimeout(tm);tm=setTimeout(function(){P({t:'y',y:w.scrollY})},120)},{passive:true});
w.addEventListener('resize',upd);
if(w.ResizeObserver)new ResizeObserver(function(){upd()}).observe(d.body);
w.addEventListener('message',function(ev){var m=ev.data||{};
 if(m.t==='select'||m.t==='go'){var el=m.id?d.querySelector('[data-sec="'+m.id+'"]'):null;select(el,false);if(el&&m.t==='go'){el.scrollIntoView({behavior:'smooth',block:'start'})}}});
w.addEventListener('error',function(e){P({t:'err',m:String(e.message||e),l:e.lineno||0})});
w.addEventListener('unhandledrejection',function(e){P({t:'err',m:'Unhandled promise rejection: '+(e.reason&&e.reason.message||e.reason),l:0})});
P({t:'ready'});
})();`;

// ── finished-site viewer script: keep external links/forms inside the sandbox, report them to the host ──
const VIEW_JS = `(function(){var P=function(m){parent.postMessage(m,'*')};
document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';
 if(h.charAt(0)==='#'){if(h.length>1){var x=document.querySelector(h);if(x){ev.preventDefault();x.scrollIntoView({behavior:'smooth'})}}else{ev.preventDefault();window.scrollTo({top:0,behavior:'smooth'})}return}
 ev.preventDefault();P({t:'ext',u:h})},true);
document.addEventListener('submit',function(ev){ev.preventDefault();P({t:'form'})},true);
window.addEventListener('error',function(e){P({t:'err',m:String(e.message||e),l:e.lineno||0})});
})();`;

/* ───────── HTML ───────── */
export function buildSite(cfg: SiteConfig, opts: BuildOptions): BuiltSite {
  const prev = opts.mode === 'preview';
  const inline = opts.mode !== 'export';
  const t = cfg.theme;
  const code = cfg.code || { css: '', js: '', head: '' };
  const L = I18N[cfg.meta.lang] || I18N.en;
  const R = t.animations && !prev ? ' data-reveal' : ''; // the editor canvas shows everything immediately
  const D = (s: SectionInstance) => (prev ? ` data-sec="${s.id}" data-label="${e(SECTION_DEFS[s.type].label)}"${SECTION_DEFS[s.type].fixed ? ' data-fixed' : ''}` : '');
  const img = (v: string) => { const m = String(v || '').match(ASSET_RE); return m ? opts.assetSrc(m[1]) : String(v || ''); };
  const B1 = t.btnStyle === 'outline' ? 'btn-outline-brand' : 'btn-brand';
  /** Text that can be edited directly on the canvas (double-click). Plain text in the exported site. */
  const F = (s: SectionInstance, path: string, text: unknown, br = false) => {
    const inner = br ? nl2br(text) : e(text);
    return prev && String(text ?? '') !== '' ? `<span data-f="${s.id}|${path}"${br ? ' data-ml="1"' : ''}>${inner}</span>` : inner;
  };
  const A = (url: string, label: string, cls: string, s?: SectionInstance, path?: string) =>
    label ? `<a class="${cls}" href="${e(safeUrl(url) || '#')}"${isExt(url) ? ' target="_blank" rel="noopener"' : ''}>${s && path ? F(s, path, label) : e(label)}</a>` : '';
  const head = (s: SectionInstance) => {
    const d = s.data;
    return d.title || d.subtitle ? `<div class="section-head text-center"${R}>${d.title ? `<h2 class="section-title">${F(s, 'title', d.title)}</h2>` : ''}${d.subtitle ? `<p class="section-sub">${F(s, 'subtitle', d.subtitle, true)}</p>` : ''}</div>` : '';
  };
  const wrap = (s: SectionInstance, inner: string, cls = '') =>
    `<section id="sec-${s.id}"${D(s)} class="sec sec-${e(s.data.bg || 'default')} sp-${e(s.data.space || 'normal')} ${cls}">${inner}</section>`;
  const initial = (n: string) => e((n || '?').trim().charAt(0).toUpperCase());

  const navItems = cfg.sections
    .filter((s) => s.visible && s.type !== 'navbar' && s.type !== 'footer' && s.data.navLabel)
    .map((s) => `<li class="nav-item"><a class="nav-link" href="#sec-${s.id}">${e(s.data.navLabel)}</a></li>`)
    .join('');

  const render = (s: SectionInstance): string => {
    const d = s.data;
    switch (s.type) {
      case 'navbar': {
        const pos = d.style === 'transparent' ? 'fixed-top nav-transparent' : d.sticky ? 'sticky-top' : '';
        const brand = cfg.brand.logo ? `<img src="${e(img(cfg.brand.logo))}" alt="${e(cfg.brand.name)}" height="36" style="max-width:180px;object-fit:contain">` : e(cfg.brand.name);
        return `<nav class="navbar navbar-expand-lg site-nav ${pos}"${D(s)}><div class="container"><a class="navbar-brand" href="#">${brand}</a><button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav-main" aria-controls="nav-main" aria-expanded="false" aria-label="Menu"><span class="navbar-toggler-icon"></span></button><div class="collapse navbar-collapse" id="nav-main"><ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center gap-lg-1">${navItems}</ul>${d.ctaText ? `<div class="ms-lg-3 mt-2 mt-lg-0">${A(d.ctaUrl, d.ctaText, 'btn ' + B1, s, 'ctaText')}</div>` : ''}</div></div></nav>`;
      }
      case 'hero': {
        const btns = `${A(d.primaryUrl, d.primaryText, 'btn btn-lg ' + B1, s, 'primaryText')}${A(d.secondaryUrl, d.secondaryText, 'btn btn-lg btn-outline-brand', s, 'secondaryText')}`;
        const body = (center: boolean) => `${d.eyebrow ? `<span class="eyebrow">${F(s, 'eyebrow', d.eyebrow)}</span>` : ''}<h1 class="display-4 fw-bold">${F(s, 'title', d.title)}</h1><p class="lead">${F(s, 'subtitle', d.subtitle, true)}</p><div class="d-flex flex-wrap gap-3${center ? ' justify-content-center' : ''}">${btns}</div>`;
        if (d.variant === 'centered') return wrap(s, `<div class="container text-center"><div class="mx-auto" style="max-width:780px"${R}>${body(true)}</div></div>`, 'hero');
        if (d.variant === 'image') return wrap(s, `${d.image ? `<img class="hero-bg" src="${e(img(d.image))}" alt="">` : ''}<div class="hero-overlay ov-${e(d.overlay)}"></div><div class="container text-center position-relative"><div class="mx-auto" style="max-width:780px"${R}>${body(true)}</div></div>`, 'hero hero-image');
        return wrap(s, `<div class="container"><div class="row align-items-center g-5"><div class="col-lg-6"${R}>${body(false)}</div>${d.image ? `<div class="col-lg-6"${R}><img class="img-fluid rounded-brand shadow" src="${e(img(d.image))}" alt="${e(d.title)}"></div>` : ''}</div></div>`, 'hero');
      }
      case 'about': {
        const bullets = (d.bullets || []).map((b: any, i: number) => (b.text ? `<li><span class="tick">✓</span>${F(s, `bullets.${i}.text`, b.text)}</li>` : '')).join('');
        const text = `<div class="col-lg-6"${R}>${d.title ? `<h2 class="section-title">${F(s, 'title', d.title)}</h2>` : ''}${paras(d.text)}${bullets ? `<ul class="ticks">${bullets}</ul>` : ''}</div>`;
        const pic = d.image ? `<div class="col-lg-6${d.imageSide === 'left' ? ' order-lg-first' : ''}"${R}><img class="img-fluid rounded-brand shadow-sm" loading="lazy" src="${e(img(d.image))}" alt="${e(d.title)}"></div>` : '';
        return wrap(s, `<div class="container"><div class="row align-items-center g-5">${text}${pic}</div></div>`);
      }
      case 'features': {
        const cards = (d.items || []).map((it: any, i: number) => `<div class="col"><div class="card h-100 feature"${R}><div class="card-body p-4"><div class="icon">${e(it.icon)}</div><h3 class="h5">${F(s, `items.${i}.title`, it.title)}</h3><p class="mb-0">${F(s, `items.${i}.text`, it.text, true)}</p></div></div></div>`).join('');
        return wrap(s, `<div class="container">${head(s)}<div class="row row-cols-1 row-cols-md-2 row-cols-lg-${e(d.columns)} g-4">${cards}</div></div>`);
      }
      case 'stats': {
        const items = (d.items || []).map((it: any, i: number) => {
          const n = parseFloat(String(it.value).replace(/,/g, ''));
          const num = Number.isFinite(n) ? `<span class="counter" data-to="${n}">${e(it.value)}</span>` : e(it.value);
          return `<div class="col-6 col-md"${R}><div class="stat-num">${num}${e(it.suffix)}</div><div class="stat-label">${F(s, `items.${i}.label`, it.label)}</div></div>`;
        }).join('');
        return wrap(s, `<div class="container"><div class="row text-center g-4 justify-content-center">${items}</div></div>`);
      }
      case 'gallery': {
        const items = (d.images || []).map((g: any, i: number) => (g.image ? `<div class="col"${R}><figure class="gal"><img loading="lazy" src="${e(img(g.image))}" alt="${e(g.caption || d.title)}">${g.caption ? `<figcaption>${F(s, `images.${i}.caption`, g.caption)}</figcaption>` : ''}</figure></div>` : '')).join('');
        return wrap(s, `<div class="container">${head(s)}<div class="row row-cols-1 row-cols-sm-2 row-cols-lg-${e(d.columns)} g-3">${items}</div></div>`);
      }
      case 'testimonials': {
        const who = (it: any, i: number) => `<div class="who">${it.avatar ? `<img class="avatar" loading="lazy" src="${e(img(it.avatar))}" alt="${e(it.name)}">` : `<span class="avatar ph">${initial(it.name)}</span>`}<div><strong>${F(s, `items.${i}.name`, it.name)}</strong><div class="small" style="color:var(--c-muted)">${F(s, `items.${i}.role`, it.role)}</div></div></div>`;
        const items: any[] = d.items || [];
        if (d.variant === 'carousel' && items.length) {
          const cid = `car-${s.id}`;
          return wrap(s, `<div class="container">${head(s)}<div id="${cid}" class="carousel slide" data-bs-ride="carousel"><div class="carousel-inner">${items.map((it, i) => `<div class="carousel-item${i === 0 ? ' active' : ''}"><div class="testi mx-auto text-center" style="max-width:720px"><blockquote>“${F(s, `items.${i}.quote`, it.quote, true)}”</blockquote>${who(it, i)}</div></div>`).join('')}</div><div class="carousel-indicators position-static mt-3">${items.map((_, i) => `<button type="button" data-bs-target="#${cid}" data-bs-slide-to="${i}"${i === 0 ? ' class="active" aria-current="true"' : ''} aria-label="Slide ${i + 1}"></button>`).join('')}</div></div></div>`);
        }
        return wrap(s, `<div class="container">${head(s)}<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">${items.map((it, i) => `<div class="col"><div class="card h-100 testi"${R}><blockquote>“${F(s, `items.${i}.quote`, it.quote, true)}”</blockquote>${who(it, i)}</div></div>`).join('')}</div></div>`);
      }
      case 'pricing': {
        const plans: any[] = d.plans || [];
        const cards = plans.map((p, i) => `<div class="col"><div class="card price${p.highlight ? ' featured' : ''}"${R}><h3 class="h5">${F(s, `plans.${i}.name`, p.name)}</h3><div class="amount">${F(s, `plans.${i}.price`, p.price)}</div><div style="color:var(--c-muted)">${F(s, `plans.${i}.period`, p.period)}</div><ul>${lines(p.features).map((f) => `<li>${e(f)}</li>`).join('')}</ul>${A(p.buttonUrl, p.buttonText, 'btn w-100 ' + (p.highlight ? 'btn-brand' : 'btn-outline-brand'), s, `plans.${i}.buttonText`)}</div></div>`).join('');
        return wrap(s, `<div class="container">${head(s)}<div class="row row-cols-1 row-cols-lg-${Math.min(3, Math.max(1, plans.length))} g-4 justify-content-center">${cards}</div></div>`);
      }
      case 'team': {
        const m = (d.members || []).map((p: any, i: number) => `<div class="col"${R}>${p.photo ? `<img class="team-photo" loading="lazy" src="${e(img(p.photo))}" alt="${e(p.name)}">` : `<span class="team-photo ph">${initial(p.name)}</span>`}<h3 class="h6 mb-0">${F(s, `members.${i}.name`, p.name)}</h3><div class="small" style="color:var(--c-muted)">${F(s, `members.${i}.role`, p.role)}</div></div>`).join('');
        return wrap(s, `<div class="container">${head(s)}<div class="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-4 text-center">${m}</div></div>`);
      }
      case 'faq': {
        const aid = `acc-${s.id}`;
        const items = (d.items || []).map((it: any, i: number) => `<div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button${i ? ' collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#${aid}-${i}" aria-expanded="${i === 0}">${F(s, `items.${i}.q`, it.q)}</button></h3><div id="${aid}-${i}" class="accordion-collapse collapse${i === 0 ? ' show' : ''}" data-bs-parent="#${aid}"><div class="accordion-body">${F(s, `items.${i}.a`, it.a, true)}</div></div></div>`).join('');
        return wrap(s, `<div class="container" style="max-width:820px">${head(s)}<div class="accordion"${R} id="${aid}">${items}</div></div>`);
      }
      case 'cta':
        return wrap(s, `<div class="container text-center"${R}><h2 class="section-title">${F(s, 'title', d.title)}</h2>${d.text ? `<p class="lead mb-4">${F(s, 'text', d.text, true)}</p>` : ''}${A(d.buttonUrl, d.buttonText, 'btn btn-lg ' + B1, s, 'buttonText')}</div>`);
      case 'text':
        return wrap(s, `<div class="container" style="max-width:820px"><div${R} class="${d.align === 'center' ? 'text-center' : ''}">${d.title ? `<h2 class="section-title">${F(s, 'title', d.title)}</h2>` : ''}${paras(d.body)}</div></div>`);
      case 'html':
        return wrap(s, String(d.html || ''), 'sec-html'); // the owner's own markup, deliberately NOT escaped (runs only in their site / our sandbox)
      case 'contact': {
        const wa = String(d.whatsapp || '').replace(/\D/g, '');
        const info = [
          d.email && `<li>✉️ <a href="mailto:${e(d.email)}">${e(d.email)}</a></li>`,
          d.phone && `<li>📞 <a href="tel:${e(String(d.phone).replace(/[^\d+]/g, ''))}">${e(d.phone)}</a></li>`,
          d.address && `<li>📍 ${nl2br(d.address)}</li>`,
        ].filter(Boolean).join('');
        const waBtn = wa ? `<a class="btn btn-brand mt-2" href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 ${e(L.call)}</a>` : '';
        const mapOk = /^https:\/\/(www\.google\.com\/maps\/embed|maps\.google\.com\/maps|www\.openstreetmap\.org\/export\/embed)/.test(d.mapUrl || '');
        const map = mapOk ? `<iframe class="map mt-4" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${e(d.mapUrl)}" title="Map"></iframe>` : '';
        const canForm = d.formEnabled && (d.formAction || d.email || inline);
        const mode = d.formAction ? ` action="${e(safeUrl(d.formAction))}" method="POST"` : d.email ? ` data-mailto="${e(d.email)}"` : '';
        const form = canForm ? `<div class="col-lg-7"${R}><form${mode}><div class="row g-3"><div class="col-md-6"><label class="form-label" for="cf-n-${s.id}">${e(L.name)}</label><input class="form-control" id="cf-n-${s.id}" name="name" required></div><div class="col-md-6"><label class="form-label" for="cf-e-${s.id}">${e(L.email)}</label><input class="form-control" id="cf-e-${s.id}" type="email" name="email" required></div><div class="col-12"><label class="form-label" for="cf-m-${s.id}">${e(L.msg)}</label><textarea class="form-control" id="cf-m-${s.id}" name="message" rows="5" required></textarea></div><div class="col-12"><button class="btn ${B1}" type="submit">${e(d.submitText)}</button></div></div></form></div>` : '';
        return wrap(s, `<div class="container">${head(s)}<div class="row g-5 justify-content-center"><div class="${canForm ? 'col-lg-5' : 'col-lg-7'}"${R}><ul class="contact-info">${info}</ul>${waBtn}${map}</div>${form}</div></div>`);
      }
      case 'footer': {
        const socials = ([['facebook', 'Facebook'], ['instagram', 'Instagram'], ['x', 'X'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['linkedin', 'LinkedIn']] as const)
          .filter(([k]) => d[k]).map(([k, n]) => `<li><a href="${e(d[k])}" target="_blank" rel="noopener">${n}</a></li>`).join('');
        const links = (d.links || []).filter((l: any) => l.label).map((l: any) => `<li><a href="${e(safeUrl(l.url) || '#')}">${e(l.label)}</a></li>`).join('');
        return `<footer${D(s)} class="site-footer sec sec-${e(d.bg || 'dark')} sp-compact"><div class="container"><div class="row g-4"><div class="col-md-6"><div class="fw-bold fs-5">${e(cfg.brand.name)}</div><p class="mt-2 mb-0" style="opacity:.8">${F(s, 'about', d.about, true)}</p></div><div class="col-6 col-md-3">${links ? `<ul>${links}</ul>` : ''}</div><div class="col-6 col-md-3">${socials ? `<ul>${socials}</ul>` : ''}</div></div><hr style="opacity:.2"><div class="small" style="opacity:.75">${F(s, 'copyright', d.copyright)}</div></div></footer>`;
      }
    }
  };

  const body = cfg.sections.filter((s) => s.visible || s.type === 'navbar' || s.type === 'footer').map(render).join('\n');
  const css = buildCss(cfg) + PREVIEW_CSS;
  const fp = FONT_PAIRS.find((f) => f.id === t.fontPair) || FONT_PAIRS[0];
  const bs = opts.bootstrap || BS_CDN;
  const fav = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${cfg.meta.favicon || '🚀'}</text></svg>`)}`;
  const inJs = (x: string) => x.replace(/<\/script/gi, '<\\/script');
  const inCss = (x: string) => x.replace(/<\/style/gi, '<\\/style');
  const html = `<!doctype html>
<html lang="${e(cfg.meta.lang)}" data-bs-theme="${t.mode}"${cfg.meta.lang === 'ar' ? ' dir="rtl"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(cfg.meta.title)}</title>
<meta name="description" content="${e(cfg.meta.description)}">
<meta property="og:title" content="${e(cfg.meta.title)}">
<meta property="og:description" content="${e(cfg.meta.description)}">
<meta property="og:type" content="website">
<meta name="theme-color" content="${t.primary}">
<link rel="icon" href="${fav}">
${fp.google ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fp.google}&display=swap">` : ''}
<link rel="stylesheet" href="${e(bs.css)}">
${inline ? `<style>${inCss(css)}</style>` : '<link rel="stylesheet" href="css/style.css">'}
${code.css ? (inline ? `<style id="custom-css">${inCss(code.css)}</style>` : '<link rel="stylesheet" href="css/custom.css">') : ''}
${code.head || ''}
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
${body}
<button id="toTop" type="button" aria-label="${e(L.top)}">↑</button>
<script src="${e(bs.js)}"></script>
${inline ? `<script>${SITE_JS}</script>\n<script>${prev ? PREVIEW_JS : VIEW_JS}</script>` : '<script src="js/script.js"></script>'}
${code.js ? (inline ? `<script>${inJs(code.js)}</script>` : '<script src="js/custom.js"></script>') : ''}
</body>
</html>`;
  return { html, css, js: SITE_JS, customCss: code.css, customJs: code.js };
}

export function readmeText(cfg: SiteConfig, localBootstrap: boolean): string {
  const hasCode = !!(cfg.code?.css || cfg.code?.js);
  return `${cfg.brand.name} — your website
${'='.repeat(40)}

WHAT'S INSIDE
  index.html        your website (open it in any browser)
  css/style.css     colours, fonts and layout
  ${cfg.code?.css ? 'css/custom.css    your own custom CSS\n  ' : ''}js/script.js      menu, animations, counters, gallery pop-up
  ${cfg.code?.js ? 'js/custom.js     your own custom JavaScript\n  ' : ''}assets/           the pictures you uploaded
  ${localBootstrap ? 'vendor/bootstrap/ Bootstrap 5.3 (bundled, works offline)' : 'Bootstrap 5.3 is loaded from the jsDelivr CDN (needs internet when visitors open the site)'}

PUTTING IT ONLINE
  Upload every file and folder in this zip to your web hosting (public_html / www),
  keeping the same folder structure. index.html must be at the top level.
  Free options: Netlify Drop, GitHub Pages, Cloudflare Pages (drag the unzipped folder).

EDITING LATER
  You can open index.html in any code editor (VS Code, Notepad++).${hasCode ? '\n  Your custom code lives in the custom.css / custom.js files.' : ''}

CONTACT FORM
  - If you pasted a form service link (e.g. Formspree) it posts there.
  - Otherwise the visitor's email app opens, addressed to the email you entered.

GOOD TO KNOW
  - Pictures that start with https://images.unsplash.com are loaded from Unsplash.
    Replace them with your own photos for a site that is fully yours.
  - Google Fonts are loaded from Google unless you chose "System fonts".
  - Made with the Template Builder.
`;
}
