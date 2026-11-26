const H = require('./server-setup.cjs');
const S = H.req('lib/spamFilter');
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fail++; };
const j = (o, cfg) => S.judgeMessage(o, cfg);
const good = [
  { name: 'Ann Nakato', phone: '0772123456', details: 'My Samsung A12 screen is cracked and the battery drains fast. How much to fix and how long does it take?' },
  { name: 'John', email: 'john@gmail.com', details: 'Hello, I need a logo and a small website for my salon in Ndejje. What are your prices?' },
  { name: 'Sarah K', phone: '0700111222', details: 'hi, laptop wont switch on after water spill' },
  { name: 'Brian', email: 'b@yahoo.com', details: 'Can I book a visit tomorrow morning for my printer?' },
  { name: 'Mugisha', phone: '0751000999', details: 'Wasiliza, nkwagala okuddaabiriza essimu yange. Ssente mmeka?' },
  { name: 'Dr. Okello', email: 'okello@hospital.org', details: 'We need an app design for our clinic. See our current site https://clinic.example.org for what we have now.' },
];
good.forEach((g, i) => { const v = j(g); ok(`real message ${i + 1} passes`, v.level === 'ok', JSON.stringify(v)); });
const bad = [
  ['SEO pitch', { name: 'Mark', email: 'mark@seoboost.com', details: 'Hello, our team offers SEO services and backlinks to rank your website on the first page of Google. Reply for a quote.' }],
  ['crypto + links', { name: 'Linda', details: 'Make $500 a day with bitcoin investment! Join https://bit.ly/x and www.cryptogain.top now' }],
  ['keyboard mash', { name: 'asdfgh', details: 'asdf jkl qwerty zxcvbn hjkl asdfgh' }],
  ['casino', { name: 'Vip', details: 'Best online casino and betting jackpot bonus click here' }],
  ['gibberish', { name: 'xkcdpqrst', details: 'sdkfjhsdkjfh wlkjrhwlkejrhw lkjsdhflkj' }],
  ['adult', { name: 'Hot', details: 'hot girls and singles in your area, escort service' }],
  ['cyrillic', { name: 'Ivan', details: 'Привет, мы предлагаем услуги по продвижению вашего сайта и рекламе недорого' }],
  ['throwaway + short', { name: 'x', email: 'a@mailinator.com', details: 'hi' }],
];
bad.forEach(([n, o]) => { const v = j(o); ok(`${n} is blocked or held`, v.level !== 'ok', JSON.stringify(v)); });
ok('obvious spam is a hard block', j(bad[1][1]).level === 'block' && j(bad[0][1]).level === 'block');
ok('off-topic long message gets held at strict, not blocked at relaxed', j({ name: 'Tom', details: 'I would like to know your opinion about the weather in Paris and whether the football season has started yet this year' }, { ...S.DEFAULT_SPAM_CFG, level: 'strict' }).level !== 'ok' && j({ name: 'Tom', details: 'I would like to know your opinion about the weather in Paris and whether the football season has started yet this year' }, { ...S.DEFAULT_SPAM_CFG, level: 'relaxed' }).level === 'ok');
ok('owner blocked word works', j({ name: 'Zed', details: 'please repair my phone, also free followers' }, { ...S.DEFAULT_SPAM_CFG, blockWords: ['free followers'] }).level !== 'ok');
ok('extra topic words rescue an on-topic long message', j({ name: 'Tom', details: 'I would like to know about tailoring services for a school uniform order for about two hundred pupils next term' }, { ...S.DEFAULT_SPAM_CFG, topicWords: ['tailoring'] }).level === 'ok');
ok('filter can be switched off', j(bad[1][1], { ...S.DEFAULT_SPAM_CFG, enabled: false }).level === 'ok');
ok('a form filled in under 1.5 s is treated as a bot', (() => { const v = j({ name: 'Ann', details: 'My phone screen is cracked, please help me fix it today', elapsedMs: 400 }); return v.level !== 'ok'; })());
ok('config sanitizer', JSON.stringify(S.sanitizeSpamCfg({ level: 'weird', blockWords: 'a, Bad Word ,x', enabled: 0 })) === JSON.stringify({ enabled: true, level: 'normal', blockWords: ['bad word'], topicWords: [] }));
process.exit(fail ? 1 : 0);
