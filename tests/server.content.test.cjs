const H = require('./server-setup.cjs');
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fail++; };
(async () => {
  process.env.DATA_DIR = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'cnt-'));
  const C = H.req('lib/siteContent'), St = H.req('server/store');
  ok('garbage input yields defaults', JSON.stringify(C.normalizeContent(null)) === JSON.stringify(C.DEFAULT_CONTENT));
  ok('empty store gives defaults', (await St.getSiteContent()).reviews.length === 0);
  const n = C.normalizeContent({
    reviews: [{ name: 'Sarah', text: 'Great <b>work</b>', rating: 9, source: 'evil' }, { name: '', text: 'no name' }, { name: 'X', text: '' }],
    prices: [{ name: 'Screen', from: '50,000', to: '30000' }, { name: 'Logo', from: 'abc' }, { name: '' }],
    faqs: [{ q: 'Do you deliver?', a: 'Yes' }, { q: 'no answer', a: '' }],
    guides: [{ title: 'How much is a website? Uganda!', body: '## Hi', published: true, date: '2026-11-24' }, { title: 'Draft', body: 'x', published: 'yes' }, { title: 'No body', body: '' }],
    local: { mapsUrl: 'javascript:alert(1)', reviewUrl: 'https://g.page/r/abc/review', areas: 'Ndejje, Ssabagabo' },
    promise: { enabled: true, points: ['a', '', 'b', 'c', 'd', 'e', 'f', 'g'] }, stats: [{ label: 'Repaired', value: '250+' }, { label: '', value: '1' }], evil: 1,
  });
  ok('rows without name/text dropped', n.reviews.length === 1 && n.faqs.length === 1 && n.guides.length === 2 && n.prices.length === 2);
  ok('rating clamped, bad source cleared', n.reviews[0].rating === 5 && n.reviews[0].source === '');
  ok('money parsed; "to" must exceed "from"', n.prices[0].from === 50000 && n.prices[0].to === 0 && n.prices[1].from === 0);
  ok('guide slug from title, published only when literally true', n.guides[0].id === 'how-much-is-a-website-uganda' && n.guides[0].published && n.guides[1].published === false);
  ok('script link dropped, https link kept', n.local.mapsUrl === '' && n.local.reviewUrl === 'https://g.page/r/abc/review');
  ok('points capped at 6, blanks dropped; blank stat dropped', n.promise.points.length === 6 && n.stats.length === 1 && !('evil' in n));
  const dup = C.normalizeContent({ guides: [{ title: 'Same', body: 'a' }, { title: 'Same', body: 'b' }] });
  ok('duplicate slugs made unique', dup.guides[0].id !== dup.guides[1].id);
  await St.saveSiteContent({ reviews: [{ id: 'r1', name: 'Amina', text: 'Fast and fair.' }], prices: [{ name: 'Battery', from: 80000 }] });
  const back = await St.getSiteContent();
  ok('save → read round-trips', back.reviews[0].name === 'Amina' && back.prices[0].from === 80000 && back.reviews[0].shown === true);
  ok('hasContent reflects what is shown', C.hasContent(back) && !C.hasContent(C.DEFAULT_CONTENT));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
