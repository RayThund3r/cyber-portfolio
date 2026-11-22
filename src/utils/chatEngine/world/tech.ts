// World knowledge: acronyms, programming languages, tech companies/products. Stable facts only.
// ACRONYMS: ABBR|expansion|one-line meaning
const AC = `
HTML|HyperText Markup Language|the language that structures web pages (headings, links, images)
CSS|Cascading Style Sheets|the language that styles web pages (colours, fonts, layout)
JS|JavaScript|the programming language that makes web pages interactive
HTTP|HyperText Transfer Protocol|the set of rules browsers and servers use to exchange web pages
HTTPS|HyperText Transfer Protocol Secure|HTTP encrypted with TLS, shown by the padlock in the address bar
URL|Uniform Resource Locator|a web address such as https://example.com/page
DNS|Domain Name System|the internet's phone book that turns names like example.com into IP addresses
IP|Internet Protocol|the addressing system that identifies devices on a network
ISP|Internet Service Provider|the company that connects you to the internet
VPN|Virtual Private Network|an encrypted tunnel that hides your traffic and location from the local network
LAN|Local Area Network|a network in one place such as a home or office
WAN|Wide Area Network|a network spanning cities or countries; the internet is the largest WAN
WIFI|Wireless Fidelity (brand name)|wireless networking based on the IEEE 802.11 standards
USB|Universal Serial Bus|the common connector for charging and data
HDMI|High-Definition Multimedia Interface|a cable for sending video and sound to a screen
VGA|Video Graphics Array|an older analogue video connector
RAM|Random Access Memory|short-term working memory a device uses while running programs
ROM|Read-Only Memory|permanent memory holding start-up instructions
CPU|Central Processing Unit|the processor, the 'brain' that runs instructions
GPU|Graphics Processing Unit|a processor specialised for graphics and parallel work
SSD|Solid State Drive|fast flash-based storage with no moving parts
HDD|Hard Disk Drive|storage using spinning magnetic platters
BIOS|Basic Input/Output System|firmware that starts a PC and hands over to the operating system
UEFI|Unified Extensible Firmware Interface|the modern replacement for BIOS
OS|Operating System|the main software that runs a device (Windows, Android, iOS, Linux)
GUI|Graphical User Interface|an interface using windows, icons and buttons
CLI|Command-Line Interface|an interface where you type commands
API|Application Programming Interface|a defined way for one program to talk to another
SDK|Software Development Kit|a bundle of tools and libraries for building apps for a platform
IDE|Integrated Development Environment|an editor with tools for writing, running and debugging code (e.g. VS Code)
SQL|Structured Query Language|the language for querying and changing databases
JSON|JavaScript Object Notation|a lightweight text format for data
XML|eXtensible Markup Language|a text format for structured data
CSV|Comma-Separated Values|a plain-text table format that opens in Excel
PDF|Portable Document Format|a fixed-layout document format
JPEG|Joint Photographic Experts Group|a compressed image format good for photos (also .jpg)
PNG|Portable Network Graphics|a lossless image format that supports transparency
GIF|Graphics Interchange Format|an image format that supports simple animation
SVG|Scalable Vector Graphics|an image format that stays sharp at any size
MP3|MPEG Audio Layer III|a compressed audio format
MP4|MPEG-4 Part 14|a common video container format
SEO|Search Engine Optimization|improving a site so it ranks higher in search results
UI|User Interface|what a user sees and touches in an app or site
UX|User Experience|how easy and pleasant a product is to use
CMS|Content Management System|software for managing website content (e.g. WordPress)
CRM|Customer Relationship Management|software for tracking customers and sales
ERP|Enterprise Resource Planning|software that runs a company's operations in one system
SAAS|Software as a Service|software you rent online instead of installing
IOT|Internet of Things|everyday devices connected to the internet
AI|Artificial Intelligence|software that does tasks that normally need human intelligence
ML|Machine Learning|AI that learns patterns from data
LLM|Large Language Model|an AI trained on huge amounts of text to read and write language
GPT|Generative Pre-trained Transformer|a family of language models built on the transformer design
AR|Augmented Reality|digital content overlaid on the real world through a camera or glasses
VR|Virtual Reality|a fully digital world experienced through a headset
2FA|Two-Factor Authentication|signing in with a password plus a second proof such as a code
OTP|One-Time Password|a code that works once, usually sent by SMS or an app
PIN|Personal Identification Number|a short secret number for unlocking a card or phone
SSL|Secure Sockets Layer|the older name for the encryption behind HTTPS (now TLS)
TLS|Transport Layer Security|the encryption protocol that secures connections
QR|Quick Response (code)|a square barcode that phones can scan
NFC|Near Field Communication|short-range wireless used for tap-to-pay and pairing
GPS|Global Positioning System|satellite-based location system
SIM|Subscriber Identity Module|the chip that identifies you to a mobile network
SMS|Short Message Service|text messages
MMS|Multimedia Messaging Service|text messages with pictures or video
LTE|Long-Term Evolution|the standard behind 4G mobile data
4G|Fourth-generation mobile network|mobile data standard (LTE)
5G|Fifth-generation mobile network|faster, lower-latency mobile data
LED|Light-Emitting Diode|an efficient light source used in bulbs and screens
LCD|Liquid Crystal Display|a flat screen using liquid crystals and a backlight
OLED|Organic Light-Emitting Diode|a display where each pixel makes its own light
DPI|Dots Per Inch|print resolution
PPI|Pixels Per Inch|screen sharpness
RGB|Red, Green, Blue|the colours of light used by screens
CMYK|Cyan, Magenta, Yellow, Key (black)|the ink colours used in printing
UPS|Uninterruptible Power Supply|a battery backup that keeps devices on during a blackout
ATM|Automated Teller Machine|a cash machine
ATX|Advanced Technology eXtended|a standard PC motherboard and case size
PSU|Power Supply Unit|the part that powers a PC from the wall socket
NVME|Non-Volatile Memory Express|a very fast SSD interface
SATA|Serial ATA|the common interface for hard drives and older SSDs
RAID|Redundant Array of Independent Disks|combining drives for speed or safety
PWA|Progressive Web App|a website that behaves like an installable app
CDN|Content Delivery Network|servers around the world that deliver site files faster
CAPTCHA|Completely Automated Public Turing test to tell Computers and Humans Apart|a test that blocks bots
DDOS|Distributed Denial of Service|an attack that floods a site with traffic to take it down
FAQ|Frequently Asked Questions|a list of common questions with answers
ASAP|As Soon As Possible|urgently
DIY|Do It Yourself|doing something yourself instead of paying someone
CEO|Chief Executive Officer|the top executive of a company
CFO|Chief Financial Officer|the executive in charge of finances
CTO|Chief Technology Officer|the executive in charge of technology
GDP|Gross Domestic Product|the total value of goods and services a country produces
VAT|Value Added Tax|a tax added to the price of goods and services
TIN|Taxpayer Identification Number|the number a taxpayer registers with the revenue authority
URA|Uganda Revenue Authority|Uganda's tax collection body
URSB|Uganda Registration Services Bureau|registers companies, trademarks and other business documents in Uganda
UNEB|Uganda National Examinations Board|sets and marks national exams in Uganda (PLE, UCE, UACE)
UCC|Uganda Communications Commission|Uganda's telecom and broadcasting regulator
NSSF|National Social Security Fund|Uganda's retirement savings scheme
KCCA|Kampala Capital City Authority|runs Kampala's city administration
UNRA|Uganda National Roads Authority|builds and maintains Uganda's national roads
UMEME|Uganda Electricity Distribution Company (brand)|a power distributor in Uganda
NWSC|National Water and Sewerage Corporation|Uganda's main water utility
MTN|Mobile Telephone Networks|a major African mobile operator and the maker of MTN MoMo
MOMO|Mobile Money|sending, receiving and paying money with a phone number
EAC|East African Community|the regional bloc of Uganda, Kenya, Tanzania, Rwanda, Burundi, South Sudan, DR Congo and Somalia
AU|African Union|the continental union of African states
UN|United Nations|the global organisation founded in 1945 to promote peace and cooperation
WHO|World Health Organization|the UN health agency
UNICEF|United Nations Children's Fund|the UN agency for children
UNESCO|United Nations Educational, Scientific and Cultural Organization|the UN agency for education, science and culture
NASA|National Aeronautics and Space Administration|the US space agency
NATO|North Atlantic Treaty Organization|a military alliance of North American and European states
OPEC|Organization of the Petroleum Exporting Countries|a group of oil-producing countries
IMF|International Monetary Fund|a global lender that supports countries' finances
WTO|World Trade Organization|the body that sets global trade rules
FIFA|Fédération Internationale de Football Association|football's world governing body
CAF|Confederation of African Football|Africa's football governing body
UEFA|Union of European Football Associations|Europe's football governing body
AFCON|Africa Cup of Nations|Africa's top national-team football tournament
ROI|Return on Investment|profit made relative to the amount invested
KPI|Key Performance Indicator|a measurable number that shows progress toward a goal
B2B|Business to Business|selling to other businesses
B2C|Business to Consumer|selling to the public
SME|Small and Medium Enterprise|a small or mid-sized business
MOU|Memorandum of Understanding|a written agreement outlining shared intentions
NGO|Non-Governmental Organization|a non-profit group independent of government
ID|Identification|a document or number that proves who you are
DST|Data Stitch Tajima|a common embroidery machine file format
PES|Brother embroidery format|a common embroidery file format used by Brother and Babylock machines
`;
export interface Acronym { abbr: string; full: string; meaning: string }
export const ACRONYMS: Acronym[] = AC.trim().split('\n').map((l) => { const [abbr, full, meaning] = l.split('|'); return { abbr, full, meaning }; });

