// Packages, request photos, before/after jobs and the sample jobs.
const H = require('./server-setup.cjs');
let fail = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fail++; };
const rejects = async (p) => { try { await p; return false; } catch { return true; } };
const png = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
const jpg = 'data:image/jpeg;base64,' + Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex').toString('base64');
(async () => {
  // packages
  const C = H.req('lib/siteContent');
  const c = C.normalizeContent({ packages: [
    { name: 'Logo', kind: 'design', from: '150,000', turnaround: '3 days', includes: ['a', 'b', '', 'c'], popular: true },
    { name: 'Odd', kind: 'weird', includes: Array.from({ length: 30 }, (_, i) => 'x' + i) },
    { name: '', kind: 'repair' },
  ], remote: { enabled: false, intro: 'Hi' } });
  ok('packages: nameless rows dropped, bad kind falls back to design', c.packages.length === 2 && c.packages[1].kind === 'design');
  ok('packages: price parsed, blanks removed', c.packages[0].from === 150000 && c.packages[0].includes.length === 3 && c.packages[0].popular === true);
  ok('packages: includes capped', c.packages[1].includes.length === C.LIMITS.includes);
  ok('remote switch kept, default is on', c.remote.enabled === false && C.normalizeContent({}).remote.enabled === true);
  ok('chat facts mention shown packages only', C.contentFacts(C.normalizeContent({ packages: [{ name: 'Logo', from: 100000, shown: true }, { name: 'Secret', shown: false }] })).includes('Logo') && !C.contentFacts(C.normalizeContent({ packages: [{ name: 'Secret', shown: false }] })).includes('Secret'));

  // request photos
  const P = H.req('server/ticketPhotos');
  ok('photos: real png and jpeg accepted', P.validPhotos([png, jpg]).length === 2);
  ok('photos: a renamed non-image is refused', P.validPhotos(['data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64')]).length === 0);
  ok('photos: html data URL refused, max 3 kept', P.validPhotos(['data:text/html;base64,PGI+']).length === 0 && P.validPhotos([png, png, png, png, png]).length === 3);
  ok('photos: oversized refused', P.validPhotos(['data:image/png;base64,' + 'A'.repeat(P.MAX_TICKET_PHOTO + 5)]).length === 0);
  const n = await P.saveTicketPhotos('SYS-TEST1', P.validPhotos([png, jpg]));
  const back = await P.getTicketPhotos('SYS-TEST1', n);
  ok('photos: saved and read back', n === 2 && back.length === 2 && back[0].startsWith('data:image/png'));
  ok('photos: bad ticket id writes nothing', (await P.saveTicketPhotos('../x', P.validPhotos([png]))) === 0);
  await P.deleteTicketPhotos('SYS-TEST1');
  ok('photos: deleted', (await P.getTicketPhotos('SYS-TEST1', 2)).length === 0);

  // before / after jobs
  const R = H.req('server/repairs'), RD = H.req('server/repairsDemo');
  ok('jobs: sample jobs have both pictures', RD.demoRepairs().length === 3 && RD.demoRepairs().every((j) => RD.demoRepairSvg(j.id, 'before').startsWith('<svg') && RD.demoRepairSvg(j.id, 'after').startsWith('<svg')) && RD.demoRepairSvg('x', 'after') === null);
  ok('jobs: start empty', (await R.listRepairs()).length === 0);
  ok('jobs: both pictures are required', await rejects(R.saveRepair({ item: { title: 'Only one' }, before: png })));
  let l = await R.saveRepair({ item: { title: '<b>Phone</b> screen', kind: 'design' }, before: png, after: jpg, w: 800, h: 600 });
  const j = l[0];
  ok('jobs: saved with clean fields', l.length === 1 && !j.title.includes('<') && j.kind === 'design' && j.v === 1 && j.w === 800);
  ok('jobs: pictures come back', (await R.getRepairImage(j.id, 'before')).type === 'image/png' && (await R.getRepairImage(j.id, 'after')).type === 'image/jpeg');
  l = await R.saveRepair({ item: { id: j.id, title: 'Renamed', shown: false } });
  ok('jobs: edit keeps pictures and version', l[0].title === 'Renamed' && l[0].shown === false && l[0].v === 1 && !!(await R.getRepairImage(j.id, 'after')));
  l = await R.saveRepair({ item: { id: j.id }, after: png });
  ok('jobs: a new picture bumps the version', l[0].v === 2);
  ok('jobs: html picture refused', await rejects(R.saveRepair({ item: { title: 'X' }, before: 'data:text/html;base64,PGI+', after: png })));
  await R.saveRepair({ item: { title: 'Second' }, before: png, after: png });
  l = await R.moveRepair((await R.listRepairs())[0].id, 'down');
  ok('jobs: reorder moves the first one down', l.length === 2 && l[1].title === 'Second' && l[0].title === 'Renamed');
  l = await R.deleteRepair(j.id);
  ok('jobs: delete removes the pictures', l.length === 1 && !(await R.getRepairImage(j.id, 'before')));
  // mobile-money: one registered name per network, panel values win, env fills the blanks
  const PD = H.req('server/payDetails');
  const nm = PD.normalizePay({ mtnNumber: '0700 <b>111', mtnName: ' Ann  Mbabazi ', airtelNumber: '0750222', airtelName: 'Brian K' });
  ok('pay: numbers keep digits only, names are tidied', nm.mtnNumber === '0700 111' && nm.mtnName === 'Ann Mbabazi' && nm.airtelName === 'Brian K');
  const ev = PD.envPay({ MOMO_MTN_NUMBER: '0700', MOMO_AIRTEL_NUMBER: '0750', MOMO_ACCOUNT_NAME: 'Shared Name' });
  ok('pay: old shared env name still fills both networks', ev.mtnName === 'Shared Name' && ev.airtelName === 'Shared Name');
  const ev2 = PD.envPay({ MOMO_MTN_NUMBER: '0700', MOMO_MTN_NAME: 'A', MOMO_AIRTEL_NUMBER: '0750', MOMO_AIRTEL_NAME: 'B', MOMO_ACCOUNT_NAME: 'S' });
  ok('pay: per-network env names beat the shared one', ev2.mtnName === 'A' && ev2.airtelName === 'B');
  await PD.savePay({ mtnNumber: '0701', mtnName: 'Panel MTN Name', airtelNumber: '', airtelName: '' });
  const gd = await PD.getPayDetails();
  ok('pay: saved values are read back', gd.mtnNumber === '0701' && gd.mtnName === 'Panel MTN Name');
  const TV = H.req('server/ticketView');
  const pub = TV.toPublic({ id: 'T-1', kind: 'template', status: 'NEW', createdAt: '', updatedAt: '', history: [], payments: [], depositUGX: 5000 }, { mtnNumber: '1', mtnName: 'X', airtelNumber: '2', airtelName: 'Y', note: '' });
  ok('pay: a ticket shows each network with its own name', pub.pay && pub.pay.mtnName === 'X' && pub.pay.airtelName === 'Y');

  console.log(fail ? `\n${fail} FAILED` : '\nALL PASS'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
