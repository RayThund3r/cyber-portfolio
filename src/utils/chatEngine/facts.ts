// src/utils/chatEngine/facts.ts — a few stable facts and phrases the assistant can answer with no model and no internet.
// Only things that do not change (capitals, greetings). Anything that changes (presidents, prices, news) goes to web/LLM.
import { SITE } from './siteConfig';

export interface FactAnswer { human: string; expert: string; suggestions: string[] }

const CAPITALS: Record<string, string> = {
  uganda: 'Kampala', kenya: 'Nairobi', tanzania: 'Dodoma (Dar es Salaam is the largest city)', rwanda: 'Kigali', burundi: 'Gitega', 'south sudan': 'Juba', drc: 'Kinshasa', congo: 'Brazzaville (DR Congo: Kinshasa)',
  ethiopia: 'Addis Ababa', somalia: 'Mogadishu', sudan: 'Khartoum', egypt: 'Cairo', nigeria: 'Abuja', ghana: 'Accra', senegal: 'Dakar', 'south africa': 'Pretoria (administrative), Cape Town (legislative), Bloemfontein (judicial)',
  zambia: 'Lusaka', zimbabwe: 'Harare', malawi: 'Lilongwe', mozambique: 'Maputo', morocco: 'Rabat', algeria: 'Algiers', tunisia: 'Tunis', libya: 'Tripoli', cameroon: 'Yaoundé', angola: 'Luanda', namibia: 'Windhoek', botswana: 'Gaborone',
  france: 'Paris', germany: 'Berlin', italy: 'Rome', spain: 'Madrid', portugal: 'Lisbon', 'united kingdom': 'London', uk: 'London', england: 'London', ireland: 'Dublin', netherlands: 'Amsterdam', belgium: 'Brussels', switzerland: 'Bern', sweden: 'Stockholm', norway: 'Oslo', denmark: 'Copenhagen', finland: 'Helsinki', poland: 'Warsaw', greece: 'Athens', turkey: 'Ankara', russia: 'Moscow', ukraine: 'Kyiv',
  usa: 'Washington, D.C.', 'united states': 'Washington, D.C.', america: 'Washington, D.C.', canada: 'Ottawa', mexico: 'Mexico City', brazil: 'Brasília', argentina: 'Buenos Aires', chile: 'Santiago', colombia: 'Bogotá', peru: 'Lima', cuba: 'Havana', jamaica: 'Kingston',
  china: 'Beijing', japan: 'Tokyo', 'south korea': 'Seoul', 'north korea': 'Pyongyang', india: 'New Delhi', pakistan: 'Islamabad', bangladesh: 'Dhaka', indonesia: 'Jakarta', philippines: 'Manila', vietnam: 'Hanoi', thailand: 'Bangkok', malaysia: 'Kuala Lumpur', singapore: 'Singapore', australia: 'Canberra', 'new zealand': 'Wellington',
  'saudi arabia': 'Riyadh', uae: 'Abu Dhabi', 'united arab emirates': 'Abu Dhabi', qatar: 'Doha', iran: 'Tehran', iraq: 'Baghdad', israel: 'Jerusalem (disputed)', 'dubai': 'Dubai is a city; the UAE capital is Abu Dhabi',
};

// tiny Swahili / Luganda phrasebook (greetings only)
const PHRASES: Array<{ en: string[]; sw: string; lg: string }> = [
  { en: ['hello', 'hi', 'hey'], sw: 'Jambo / Habari', lg: 'Oli otya? / Wasuze otya?' },
  { en: ['good morning'], sw: 'Habari za asubuhi', lg: 'Wasuze otya nno' },
  { en: ['good evening', 'good night'], sw: 'Habari za jioni / Usiku mwema', lg: 'Osiibye otya / Weraba' },
  { en: ['thank you', 'thanks'], sw: 'Asante (sana)', lg: 'Webale (nnyo)' },
  { en: ['welcome'], sw: 'Karibu', lg: 'Tukusanyuse / Kaaba' },
  { en: ['goodbye', 'bye', 'see you'], sw: 'Kwaheri / Tutaonana', lg: 'Weraba / Tulabagane' },
  { en: ['how are you'], sw: 'Habari yako? / U hali gani?', lg: 'Oli otya?' },
  { en: ['please'], sw: 'Tafadhali', lg: 'Nsaba' },
  { en: ['sorry'], sw: 'Pole / Samahani', lg: 'Kitegeeza / Sorry nnyo' },
  { en: ['yes'], sw: 'Ndiyo', lg: 'Yee' },
  { en: ['no'], sw: 'Hapana', lg: 'Nedda' },
  { en: ['water'], sw: 'Maji', lg: 'Amazzi' },
  { en: ['friend'], sw: 'Rafiki', lg: 'Mukwano' },
];