// LANGS: name|aliases|creator|year|typical use
const PL = `
JavaScript|js|Brendan Eich|1995|making web pages interactive, and on servers with Node.js
TypeScript|ts|Microsoft (Anders Hejlsberg)|2012|JavaScript with types, for larger, safer web projects
Python||Guido van Rossum|1991|automation, data science, AI, web back-ends, learning to code
Java||James Gosling (Sun Microsystems)|1995|large business systems, Android apps and back-ends
C||Dennis Ritchie|1972|operating systems, embedded devices and performance-critical code
C++|cpp|Bjarne Stroustrup|1985|games, browsers, high-performance software
C#|csharp,c sharp|Microsoft (Anders Hejlsberg)|2000|Windows apps, games with Unity, business back-ends
PHP||Rasmus Lerdorf|1995|server-side websites, including WordPress
Ruby||Yukihiro Matsumoto|1995|web apps, especially with Ruby on Rails
Go|golang|Google (Robert Griesemer, Rob Pike, Ken Thompson)|2009|cloud services and command-line tools
Rust||Graydon Hoare (Mozilla)|2010|safe, fast systems programming
Swift||Apple (Chris Lattner)|2014|iPhone, iPad and Mac apps
Kotlin||JetBrains|2011|Android apps and back-ends
Dart||Google|2011|Flutter apps for mobile, web and desktop
R||Ross Ihaka and Robert Gentleman|1993|statistics and data analysis
SQL||Donald Chamberlin and Raymond Boyce (IBM)|1974|querying databases
HTML||Tim Berners-Lee|1991|structuring web pages (a markup language, not a programming language)
CSS||Håkon Wium Lie|1996|styling web pages (a style language)
Bash|shell|Brian Fox|1989|command-line scripting on Linux and macOS
Lua||Roberto Ierusalimschy and colleagues|1993|embedding scripts in games and apps
Scratch||MIT Media Lab|2007|a visual, block-based language for learning to code
`;
export interface Lang { name: string; aliases: string[]; creator: string; year: string; use: string }
export const LANGS: Lang[] = PL.trim().split('\n').map((l) => { const [name, al, creator, year, use] = l.split('|'); return { name, aliases: (al || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), creator, year, use }; });

