// Offline world-knowledge base: answers must be right, and must not hijack unrelated questions.
const H = require('./server-setup.cjs'); const { ok } = H;
global.fetch = async () => { throw new Error('offline'); };
const E = H.req('utils/chatEngine/index');
const mem = () => ({ interactionCount: 0, lastTopic: 'general', userContext: {}, conversationHistory: [] });
const CASES = [
  ['symbol of gold', /\*\*Au\*\*/], ['what is the chemical symbol for sodium', /\*\*Na\*\*/], ['atomic number of carbon', /\*\*6\*\*/], ['what element has atomic number 26', /Iron/],
  ['what does HTTP stand for', /HyperText Transfer Protocol/], ['what does html stand for', /HyperText Markup/], ['what does api stand for', /Application Programming Interface/],
  ['who created python', /Guido van Rossum/], ['when was javascript created', /1995/], ['what is python used for', /data science/],
  ['currency of ghana', /cedi/], ['what currency does japan use', /yen/], ['calling code of nigeria', /\+234/], ['what languages are spoken in tanzania', /Swahili/],
  ['which continent is brazil in', /South America/], ['tell me about kenya', /Nairobi/], ['when did uganda get independence', /9 October 1962/],
  ['who was nelson mandela', /anti-apartheid/], ['who was albert einstein', /relativity/], ['when did world war 2 end', /1945/],
  ['when was google founded', /1998/], ['who founded microsoft', /Bill Gates/], ['what time is it in london', /London/], ['time difference between kampala and new york', /8 hours/],
  ['what is the ugandan flag', /six horizontal stripes/], ['how do i treat a burn', /20 minutes/], ['how to take a screenshot on windows', /Win \+ Shift \+ S/], ['what is malaria', /mosquito/],
  ['what is the capital of france', /Paris/], ['tell me about mars', /red planet/], ['how many bones in the human body', /206/], ['why is the ocean salty', /salts/],
  ['who painted the mona lisa', /Leonardo/], ['how to stop a nosebleed', /forward/], ['what is the highest mountain in the world', /Everest/], ['whos the tallest animal', /giraffe/],
  ['is a tomato a fruit', /fruit/], ['how can i prevent malaria', /net/], ['who invented the telephone', /Bell/], ['how to register a business in uganda', /URSB/],
  ['what is the tallest building in africa', /Iconic Tower/], ['how many people live in kampala', /1\.7 million/], ['how long does a laptop battery last', /3 to 10 hours/], ['define serendipity', /by chance/], ['synonym of happy', /joyful/], ['how do you say hello in french', /Bonjour/], ['thank you in spanish', /Gracias/], ['what does lol mean', /laughing out loud/],
  ['who wrote the lord of the rings', /Tolkien/], ['how do airplanes fly', /lift/], ['what is the smallest bone in the human body', /stapes/], ['who won the world cup in 2022', /Argentina/], ['what is the national dish of uganda', /matooke/], ['what is the difference between a virus and bacteria', /Bacteria/], ['difference between affect and effect', /noun/],
  ['where is kampala', /capital and largest city/], ['how far is kampala from entebbe', /35 to 40 km/], ['what time zone is uganda in', /UTC\+3/], ['what is canva', /design tool/], ['what color should my website be', /contrast/], ['what is the difference between a graphic designer and a ui designer', /UI.*user interface/], ['is coffee bad for you', /caffeine/], ['how long can a human live without water', /3 days/],
  ['what is the square of 12', /144/], ['what is html css and javascript', /structure/], ['what is the smallest country in africa', /Seychelles/], ['who was the first woman in space', /Tereshkova/], ['how many bones does a baby have', /300/], ['what is the chemical formula for salt', /NaCl/], ['what gas do plants absorb', /carbon dioxide/], ['when did slavery end', /1833/], ['what is capitalism', /markets/], ['how to write a cv', /summary/], ['what is the weather like in uganda', /rainy seasons/],
  ['uganda calling code', /\+256/], ['what is the national bird of uganda', /crane/], ['what is mobile money', /phone number/], ['how many continents are there', /7|seven/],
  ['how many days in a leap year', /366/], ['what is the pythagorean theorem', /a² \+ b² = c²/], ['who was the first person on the moon', /Armstrong/],
  ['what does ssd stand for', /Solid/i], ['what is a vector graphic', /Vector/], ['what is the difference between ram and storage', /temporary/],
];
// These must NOT be taken over by the offline world base.
const NOT = [['is coffee bad for you', /Liquid damage/], ['where is kampala', /Ndejje/], ['what is the tallest building in africa', /Burj Khalifa/], ['how long does a laptop battery last', /repairs 24/], ['what is it', /Information Technology/], ['how much for a logo', /Gold|Au\b/], ['hello', /Paris|stand for/], ['i want a website for my shop', /continent|calling code/], ['what is the time', /UTC/]];
(async () => {
  for (const [q, re] of CASES) { const r = await E.processChatQuery(q, 'FRIENDLY', mem(), {}); ok(`"${q}"`, re.test(r.reply), `[${r.source}] ${r.reply.slice(0, 90)}`); }
  for (const [q, re] of NOT) { const r = await E.processChatQuery(q, 'FRIENDLY', mem(), {}); ok(`not hijacked: "${q}"`, !re.test(r.reply), r.reply.slice(0, 90)); }
  const W = H.req('utils/chatEngine/world/index').WORLD_STATS;
  ok('knowledge base has real volume', W.countries >= 100 && W.elements === 118 && W.facts > 250, JSON.stringify(W));
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
