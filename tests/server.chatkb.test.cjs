// The built-in (no-LLM) assistant must answer common visitor questions with the right topic.
const H = require('./server-setup.cjs'); const { ok } = H;
global.fetch = async () => { throw new Error('offline'); };
const E = H.req('utils/chatEngine/index');
const mem = () => ({ interactionCount: 0, lastTopic: 'general', userContext: {}, conversationHistory: [] });
const CASES = [
  ['what is ai', /Software that does things/], ['what is wifi', /Wi-Fi/], ['what is the cloud', /someone else/], ['what is a pixel', /smallest dot/],
  ['capital of kenya', /Nairobi/], ['what is the capital of uganda', /Kampala/], ['translate thank you to luganda', /Webale/], ['what is the square root of 144', /12/],
  ['which model are you', /own assistant/], ['how old are you', /birthday/], ['battery swelling what should i do', /fire risk/], ['i forgot my pin', /legitimate/],
  ['how can i recover my whatsapp chats', /Chat backup/], ['how do i install windows', /bootable USB/], ['how do i speed up my phone', /full storage/],
  ['what is the best phone in uganda', /storage/i], ['do you use wordpress', /Next\.js/], ['can you teach me coding', /HTML/], ['how do i get clients as a designer', /portfolio/],
  ['do you ship outside kampala', /Design and web work/], ['what is the speed of light', /299,792/], ['why is the sky blue', /scatter/], ['what year is it', /It's \*\*20/],
  ['write code for a calculator', /full language model/], ['why should i choose you', /one person/], ['do you have testimonials', /won't make any up/],
  ['are you certified', /won't guess/], ['that was helpful', /Glad that helped/], ['tell me more', /Ask me something first/], ['hw much 4 screen', /Pricing/],
  ['my phn wont on', /won.t start/], ['do you have a shop', /Ndejje/], ['dark mode', /dark mode/], ['light mode', /light mode/], ['turn off the lights', /dark mode/],
  ['your whatsapp number', /\+256752225156/], ['whatsapp backup', /Chat backup/], ['what is your email', /raytbolt@gmail\.com/],
  ['my laptop shows KERNEL_DATA_INPAGE_ERROR on a blue screen', /Drive or boot failure/], ['npm ERR! Error: ENOSPC: no space left on device', /Disk full/], ['do you fix laptops', /PCs and laptops/], ['do you fix phones', /repair phones/], ['what is react', /JavaScript library/],
  ['can i track my repair', /Track/], ['where is my order', /Track/], ['who is ray', /Ray Thund3r/],
  ['do you do embroidery files', /embroidery/i], ['how do i pay', /mobile money/i], ['do you take mobile money', /MTN or Airtel/],
  ['what is 15% of 24000', /3,600/], ['whats ur whatsapp', /\+256752225156/], ['your whatsapp number', /\+256752225156/], ['whatsapp backup', /Chat backup/], ['what is your email', /raytbolt@gmail\.com/], ['where are you located', /Ndejje/],
];
(async () => {
  for (const [q, re] of CASES) { const r = await E.processChatQuery(q, 'FRIENDLY', mem(), {}); ok(`"${q}"`, re.test(r.reply), `[${r.source}]`); }
  const r = await E.processChatQuery('how much is the moon made of cheese zzqx', 'FRIENDLY', mem(), {});
  ok('unknown question does not invent a business fact', !/Ndejje|MTN|\+256/.test(r.reply));
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
