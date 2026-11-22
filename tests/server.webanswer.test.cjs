// Internet answers must stay on topic. Wikipedia is mocked with realistic, deliberately noisy search results
// (full-text search returns loosely related pages), so this proves the relevance logic, not the network.
const H = require('./server-setup.cjs'); const { ok } = H;
const PAGES = [
 ['Uganda', 'Uganda, officially the Republic of Uganda, is a landlocked country in East Africa. It is bordered to the east by Kenya, to the north by South Sudan, to the west by the Democratic Republic of the Congo, to the south-west by Rwanda, and to the south by Tanzania. The capital city is Kampala. Uganda has a population of about 45 million people, making it one of the most populous landlocked countries.'],
 ['Kampala', 'Kampala is the capital and largest city of Uganda. The city proper has a population of 1.68 million and is divided into five boroughs. It is on Lake Victoria.'],
 ['President of Uganda', 'The president of Uganda is the head of state and head of government of Uganda. The president is elected by popular vote and also leads the cabinet. The office has been held by Yoweri Museveni since 1986.'],
 ['Yoweri Museveni', 'Yoweri Kaguta Museveni is a Ugandan politician and former rebel leader who has served as the ninth president of Uganda since 1986.'],
 ['Kenya', 'Kenya, officially the Republic of Kenya, is a country in East Africa. Its capital and largest city is Nairobi. It has a population of about 55 million.'],
 ['Nairobi', 'Nairobi is the capital and largest city of Kenya. The city lies in the south of the country, in the Nairobi River basin.'],
 ['Solar panel', 'A solar panel is a device that converts light from the Sun into electricity by the photovoltaic effect. Solar panels are made of photovoltaic cells, usually of silicon, that absorb sunlight and release electrons, which flow as a current.'],
 ['Solar power', 'Solar power is the conversion of energy from sunlight into electricity, either directly using photovoltaics or indirectly using concentrated solar power.'],
 ['Solar power in Uganda', 'Solar power in Uganda is a growing sector, with several solar farms connected to the national grid and many households using solar home systems.'],
 ['Python (programming language)', 'Python is a high-level, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation. Python was created by Guido van Rossum and first released in 1991.'],
 ['Pythonidae', 'The Pythonidae, commonly known as pythons, are a family of nonvenomous snakes found in Africa, Asia, and Australia.'],
 ['Python (genus)', 'Python is a genus of nonvenomous snakes in the family Pythonidae, found in Africa and Asia.'],
 ['Mercury (planet)', 'Mercury is the first planet from the Sun and the smallest in the Solar System. It orbits the Sun once every 88 days.'],
 ['Mercury (element)', 'Mercury is a chemical element; it has symbol Hg and atomic number 80. It is a heavy, silvery d-block metal and the only metallic element that is liquid at standard conditions.'],
 ['Google', 'Google LLC is an American multinational technology company focusing on online advertising, search engine technology, cloud computing and artificial intelligence. It was founded on September 4, 1998, by Larry Page and Sergey Brin while they were PhD students at Stanford University.'],
 ['Larry Page', 'Lawrence Edward Page is an American businessman and computer scientist best known for co-founding Google with Sergey Brin.'],
 ['Alphabet Inc.', 'Alphabet Inc. is an American multinational technology conglomerate holding company headquartered in Mountain View, California. It was created in 2015 as the parent company of Google.'],
 ['Apple Inc.', 'Apple Inc. is an American multinational technology company headquartered in Cupertino, California. It was founded in 1976 by Steve Jobs, Steve Wozniak and Ronald Wayne.'],
 ['Apple', 'An apple is a round, edible fruit produced by an apple tree. Apple trees are cultivated worldwide and are the most widely grown species in the genus Malus.'],
 ['Elon Musk', 'Elon Reeve Musk is a businessman known for his leadership of Tesla, SpaceX and X. He was born on June 28, 1971, in Pretoria, South Africa.'],
 ['Tesla, Inc.', 'Tesla, Inc. is an American multinational automotive and clean energy company headquartered in Austin, Texas. It designs and sells electric vehicles.'],
 ['Nikola Tesla', 'Nikola Tesla was a Serbian-American engineer, futurist, and inventor. He is known for his contributions to the design of the modern alternating current electricity supply system.'],
 ['DNA', 'Deoxyribonucleic acid is a polymer composed of two polynucleotide chains that coil around each other to form a double helix. The polymer carries genetic instructions for the development, functioning, growth and reproduction of all known organisms.'],
 ['Wi-Fi', 'Wi-Fi is a family of wireless network protocols based on the IEEE 802.11 family of standards, which are commonly used for local area networking of devices and Internet access, allowing nearby digital devices to exchange data by radio waves.'],
 ['Router (computing)', 'A router is a computer and networking device that forwards data packets between computer networks, including internetworks such as the global Internet.'],
 ['Solid-state drive', 'A solid-state drive (SSD) is a type of solid-state storage device that uses integrated circuits to store data persistently. It is sometimes called semiconductor storage device or solid-state device.'],
 ['Hard disk drive', 'A hard disk drive (HDD), hard disk, hard drive, or fixed disk is an electro-mechanical data storage device that stores and retrieves digital data using magnetic storage with one or more rigid rapidly rotating platters.'],
 ['Laptop', 'A laptop computer, also known as a notebook computer, is a small, portable personal computer with a screen and alphanumeric keyboard.'],
 ['Mobile phone', 'A mobile phone, cellular phone, cell phone or hand phone, sometimes shortened to simply mobile, is a portable telephone that can make and receive calls over a radio frequency link while the user is moving within a telephone service area.'],
 ['Photosynthesis', 'Photosynthesis is a system of biological processes by which photosynthetic organisms, such as most plants, algae, and cyanobacteria, convert light energy into chemical energy that is stored in organic compounds.'],
 ['FIFA World Cup', 'The FIFA World Cup, often called the World Cup, is an international association football competition among the senior men\'s national teams of the members of FIFA. The tournament has been held every four years since 1930. Brazil has won the tournament five times, the most of any team.'],
 ['Telephone', 'A telephone is a telecommunications device that permits two or more users to conduct a conversation when they are too far apart to be easily heard directly. Alexander Graham Bell was awarded the first US patent for the invention of the telephone in 1876.'],
 ['Ubuntu', 'Ubuntu is a Linux distribution based on Debian and mostly composed of free and open-source software. It is officially released in three editions: Desktop, Server, and Core for Internet of things devices and robots.'],
 ['Love', 'Love is a feeling of strong attachment, affection and care toward someone or something, a range of strong and positive emotional and mental states.'],
 ['Seawater', 'Seawater, or sea water, is water from a sea or ocean. On average, seawater in the world\'s oceans has a salinity of about 3.5%.'],
 ['Mount Everest', 'Mount Everest is Earth\'s highest mountain above sea level, located in the Himalayas. Its elevation of 8,848.86 m was most recently established in 2020 by the Chinese and Nepali authorities.'],
 ['Chelsea F.C.', 'Chelsea Football Club is a professional football club based in Fulham, West London, England.'],
 ['Chelsea Manning', 'Chelsea Elizabeth Manning is an American activist and whistleblower, a former United States Army soldier.'],
 ['Bitcoin', 'Bitcoin is a decentralized digital currency that can be transferred on the peer-to-peer bitcoin network. Transactions are verified by network nodes through cryptography and recorded in a public distributed ledger called a blockchain.'],
 ['Phone number', 'A telephone number is a sequence of digits assigned to a fixed-line telephone subscriber station connected to a telephone line.'],
 ['Work (physics)', 'In science, work is the energy transferred to or from an object via the application of force along a displacement.'],
 ['Best Buy', 'Best Buy Co., Inc. is an American multinational consumer electronics retailer headquartered in Richfield, Minnesota.'],
];
const tk = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
global.fetch = async (url) => {
  const u = new URL(url); const q = u.searchParams.get('gsrsearch') || u.searchParams.get('srsearch') || ''; const qt = tk(q);
  const scored = PAGES.map(([t, e]) => ({ t, e, sc: qt.reduce((a, w) => a + (tk(t).includes(w) ? 3 : 0) + (e.toLowerCase().includes(w) ? 1 : 0), 0) })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8);
  const pages = {}; scored.forEach((x, i) => { pages[100 + i] = { pageid: 100 + i, title: x.t, index: i + 1, extract: x.e, fullurl: 'https://en.wikipedia.org/wiki/' + x.t.replace(/ /g, '_') }; });
  return { ok: true, json: async () => ({ query: { pages } }) };
};
const W = H.req('utils/chatEngine/webSearch');
const CASES = [
 ['how do solar panels work', /^Solar (panel|power)$/, /photovoltaic|sunlight|light/i],
 ['what is python', /^Python \(programming language\)$/, /programming language/],
 ['who is the president of uganda', /^(President of Uganda|Yoweri Museveni)$/, /Museveni|president/i, true],
 ['capital of kenya', /^(Kenya|Nairobi)$/, /Nairobi/],
 ['when was google founded', /^Google$/, /1998/],
 ['who invented the telephone', /^Telephone$/, /Bell/],
 ['how many people live in uganda', /^Uganda$/, /45 million/],
 ['what is mercury', /^Mercury \((planet|element)\)$/, null],
 ['explain dna', /^DNA$/, /double helix/],
 ['who is elon musk', /^Elon Musk$/, /Tesla/],
 ['how does wifi work', /^Wi-Fi$/, /wireless/],
 ['difference between ssd and hdd', /^Solid-state drive vs Hard disk drive$/, /SSD.*HDD|HDD/s],
 ['tell me about apple', /^Apple( Inc\.)?$/, /Apple|apple/],
 ['what is love', /^Love$/, /attachment/],
 ['what is bitcoin', /^Bitcoin$/, /currency/],
 ['what is ubuntu', /^Ubuntu$/, /Linux/],
];
const NULLS = ['highest mountain in the world', 'what is the best phone in uganda', 'how to fix a slow laptop', 'blorptastic frumble zork', 'why is the ocean salty and blue and green at night', 'what should i name my cat', 'is chelsea manning a football club', 'my work phone number is broken'];
(async () => {
  for (const [q, titleRe, textRe, vol] of CASES) {
    const r = await W.searchWeb(q, 'HUMAN');
    const good = r && !r.blockedReply && titleRe.test(r.title) && (!textRe || textRe.test(r.extract)) && (vol === undefined || !!r.volatile === vol);
    ok(`"${q}"`, !!good, r ? `-> ${r.title} | ${r.extract.slice(0, 70)}` : '-> null');
  }
  for (const q of NULLS) { const r = await W.searchWeb(q, 'HUMAN'); ok(`unrelated: "${q}" gives no wrong page`, !r, r ? `-> ${r.title}` : ''); }
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