// Evergreen general knowledge (stable facts only). [regex on the cleaned question, answer]
const GENERAL: Array<[RegExp, string]> = [
  [/\b(speed of light)\b/, 'Light travels at about **299,792 km per second** (roughly 300,000 km/s) in a vacuum.'],
  [/\bwhy is the sky blue\b/, 'Sunlight contains all colours. Air molecules scatter short, blue wavelengths much more than long, red ones, so blue light reaches your eyes from every part of the sky (this is called Rayleigh scattering). At sunset the light travels through more air, so the blues scatter away and reds remain.'],
  [/\bhow (?:far|distant) is the moon\b|\bdistance to the moon\b/, 'The Moon is about **384,400 km** from Earth on average.'],
  [/\bwho invented (?:the )?(?:telephone|phone)\b/, 'Alexander Graham Bell is credited with the telephone, patented in **1876**.'],
  [/\bwho invented (?:the )?(?:web|world wide web|www)\b/, 'Tim Berners-Lee invented the **World Wide Web** in 1989 to 1991 at CERN. (The internet itself, the network underneath, was built by many people earlier.)'],
  [/\bwho invented (?:the )?(?:light ?bulb|bulb)\b/, 'Thomas Edison made the first long-lasting practical light bulb (1879), building on earlier work by Joseph Swan and others.'],
  [/\bwho invented (?:the )?computer\b/, 'There is no single inventor: Charles Babbage designed the first mechanical programmable computer (1830s), and electronic computers came in the 1940s.'],
  [/\bhow many days (?:are )?in (?:a|one) year\b|\bdays in a year\b/, 'A year has **365 days**, or **366** in a leap year (every 4 years, with a few exceptions).'],
  [/\bhow many (?:hours|minutes|seconds) (?:are )?in (?:a|one) (?:day|hour|minute|week)\b/, 'A day has **24 hours** = 1,440 minutes = 86,400 seconds. A week has 168 hours.'],
  [/\b(highest|tallest) mountain\b/, 'Mount Everest, about **8,849 m** above sea level. In Uganda the highest is **Margherita Peak** (Rwenzori), about 5,109 m.'],
  [/\b(longest river)\b/, 'The **Nile** is usually listed as the longest (about 6,650 km), and its White Nile source is at **Jinja, Uganda**. (The Amazon is sometimes measured as longer.)'],
  [/\b(biggest|largest) planet\b/, '**Jupiter**, more than 11 times wider than Earth.'],
  [/\bhow many continents\b/, 'There are **7** continents: Africa, Antarctica, Asia, Australia/Oceania, Europe, North America and South America.'],
  [/\bhow many (?:people|humans) (?:are there )?(?:live )?(?:in|on) (?:the )?(?:world|earth)\b|\bworld population\b/, 'About **8 billion** people. (Exact figures change daily.)'],
  [/\bformula (?:of|for) water\b|\bwhat is water made of\b/, 'Water is **H₂O**: two hydrogen atoms and one oxygen atom.'],
  [/\bboiling point of water\b|\bat what temperature does water boil\b/, 'Water boils at **100 °C (212 °F)** at sea level, a bit lower at altitude.'],
  [/\buganda(?:'s)? (?:currency|money)\b|\bcurrency (?:of|in) uganda\b/, "Uganda's currency is the **Ugandan shilling (UGX)**. 🇺🇬"],
  [/\b(?:languages?|official language) (?:of|in|spoken in) uganda\b|\buganda(?:'s)? (?:official )?languages?\b/, 'Uganda\'s official languages are **English** and **Swahili**; Luganda is the most widely spoken local language, among over 40 in the country. 🇺🇬'],
  [/\buganda(?:'s)? independence\b|\bwhen did uganda (?:get|gain) independence\b/, 'Uganda became independent from Britain on **9 October 1962**. 🇺🇬'],
  [/\bsource of the nile\b/, 'The White Nile starts at Lake Victoria, near **Jinja, Uganda**, where Lake Victoria feeds into it.'],
  [/\bwhat is quantum (?:physics|mechanics)\b|\bexplain quantum (?:physics|mechanics)\b/, 'Quantum physics describes how very small things (atoms, electrons, light) behave: they come in tiny packets (quanta), can act like waves and particles, and can only be predicted as probabilities, not certainties. It is the science behind lasers, transistors and the chips in your phone. Want it simpler or deeper? A cloud AI is better for the long version.'],
  [/\bwhat is love\b/, 'Big question! Scientists describe it as attachment, care and chemistry working together; poets say a lot more. As a chat assistant, the nearest I get is being glad when I can help.'],
  [/\bwhat(?:'s| is) the (?:year|current year)\b|\bwhat year is it\b|\bwhich year is this\b/, ''],
];

const clean = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();

export function tryFacts(input: string): FactAnswer | null {
  const q = clean(input);
  // Asking for the owner's contact details is never a "recover my WhatsApp" question.
  if (/\b(?:your|ur|the owner'?s?) (?:whatsapp|whats app|number|phone|mobile|email|e-?mail|contact)\b|^(?:whatsapp|whats app)(?: me| number)?$|\bwhatsapp (?:you|number)\b/.test(q) && !/\b(?:recover|restore|backup|back up|lost|deleted|hacked|transfer)\b/.test(q)) {
    const bits = [SITE.whatsapp && `WhatsApp / call: **${SITE.whatsapp}**`, SITE.email && `Email: **${SITE.email}**`].filter(Boolean).join(' · ');
    if (bits) return { human: `${bits} You can also use the contact form on this site, and I can open it for you.`, expert: `CONTACT // ${bits.replace(/\*\*/g, '')}`, suggestions: ['Open contact section', 'Get a quote'] };
  }
  for (const [re, ans] of GENERAL) {
    if (!re.test(q)) continue;
    const text = ans || `It's **${new Date().getFullYear()}**.`;
    return { human: text, expert: 'FACT // ' + text.replace(/\*\*/g, ''), suggestions: ['Ask me something else', 'What can you do?'] };
  }
  let m = /^(?:(?:what is|what's|whats|which is|tell me|name) )?(?:the )?capital (?:city )?of (?:the )?(.+)$/.exec(q) || /^(.+?)(?:'s)? capital(?: city)?$/.exec(q);
  if (m) {
    const c = CAPITALS[m[1].trim()];
    if (c) return { human: `The capital of **${m[1].trim().replace(/\b\w/g, (x) => x.toUpperCase())}** is **${c}**.`, expert: `FACT // capital(${m[1].trim()}) = ${c}`, suggestions: ['Ask me something else', 'What can you do?'] };
  }
  m = /^(?:translate|how do you say|how to say|say) (.+?) (?:in|to|into) (swahili|kiswahili|luganda|ganda)$/.exec(q);
  if (m) {
    const word = m[1].replace(/^(?:the word|word) /, '').trim();
    const row = PHRASES.find((p) => p.en.includes(word));
    const sw = /swahili/.test(m[2]);
    if (row) return { human: `"${word}" in ${sw ? 'Swahili' : 'Luganda'}: **${sw ? row.sw : row.lg}**`, expert: `TRANSLATE // ${word} -> ${sw ? row.sw : row.lg}`, suggestions: ['Translate thank you to Luganda', 'What can you do?'] };
    return { human: `I only know a handful of everyday greetings in ${sw ? 'Swahili' : 'Luganda'} (hello, thank you, welcome, goodbye, please, sorry, yes, no, water, friend). For full translations, the owner's cloud AI handles it once it is switched on.`, expert: 'TRANSLATE // phrase not in local phrasebook', suggestions: ['Translate hello to Swahili', 'Translate thank you to Luganda'] };
  }
  return null;
}