// COMPANIES / PRODUCTS: name|aliases|year|founders/origin|what
const CO = `
Apple|apple inc|1976|Steve Jobs, Steve Wozniak and Ronald Wayne (California, USA)|maker of the iPhone, Mac, iPad and iOS
Microsoft||1975|Bill Gates and Paul Allen (USA)|maker of Windows, Office, Azure and Xbox
Google||1998|Larry Page and Sergey Brin (USA)|search, Android, Chrome, YouTube and Gmail; part of Alphabet
Amazon||1994|Jeff Bezos (USA)|online shopping and Amazon Web Services cloud
Meta|facebook,meta platforms|2004|Mark Zuckerberg and co-founders (USA)|Facebook, Instagram and WhatsApp
Tesla||2003|Martin Eberhard and Marc Tarpenning (Elon Musk joined in 2004)|electric cars and batteries
Netflix||1997|Reed Hastings and Marc Randolph (USA)|video streaming
Samsung||1938|Lee Byung-chul (South Korea)|phones, TVs, chips and appliances
Sony||1946|Masaru Ibuka and Akio Morita (Japan)|PlayStation, TVs, cameras and music
Huawei||1987|Ren Zhengfei (China)|phones, telecom equipment and networks
Tecno||2006|Transsion Holdings (China)|budget smartphones popular across Africa
Infinix||2013|Transsion Holdings (Hong Kong/China)|budget smartphones popular in Africa and Asia
iPhone||2007|Apple|Apple's smartphone line, first released in June 2007
Android||2008|Android Inc., bought by Google in 2005|the world's most used phone operating system
Windows||1985|Microsoft|PC operating system, first released as Windows 1.0
Linux||1991|Linus Torvalds|free, open-source operating system kernel
WhatsApp||2009|Jan Koum and Brian Acton (bought by Facebook in 2014)|messaging and calling app
Instagram||2010|Kevin Systrom and Mike Krieger (bought by Facebook in 2012)|photo and video sharing app
YouTube||2005|Chad Hurley, Steve Chen and Jawed Karim (bought by Google in 2006)|video sharing
Twitter|x|2006|Jack Dorsey, Noah Glass, Biz Stone and Evan Williams (renamed X in 2023)|short-message social network
Wikipedia||2001|Jimmy Wales and Larry Sanger|free online encyclopedia
Facebook||2004|Mark Zuckerberg and co-founders at Harvard|social network
TikTok||2016|ByteDance (China)|short-video app (launched internationally in 2017)
OpenAI||2015|Sam Altman, Elon Musk, Greg Brockman and others|maker of ChatGPT
Anthropic||2021|Dario Amodei, Daniela Amodei and colleagues|AI safety company that makes Claude
Uber||2009|Garrett Camp and Travis Kalanick|ride-hailing
MTN Group||1994|South Africa|a mobile operator across Africa and the Middle East
Airtel||1995|Bharti Airtel (India)|a mobile operator across Asia and Africa
GitHub||2008|Tom Preston-Werner, Chris Wanstrath, PJ Hyett and Scott Chacon (bought by Microsoft in 2018)|hosting for Git projects
Next.js||2016|Vercel (Guillermo Rauch)|a React framework for building websites
React||2013|Facebook (Jordan Walke)|a JavaScript library for building user interfaces
Bitcoin||2009|created by the pseudonymous Satoshi Nakamoto|the first decentralised digital currency
`;
export interface Company { name: string; aliases: string[]; year: string; origin: string; what: string }
export const COMPANIES: Company[] = CO.trim().split('\n').map((l) => { const [name, al, year, origin, what] = l.split('|'); return { name, aliases: (al || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean), year, origin, what }; });
