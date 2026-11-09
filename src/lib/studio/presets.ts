// src/lib/studio/presets.ts — starter designs. The look comes from three production sites; all text is placeholder.
// Images are stock photos, replace them in the editor.
export interface StudioPreset { label: string; desc: string; data: Record<string, any> }
export const PRESETS: Record<string, StudioPreset> = {
 "rose": {
  "label": "Rose Studio",
  "desc": "Beauty, fashion and lifestyle. Soft, rounded, with appointment booking.",
  "data": {
   "name": "Your Salon Name",
   "tag": "Beauty, tailored to you",
   "announce": "Welcome! Replace this with an offer or notice.",
   "mono": "B",
   "logoLight": "",
   "logoDark": "",
   "logoSub": "",
   "favicon": "",
   "lr": "20",
   "phone": "0700 000 000",
   "wa": "256700000000",
   "email": "hello@example.com",
   "addr": "Your address, City",
   "hours": "Mon–Sat · 9:00–18:00",
   "ig": "",
   "fb": "",
   "tt": "",
   "yt": "",
   "thanks": "Thank you! We will reply shortly.",
   "wamsg": "Hello, I found you on your website.",
   "skin": "soft",
   "hf": "playfair",
   "bf": "quicksand",
   "radius": "26",
   "defTheme": "auto",
   "fx": "zoom",
   "slSpeed": "5.5",
   "bgL": "#fff7fa",
   "cardL": "#ffffff",
   "txL": "#3a1f2b",
   "acL": "#e0568f",
   "ac2L": "#f7b4d0",
   "bgD": "#170d12",
   "cardD": "#241720",
   "txD": "#fbeaf1",
   "acD": "#f06fa3",
   "ac2D": "#7a2f50",
   "customCss": "",
   "slides": [
    {
     "u": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=1800&q=70",
     "t": "Feel your best",
     "s": "Beauty services made around you."
    },
    {
     "u": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=70",
     "t": "Book your day",
     "s": "Choose a time that suits you."
    },
    {
     "u": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1800&q=70",
     "t": "Look worth sharing",
     "s": "See what we can do for you."
    }
   ],
   "aboutImg": "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?auto=format&fit=crop&w=1000&q=70",
   "svTitle": "What we do",
   "catTitle": "Our catalogue",
   "galTitle": "Our work",
   "stats": [
    {
     "v": "1,000+",
     "l": "Happy clients"
    },
    {
     "v": "5",
     "l": "Years of experience"
    },
    {
     "v": "4.9",
     "l": "Average rating"
    }
   ],
   "services": [
    {
     "t": "Hair & styling",
     "d": "Cuts, colour, braids and finishing."
    },
    {
     "t": "Makeup",
     "d": "Everyday glam to full occasion looks."
    },
    {
     "t": "Care & treatments",
     "d": "Healthy hair and skin care."
    },
    {
     "t": "Bridal & events",
     "d": "Planned around your big day."
    }
   ],
   "products": [
    {
     "n": "Signature Style",
     "c": "Hair",
     "p": "120000",
     "st": "12",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Glam Session",
     "c": "Makeup",
     "p": "85000",
     "st": "8",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Care Treatment",
     "c": "Care",
     "p": "250000",
     "st": "5",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Gift Voucher",
     "c": "Hair",
     "p": "60000",
     "st": "20",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Home Service",
     "c": "Makeup",
     "p": "180000",
     "st": "6",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1457301353672-324d6d14f471?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Trial Session",
     "c": "Care",
     "p": "95000",
     "st": "10",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=70"
    }
   ],
   "gallery": [
    {
     "u": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=70",
     "c": "Soft glam look",
     "k": "Hair"
    },
    {
     "u": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=70",
     "c": "Styled finish",
     "k": "Makeup"
    },
    {
     "u": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=70",
     "c": "Detail shot",
     "k": "Hair"
    },
    {
     "u": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=1400&q=70",
     "c": "Behind the scenes",
     "k": "Care"
    },
    {
     "u": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1400&q=70",
     "c": "Client favourite",
     "k": "Makeup"
    },
    {
     "u": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=70",
     "c": "Before & after",
     "k": "Hair"
    }
   ],
   "testi": [
    {
     "n": "Happy Client",
     "q": "Wonderful service. Friendly, fast and exactly what we asked for."
    },
    {
     "n": "Another Client",
     "q": "Great quality and fair prices. We will be back."
    },
    {
     "n": "Repeat Customer",
     "q": "Easy to work with and always reliable."
    }
   ],
   "faq": [
    {
     "q": "How do I get started?",
     "a": "Message us on WhatsApp or use the contact form and we will guide you."
    },
    {
     "q": "How long does it take?",
     "a": "It depends on the job. We confirm timing before we begin."
    },
    {
     "q": "Do you deliver?",
     "a": "Yes. Delivery fees are shown at checkout."
    }
   ],
   "mode": "book",
   "bookTitle": "Book your appointment",
   "bookText": "Pick a day and time for your session.",
   "deposits": "",
   "slots": "09:00,11:00,14:00,16:00",
   "closed": "0",
   "mtn": "0770 000 000",
   "mtnn": "Your Business Name",
   "airtel": "0700 000 000",
   "airteln": "Your Business Name",
   "bank": "Bank name · Account name · 0000000000",
   "fee": "10000",
   "paylink": "",
   "promos": "",
   "fShop": true,
   "fWa": true,
   "fRev": true,
   "fFav": true,
   "fLang": true,
   "fNews": true,
   "fTop": true,
   "fTrack": true,
   "title": "",
   "pass": "",
   "dburl": "",
   "refresh": true,
   "demoAdmin": false,
   "tr": []
  }
 },
 "navy": {
  "label": "Navy Workshop",
  "desc": "Print, signage, trades and fabrication. Bold and sharp, with quote requests.",
  "data": {
   "name": "Your Workshop Name",
   "tag": "Made properly, delivered on time",
   "announce": "Welcome! Replace this with an offer or notice.",
   "mono": "W",
   "logoLight": "",
   "logoDark": "",
   "logoSub": "",
   "favicon": "",
   "lr": "12",
   "phone": "0700 000 000",
   "wa": "256700000000",
   "email": "hello@example.com",
   "addr": "Your address, City",
   "hours": "Mon–Sat · 9:00–18:00",
   "ig": "",
   "fb": "",
   "tt": "",
   "yt": "",
   "thanks": "Thank you! We will reply shortly.",
   "wamsg": "Hello, I found you on your website.",
   "skin": "bold",
   "hf": "spacegrotesk",
   "bf": "archivo",
   "radius": "14",
   "defTheme": "auto",
   "fx": "slide",
   "slSpeed": "5.5",
   "bgL": "#f6f8fc",
   "cardL": "#ffffff",
   "txL": "#0b1b3a",
   "acL": "#ff7a1a",
   "ac2L": "#0b2a5c",
   "bgD": "#060e20",
   "cardD": "#0e1a33",
   "txD": "#eef2fa",
   "acD": "#ff8a2e",
   "ac2D": "#1a4a99",
   "customCss": "",
   "slides": [
    {
     "u": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1800&q=70",
     "t": "Built to be seen",
     "s": "Signs and products that make your brand stand out."
    },
    {
     "u": "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1800&q=70",
     "t": "Made to order",
     "s": "Tell us what you need and we will quote."
    },
    {
     "u": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1800&q=70",
     "t": "Quality you can feel",
     "s": "Precise work, finished by hand."
    }
   ],
   "aboutImg": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1000&q=70",
   "svTitle": "What we do",
   "catTitle": "Our catalogue",
   "galTitle": "Our work",
   "stats": [
    {
     "v": "500+",
     "l": "Jobs completed"
    },
    {
     "v": "10",
     "l": "Years in business"
    },
    {
     "v": "48h",
     "l": "Typical turnaround"
    }
   ],
   "services": [
    {
     "t": "Custom signage",
     "d": "Indoor and outdoor, designed and made."
    },
    {
     "t": "Printing",
     "d": "Banners, stickers and branded items."
    },
    {
     "t": "Engraving",
     "d": "Wood, metal and acrylic, finished clean."
    },
    {
     "t": "Installation",
     "d": "We fit what we make."
    }
   ],
   "products": [
    {
     "n": "Custom Sign",
     "c": "Signage",
     "p": "120000",
     "st": "12",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Branded Plaque",
     "c": "Custom",
     "p": "85000",
     "st": "8",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Printed Banner",
     "c": "Print",
     "p": "250000",
     "st": "5",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Vehicle Graphics",
     "c": "Signage",
     "p": "60000",
     "st": "20",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Engraved Gift",
     "c": "Custom",
     "p": "180000",
     "st": "6",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Display Stand",
     "c": "Print",
     "p": "95000",
     "st": "10",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=700&q=70"
    }
   ],
   "gallery": [
    {
     "u": "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1400&q=70",
     "c": "Workshop in progress",
     "k": "Signage"
    },
    {
     "u": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1400&q=70",
     "c": "Finished sign",
     "k": "Custom"
    },
    {
     "u": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1400&q=70",
     "c": "Close-up detail",
     "k": "Print"
    },
    {
     "u": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=70",
     "c": "Install day",
     "k": "Signage"
    },
    {
     "u": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=70",
     "c": "Custom order",
     "k": "Custom"
    },
    {
     "u": "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1400&q=70",
     "c": "Team at work",
     "k": "Print"
    }
   ],
   "testi": [
    {
     "n": "Happy Client",
     "q": "Wonderful service. Friendly, fast and exactly what we asked for."
    },
    {
     "n": "Another Client",
     "q": "Great quality and fair prices. We will be back."
    },
    {
     "n": "Repeat Customer",
     "q": "Easy to work with and always reliable."
    }
   ],
   "faq": [
    {
     "q": "How do I get started?",
     "a": "Message us on WhatsApp or use the contact form and we will guide you."
    },
    {
     "q": "How long does it take?",
     "a": "It depends on the job. We confirm timing before we begin."
    },
    {
     "q": "Do you deliver?",
     "a": "Yes. Delivery fees are shown at checkout."
    }
   ],
   "mode": "quote",
   "bookTitle": "Request a quote",
   "bookText": "Tell us what you need.",
   "deposits": "",
   "slots": "09:00,11:00,14:00,16:00",
   "closed": "0",
   "mtn": "0770 000 000",
   "mtnn": "Your Business Name",
   "airtel": "0700 000 000",
   "airteln": "Your Business Name",
   "bank": "Bank name · Account name · 0000000000",
   "fee": "10000",
   "paylink": "",
   "promos": "",
   "fShop": true,
   "fWa": true,
   "fRev": true,
   "fFav": true,
   "fLang": true,
   "fNews": true,
   "fTop": true,
   "fTrack": true,
   "title": "",
   "pass": "",
   "dburl": "",
   "refresh": true,
   "demoAdmin": false,
   "tr": []
  }
 },
 "gold": {
  "label": "Gold Events",
  "desc": "Events, hospitality and luxury services. Classic and elegant, with consultation booking.",
  "data": {
   "name": "Your Events Company",
   "tag": "Moments worth remembering",
   "announce": "Welcome! Replace this with an offer or notice.",
   "mono": "G",
   "logoLight": "",
   "logoDark": "",
   "logoSub": "",
   "favicon": "",
   "lr": "0",
   "phone": "0700 000 000",
   "wa": "256700000000",
   "email": "hello@example.com",
   "addr": "Your address, City",
   "hours": "Mon–Sat · 9:00–18:00",
   "ig": "",
   "fb": "",
   "tt": "",
   "yt": "",
   "thanks": "Thank you! We will reply shortly.",
   "wamsg": "Hello, I found you on your website.",
   "skin": "classic",
   "hf": "cormorant",
   "bf": "jost",
   "radius": "2",
   "defTheme": "auto",
   "fx": "fade",
   "slSpeed": "5.5",
   "bgL": "#fffdf8",
   "cardL": "#f6f1e4",
   "txL": "#14130f",
   "acL": "#b8923a",
   "ac2L": "#3f7a46",
   "bgD": "#0c0c0a",
   "cardD": "#171611",
   "txD": "#f5f1e6",
   "acD": "#d4af37",
   "ac2D": "#2f5d37",
   "customCss": "",
   "slides": [
    {
     "u": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1800&q=70",
     "t": "Moments worth remembering",
     "s": "Planned and styled with care."
    },
    {
     "u": "https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1800&q=70",
     "t": "From first idea to last dance",
     "s": "We handle the details."
    },
    {
     "u": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1800&q=70",
     "t": "Your day, your way",
     "s": "Tell us your vision."
    }
   ],
   "aboutImg": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1000&q=70",
   "svTitle": "What we do",
   "catTitle": "Our catalogue",
   "galTitle": "Our work",
   "stats": [
    {
     "v": "300+",
     "l": "Events"
    },
    {
     "v": "8",
     "l": "Years"
    },
    {
     "v": "100%",
     "l": "Dedicated"
    }
   ],
   "services": [
    {
     "t": "Weddings",
     "d": "Full planning, décor and coordination."
    },
    {
     "t": "Corporate events",
     "d": "Launches, galas and conferences."
    },
    {
     "t": "Celebrations",
     "d": "Birthdays, anniversaries and more."
    },
    {
     "t": "Décor & hire",
     "d": "Styling, lighting and furniture."
    }
   ],
   "products": [
    {
     "n": "Gold Package",
     "c": "Weddings",
     "p": "120000",
     "st": "12",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Silver Package",
     "c": "Corporate",
     "p": "85000",
     "st": "8",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Corporate Event",
     "c": "Celebrations",
     "p": "250000",
     "st": "5",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Birthday Setup",
     "c": "Weddings",
     "p": "60000",
     "st": "20",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Venue Decor",
     "c": "Corporate",
     "p": "180000",
     "st": "6",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Planning Session",
     "c": "Celebrations",
     "p": "95000",
     "st": "10",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=700&q=70"
    }
   ],
   "gallery": [
    {
     "u": "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=70",
     "c": "Ceremony setup",
     "k": "Weddings"
    },
    {
     "u": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=70",
     "c": "Table styling",
     "k": "Weddings"
    },
    {
     "u": "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1400&q=70",
     "c": "Evening lighting",
     "k": "Celebrations"
    },
    {
     "u": "https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&w=1400&q=70",
     "c": "Floral arch",
     "k": "Weddings"
    },
    {
     "u": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1400&q=70",
     "c": "Reception detail",
     "k": "Corporate"
    },
    {
     "u": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=70",
     "c": "Guest welcome",
     "k": "Celebrations"
    }
   ],
   "testi": [
    {
     "n": "Happy Client",
     "q": "Wonderful service. Friendly, fast and exactly what we asked for."
    },
    {
     "n": "Another Client",
     "q": "Great quality and fair prices. We will be back."
    },
    {
     "n": "Repeat Customer",
     "q": "Easy to work with and always reliable."
    }
   ],
   "faq": [
    {
     "q": "How do I get started?",
     "a": "Message us on WhatsApp or use the contact form and we will guide you."
    },
    {
     "q": "How long does it take?",
     "a": "It depends on the job. We confirm timing before we begin."
    },
    {
     "q": "Do you deliver?",
     "a": "Yes. Delivery fees are shown at checkout."
    }
   ],
   "mode": "book",
   "bookTitle": "Book a consultation",
   "bookText": "Choose a date and time for a free planning call.",
   "deposits": "",
   "slots": "09:00,11:00,14:00,16:00",
   "closed": "0",
   "mtn": "0770 000 000",
   "mtnn": "Your Business Name",
   "airtel": "0700 000 000",
   "airteln": "Your Business Name",
   "bank": "Bank name · Account name · 0000000000",
   "fee": "10000",
   "paylink": "",
   "promos": "",
   "fShop": true,
   "fWa": true,
   "fRev": true,
   "fFav": true,
   "fLang": true,
   "fNews": true,
   "fTop": true,
   "fTrack": true,
   "title": "",
   "pass": "",
   "dburl": "",
   "refresh": true,
   "demoAdmin": false,
   "tr": []
  }
 },
 "fresh": {
  "label": "Fresh Shop",
  "desc": "Retail and general shops. Clean look, catalogue, cart and WhatsApp ordering.",
  "data": {
   "name": "Your Shop Name",
   "tag": "Good things, delivered",
   "announce": "Welcome! Replace this with an offer or notice.",
   "mono": "S",
   "logoLight": "",
   "logoDark": "",
   "logoSub": "",
   "favicon": "",
   "lr": "8",
   "phone": "0700 000 000",
   "wa": "256700000000",
   "email": "hello@example.com",
   "addr": "Your address, City",
   "hours": "Mon–Sat · 9:00–18:00",
   "ig": "",
   "fb": "",
   "tt": "",
   "yt": "",
   "thanks": "Thank you! We will reply shortly.",
   "wamsg": "Hello, I found you on your website.",
   "skin": "clean",
   "hf": "dmserif",
   "bf": "dmsans",
   "radius": "10",
   "defTheme": "auto",
   "fx": "fade",
   "slSpeed": "5.5",
   "bgL": "#f7faf7",
   "cardL": "#ffffff",
   "txL": "#16241a",
   "acL": "#2f8f4e",
   "ac2L": "#bfe3c9",
   "bgD": "#0e1511",
   "cardD": "#16201a",
   "txD": "#e8f2ea",
   "acD": "#4cc274",
   "ac2D": "#1f4d30",
   "customCss": "",
   "slides": [
    {
     "u": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=1800&q=70",
     "t": "Shop what you love",
     "s": "Fresh arrivals every week."
    },
    {
     "u": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=70",
     "t": "Order on WhatsApp",
     "s": "Quick, friendly service."
    },
    {
     "u": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1800&q=70",
     "t": "Delivered to you",
     "s": "Anywhere we can reach."
    }
   ],
   "aboutImg": "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?auto=format&fit=crop&w=1000&q=70",
   "svTitle": "What we do",
   "catTitle": "Our catalogue",
   "galTitle": "Our work",
   "stats": [
    {
     "v": "2,000+",
     "l": "Orders"
    },
    {
     "v": "4.8",
     "l": "Rating"
    },
    {
     "v": "24h",
     "l": "Delivery"
    }
   ],
   "services": [
    {
     "t": "Everyday essentials",
     "d": "Quality you can rely on."
    },
    {
     "t": "Gifts",
     "d": "Wrapped and ready."
    },
    {
     "t": "Bulk orders",
     "d": "Better prices for more."
    },
    {
     "t": "Delivery",
     "d": "Fast and tracked."
    }
   ],
   "products": [
    {
     "n": "Everyday Item",
     "c": "Home",
     "p": "120000",
     "st": "12",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Gift Set",
     "c": "Gifts",
     "p": "85000",
     "st": "8",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Best Seller",
     "c": "Home",
     "p": "250000",
     "st": "5",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "New Arrival",
     "c": "Gifts",
     "p": "60000",
     "st": "20",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Bundle Offer",
     "c": "Home",
     "p": "180000",
     "st": "6",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1457301353672-324d6d14f471?auto=format&fit=crop&w=700&q=70"
    },
    {
     "n": "Limited Edition",
     "c": "Gifts",
     "p": "95000",
     "st": "10",
     "d": "Add a short description for this item: what it is, what it is made of, and who it is for.",
     "u": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=70"
    }
   ],
   "gallery": [
    {
     "u": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=70",
     "c": "New in",
     "k": "Home"
    },
    {
     "u": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=70",
     "c": "Customer favourite",
     "k": "Gifts"
    },
    {
     "u": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=70",
     "c": "In the shop",
     "k": "Home"
    },
    {
     "u": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=1400&q=70",
     "c": "Gift wrapped",
     "k": "Gifts"
    },
    {
     "u": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1400&q=70",
     "c": "Packed with care",
     "k": "Home"
    },
    {
     "u": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=70",
     "c": "On display",
     "k": "Gifts"
    }
   ],
   "testi": [
    {
     "n": "Happy Client",
     "q": "Wonderful service. Friendly, fast and exactly what we asked for."
    },
    {
     "n": "Another Client",
     "q": "Great quality and fair prices. We will be back."
    },
    {
     "n": "Repeat Customer",
     "q": "Easy to work with and always reliable."
    }
   ],
   "faq": [
    {
     "q": "How do I get started?",
     "a": "Message us on WhatsApp or use the contact form and we will guide you."
    },
    {
     "q": "How long does it take?",
     "a": "It depends on the job. We confirm timing before we begin."
    },
    {
     "q": "Do you deliver?",
     "a": "Yes. Delivery fees are shown at checkout."
    }
   ],
   "mode": "book",
   "bookTitle": "Book a pickup",
   "bookText": "Choose a day and time to collect your order.",
   "deposits": "",
   "slots": "09:00,11:00,14:00,16:00",
   "closed": "0",
   "mtn": "0770 000 000",
   "mtnn": "Your Business Name",
   "airtel": "0700 000 000",
   "airteln": "Your Business Name",
   "bank": "Bank name · Account name · 0000000000",
   "fee": "10000",
   "paylink": "",
   "promos": "",
   "fShop": true,
   "fWa": true,
   "fRev": true,
   "fFav": true,
   "fLang": true,
   "fNews": true,
   "fTop": true,
   "fTrack": true,
   "title": "",
   "pass": "",
   "dburl": "",
   "refresh": true,
   "demoAdmin": false,
   "tr": []
  }
 }
};
export const DEFAULT_PRESET = "rose";
