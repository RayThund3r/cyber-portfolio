// src/utils/chatEngine/techFacts.ts
//
// More built-in answers for questions visitors to a repair / design site actually ask, so the
// assistant is useful before (or without) any AI model. Merged into the knowledge base by
// knowledgeBase.ts. Rules for adding entries:
//   * facts only — no prices, no promises, no claims about the business
//   * `reply` is what visitors see (markdown), `expert` is the terse version, `content` grounds the AI model
//   * keywords are phrases people really type; the retriever tolerates typos

import type { KnowledgeEntry } from './types';

export const TECH_FACTS: KnowledgeEntry[] = [
  {
    id: 'android-vs-iphone',
    domain: 'GENERAL_QA',
    title: 'Android vs iPhone',
    keywords: ['android vs iphone', 'iphone vs android', 'which is better android or iphone', 'ios vs android', 'should i buy iphone or samsung', 'iphone or android'],
    content:
      'Neither is "better" for everyone. iPhones: long software support, consistent updates, strong resale value, simple ecosystem with other Apple devices, but higher prices and less customisation. Android: huge range of prices and designs, more customisation, easier file handling and USB use, but support length varies a lot by brand (Samsung and Google support recent flagships for many years, cheap phones often much less). Repairs: parts and repair options exist for both; the right choice depends on budget, apps and what the rest of your devices are.',
    reply:
      "Honestly, neither is better for everyone — it comes down to budget and habits:\n\n- **iPhone:** long update support, smooth and consistent, strong resale value, works neatly with other Apple devices. Costs more and is less customisable.\n- **Android:** a huge range of prices, more freedom (files, customising, USB), and some great value phones. Update support varies a lot by brand — Samsung and Google flagships get years of updates, cheap models often far fewer.\n\n**Rule of thumb:** already in the Apple world or want something that just works for years → iPhone. Want more choice for the money → Android from a brand with good update support.\n\nWhat's your budget and what do you use it for most? I can narrow it down.",
    expert:
      'COMPARE // iOS: long support, uniform, high resale, higher cost. Android: price range, customisation, update length varies by OEM (Samsung/Google long, budget short). Decide by budget + ecosystem.',
    suggestions: ['My phone is not working', 'Is it worth repairing?', 'Get a quote'],
  },
  {
    id: 'how-much-storage',
    domain: 'GENERAL_QA',
    title: 'How much storage do I need',
    keywords: ['how much storage', 'how much storage do i need', '128gb or 256gb', '256gb or 512gb', 'is 64gb enough', 'is 128gb enough', 'is 256gb enough', 'phone storage size', 'laptop storage size', 'ssd size', 'which storage size'],
    content:
      'Phones: 64GB is tight today, 128GB suits light use, 256GB suits photos/video and games, 512GB+ for heavy video. Laptops: 256GB is the minimum for light work, 512GB is the comfortable default, 1TB for video, games or big photo libraries. Operating system and apps take 30-60GB or more; leave about 20% free for speed. Cloud backup and external drives are cheaper than buying the largest size.',
    reply:
      "A simple guide:\n\n**Phones**\n- **64 GB** — tight these days; fine only for light use and cloud photos\n- **128 GB** — comfortable for most people\n- **256 GB+** — lots of photos/video, games, offline music\n\n**Laptops / PCs**\n- **256 GB** — minimum for light work\n- **512 GB** — the comfortable default\n- **1 TB** — video editing, big photo libraries, games\n\nThe system and apps already take a good chunk, and drives run best with about **20% free**. Cloud backup or an external drive is usually cheaper than paying for the biggest size.\n\nWhat will you use it for?",
    expert:
      'STORAGE // Phone: 128GB baseline, 256GB+ media/games. Laptop: 512GB baseline, 1TB creative/gaming. Keep ~20% free. Offload to cloud/external.',
    suggestions: ['Upgrade to SSD', 'My storage is full', 'Back up my data'],
  },
  {
    id: 'phone-storage-full',
    domain: 'HARDWARE_REPAIR',
    title: 'Phone storage full',
    keywords: ['storage full', 'phone storage full', 'not enough storage', 'cannot take photos storage', 'free up space', 'free up storage', 'phone says storage almost full', 'no space on phone'],
    content:
      'Free up phone storage: check Settings > Storage to see what is biggest; usually videos, photos, messaging app media (WhatsApp) and unused apps. Back up photos to the cloud or a computer, then delete them from the phone. Clear app caches, remove unused apps, clear downloads. Do not delete system files. A phone that is nearly full gets slow and apps crash.',
    reply:
      "Here's how to get space back safely:\n\n1. **Settings → Storage** to see what's actually big (it's usually videos, photos and chat-app media)\n2. **Back up photos and videos** (cloud or computer) *first*, then delete them from the phone\n3. In **WhatsApp/Telegram**, clear old media and big videos\n4. Remove **apps you don't use** and clear **Downloads**\n5. Restart the phone afterwards\n\nA nearly full phone gets slow and apps start crashing, so aim for around **10–20% free**. Never delete files you don't recognise from system folders.\n\nStill stuck? Tell me the phone model and I'll help you narrow it down.",
    expert:
      'PHONE_STORAGE // Settings>Storage -> find top consumers (video/photo/chat media). Backup first, then delete. Clear caches/downloads, remove unused apps. Keep 10-20% free.',
    suggestions: ['Back up my data', 'My phone is slow', 'Get a quote'],
  },
  {
    id: 'backup-data',
    domain: 'GENERAL_QA',
    title: 'Backing up your data',
    keywords: ['backup', 'back up my data', 'how to backup', 'backup my phone', 'backup photos', 'back up my laptop', 'cloud backup', 'save my files before repair', 'transfer data to new phone', 'protect my files'],
    content:
      'Backups: follow 3-2-1: three copies, on two kinds of storage, one off-site (cloud). Phones: iCloud or Google backup plus photos synced; check the backup date. Computers: copy documents/photos to an external drive and a cloud folder; File History on Windows or Time Machine on Mac. A backup you have never restored from is unproven; open a few files from it. Before any repair, back up if the device still works, and tell the technician if data matters.',
    reply:
      "Backing up is the best thing you can do for any device. Use the **3-2-1 idea**: **3** copies, on **2** kinds of storage, **1** off-site (cloud).\n\n- **Phone:** turn on iCloud / Google backup, and sync photos. Check the *last backup date* actually updated.\n- **Computer:** copy Documents and Photos to an **external drive**, plus a **cloud folder**. (Windows *File History* or Mac *Time Machine* automate it.)\n- **Test it:** open a few files from the backup — an untested backup isn't a backup.\n\n**Before a repair:** back up if the device still turns on, and **tell the technician if the data matters** so nothing gets wiped or reset.\n\nIs the device still working, or is it already dead?",
    expert:
      'BACKUP // 3-2-1 rule. Phone: iCloud/Google + photo sync, verify date. PC: external + cloud, File History/Time Machine. Test restore. Flag data-critical devices before repair.',
    suggestions: ['Recover deleted files', 'My device is not working', 'Get a quote'],
  },
  {
    id: 'buying-laptop',
    domain: 'GENERAL_QA',
    title: 'Choosing a laptop',
    keywords: ['which laptop should i buy', 'buying a laptop', 'best laptop', 'laptop buying guide', 'what laptop for students', 'what specs for a laptop', 'laptop recommendation', 'good laptop for work', 'laptop for programming', 'laptop for design'],
    content:
      'Laptop buying basics: SSD (not HDD) is the most important; 8GB RAM is the floor today, 16GB is the comfortable default and needed for design/dev/video; a recent mid-range CPU (Intel Core i5/Ryzen 5 or newer, or Apple M-series) is enough for most; screen: 1080p IPS at least, good brightness; battery and keyboard matter for daily use; for graphic design look at colour accuracy, for gaming a dedicated GPU. Avoid unknown-brand bargains with eMMC storage. Used business laptops (ThinkPad, Latitude, EliteBook) are often great value if the battery is healthy.',
    reply:
      "Here's what actually matters, in order:\n\n1. **SSD storage** (not a hard drive) — the biggest speed factor\n2. **RAM:** 8 GB is the floor, **16 GB** is the comfortable default (and best for design, coding, video)\n3. **CPU:** a recent mid-range chip — Core i5 / Ryzen 5 or newer, or Apple M-series — is plenty for most people\n4. **Screen:** at least 1080p IPS; check brightness\n5. **Battery & keyboard** — you live with these daily\n\n**By use:** office/study → i5/Ryzen 5, 8–16 GB · design/dev/video → 16 GB+, good screen · gaming → dedicated GPU.\n\n💡 Used business laptops (ThinkPad, Latitude, EliteBook) are often great value *if the battery is healthy* — I can help check one before you buy.\n\nWhat will you use it for, and roughly what's your budget?",
    expert:
      'BUY_LAPTOP // Priority: SSD > RAM (16GB baseline) > CPU (i5/R5/M-series) > 1080p IPS > battery/keyboard. Gaming: dGPU. Used business models viable if battery healthy.',
    suggestions: ['Upgrade my laptop', 'Used phone or laptop check', 'Get a quote'],
  },
  {
    id: 'buying-used-phone',
    domain: 'GENERAL_QA',
    title: 'Buying a used phone safely',
    keywords: ['buy a used phone', 'second hand phone', 'buying used phone', 'refurbished phone', 'check used phone before buying', 'is it safe to buy used', 'fake phone', 'stolen phone check', 'imei check'],
    content:
      'Used phone checklist: check the IMEI (dial *#06#) matches the box and is not blacklisted; test screen for dead pixels, burn-in and touch in every corner; test cameras, speakers, mic, charging port, buttons, Wi-Fi/Bluetooth/SIM; check battery health in settings (iPhone: Battery Health; Android: dialer codes or settings); make sure it is signed out of the previous owner iCloud/Google account and not locked; check for signs of repair or water damage; ask for receipt/box; meet in a safe public place. Avoid deals that look too good to be true.',
    reply:
      "A quick checklist before paying for a used phone:\n\n1. **IMEI** — dial `*#06#`; it should match the box/settings and not be blacklisted\n2. **Accounts** — it must be **signed out of the previous owner's iCloud/Google account** (a locked phone is a brick)\n3. **Screen** — check every corner for touch, dead pixels, burn-in, cracks\n4. **Test everything** — both cameras, speaker, mic, charging port, buttons, Wi-Fi, Bluetooth, SIM\n5. **Battery health** — check it in settings; a worn battery means a near-term replacement cost\n6. **Signs of repair** or water damage, loose back, mismatched screws\n7. **Receipt/box**, and meet somewhere safe and public\n\nIf a deal looks too good to be true, it usually is. Want to get a phone checked by the owner before you buy?",
    expert:
      'USED_PHONE // IMEI(*#06#) match + not blacklisted; account-unlocked; screen/touch; cameras/audio/port/radios; battery health; repair/water signs; receipt; safe meeting.',
    suggestions: ['Is it worth repairing?', 'Get a quote', 'Contact the owner'],
  },
  {
    id: 'blue-screen',
    domain: 'HARDWARE_REPAIR',
    title: 'Blue screen / random restarts',
    keywords: ['blue screen', 'bsod', 'blue screen of death', 'pc keeps restarting', 'computer restarts randomly', 'random shutdown', 'pc crashes', 'laptop keeps crashing', 'stop code', 'kernel panic'],
    content:
      'Blue screens and random restarts: usual causes are faulty or mismatched RAM, failing drive, overheating, bad driver or recent update, failing power supply (desktops), or malware. Note the stop code. Try: unplug extra USB devices, check temperatures and dust, boot to safe mode, uninstall the latest driver/update, run Windows Memory Diagnostic and check the disk health. If it happens during games only, suspect GPU/PSU/heat. Back up important files soon if the drive is suspected. Repeated crashes mean hardware should be tested.',
    reply:
      "A blue screen or random restarts usually points to one of these (most to least common):\n\n1. **A bad driver or recent update** — especially graphics or Wi-Fi drivers\n2. **RAM problems** — faulty or mismatched memory\n3. **Overheating** — dust, dried thermal paste, blocked vents\n4. **A failing drive** (watch for slow boots, clicking, freezes)\n5. **Power supply** on desktops — crashes under load (games, rendering)\n\n**Try this:** note the **stop code** on the screen · unplug extra USB devices · boot into **Safe Mode** · uninstall the latest driver/update · run **Windows Memory Diagnostic**.\n\n⚠️ If it keeps happening, **back up your files soon** — a dying drive can fail without warning. I can walk you through it step by step; does it happen at startup, or only when you're doing something heavy?",
    expert:
      'BSOD // Causes: driver/update, RAM, thermal, drive, PSU. Capture stop code. Safe mode, roll back driver, MemDiag, SMART check, temps. Backup if drive suspect.',
    suggestions: ['My PC is overheating', 'Back up my data', 'Get a quote'],
  },
  {
    id: 'bluetooth-problems',
    domain: 'HARDWARE_REPAIR',
    title: 'Bluetooth not connecting',
    keywords: ['bluetooth not working', 'bluetooth wont connect', 'bluetooth not connecting', 'headphones wont pair', 'airpods not connecting', 'cant pair bluetooth', 'bluetooth keeps disconnecting', 'earbuds not pairing', 'speaker wont pair'],
    content:
      'Bluetooth fixes in order: turn Bluetooth off and on; restart both devices; forget/remove the device and pair again; put the accessory in pairing mode (hold the button until it flashes) and keep it close; make sure it is not still connected to another phone or laptop; charge the accessory; update the OS/drivers; on PC reinstall the Bluetooth driver; reset network settings on phones as a last software step. If nothing pairs with any device the accessory may be faulty; if no accessory pairs with the phone/PC the Bluetooth hardware or antenna may be faulty.',
    reply:
      "Try these in order — most Bluetooth problems stop at step 3:\n\n1. **Switch Bluetooth off and on**, then restart both devices\n2. Make sure the accessory isn't **still connected to another phone or laptop**\n3. **Forget/remove** the device in Bluetooth settings, put the accessory in **pairing mode** (hold its button until it flashes), keep it close, and pair again\n4. **Charge** the accessory fully\n5. **Update** the phone/PC; on a PC, reinstall the **Bluetooth driver**\n6. Last software step on a phone: **reset network settings**\n\n**Narrowing it down:** if the accessory won't pair with *any* device, the accessory is probably faulty. If *no* accessory pairs with your phone/PC, the Bluetooth hardware may be at fault — that's one I can look at.\n\nWhich device and accessory is it?",
    expert:
      'BT // Toggle, restart, forget+re-pair, pairing mode, free from other host, charge, update/driver, reset network. Test accessory on another host to isolate fault.',
    suggestions: ['Get a quote', 'My phone is not working', 'Contact the owner'],
  },
  {
    id: 'usb-not-detected',
    domain: 'HARDWARE_REPAIR',
    title: 'USB / flash drive not detected',
    keywords: ['usb not detected', 'flash drive not showing', 'usb not recognized', 'external hard drive not showing', 'pc doesnt see my flash disk', 'usb device not recognised', 'phone not connecting to pc usb', 'sd card not detected', 'memory card not reading'],
    content:
      'USB or storage not detected: try another port (rear ports on desktops), another cable and another computer to isolate the fault; check Disk Management for the drive without a letter; do not format if it asks to and the data matters; for external hard drives check power and listen for clicking, which means stop using it and seek data recovery; for phones set USB mode to File Transfer and use a data cable not a charge-only cable; for SD cards try another reader. Formatting or repeated plugging can reduce recovery chances.',
    reply:
      "Work through these:\n\n1. **Try another port** (on a desktop, use the back ones), a **different cable**, and **another computer** — that tells you whether it's the drive, cable or computer\n2. On Windows, open **Disk Management** — if the drive appears without a letter, assign one\n3. **Phone to PC?** Set USB mode to **File Transfer** and use a *data* cable (many cables only charge)\n4. **SD card?** Try a different card reader\n\n⚠️ If it asks you to **format**, say **no** if the files matter. If an external drive is **clicking** or never spins up, **stop using it** — repeated tries reduce the chance of recovering the data.\n\nWhat is it — a flash drive, external drive, SD card or phone?",
    expert:
      'USB // Isolate: port, cable, host. Disk Management letter assign. Phone: File Transfer + data cable. Do NOT format if data matters. Clicking drive: power off, recovery.',
    suggestions: ['Recover deleted files', 'Get a quote', 'Contact the owner'],
  },
  {
    id: 'printer-problems',
    domain: 'HARDWARE_REPAIR',
    title: 'Printer problems',
    keywords: ['printer not printing', 'printer offline', 'printer wont connect', 'printer paper jam', 'printer printing blank', 'printer streaks', 'printer not detected', 'printer error', 'printer setup'],
    content:
      'Printer fixes: check power, cables and that it is online (not paused/offline in the queue); restart printer and computer; clear stuck print jobs; reinstall or update the driver from the manufacturer; for Wi-Fi printers make sure it is on the same network as the device and re-add it; paper jams: power off and pull paper gently in the direction of travel; faint or streaky prints: run head cleaning and replace low ink; blank pages on inkjets can mean dried-out nozzles from not printing for a long time.',
    reply:
      "Quick checks, in this order:\n\n1. **Power, cable, and it's set to online** — on a computer, open the print queue and make sure it isn't *paused* or *offline*\n2. **Clear stuck print jobs**, then restart the printer **and** the computer\n3. **Reinstall the driver** from the manufacturer's site (not a random download)\n4. **Wi-Fi printer?** It must be on the **same network** as your phone/laptop — remove and re-add it\n5. **Paper jam:** power off and pull the paper out gently *in the direction it travels*\n6. **Faint or streaky:** run the printer's **head-cleaning** routine and check the ink\n\nBlank pages from an inkjet that hasn't been used for months usually mean **dried nozzles**.\n\nWhat's the printer model and what exactly is it doing?",
    expert:
      'PRINTER // Online status, clear queue, restart, reinstall driver, same-network (Wi-Fi), jam: pull along paper path, head clean for streaks, dried nozzles if blank.',
    suggestions: ['Get a quote', 'Contact the owner', 'My device is not working'],
  },
  {
    id: 'charger-safety',
    domain: 'GENERAL_QA',
    title: 'Chargers, fast charging and safety',
    keywords: ['fake charger', 'is fast charging bad', 'does fast charging damage battery', 'charger gets hot', 'phone gets hot while charging', 'can i use any charger', 'wrong charger', 'wireless charging safe', 'charge overnight', 'is it bad to charge overnight', 'cheap charger'],
    content:
      'Charging safety: use a reputable charger and cable rated for the device; fast charging is designed to be safe and slows down as the battery fills, but heat is what ages batteries; avoid charging under pillows or in the sun; a charger or phone that becomes too hot to hold, smells of burning, or a swollen battery means stop and get it checked. Cheap uncertified chargers can lack protection circuits and are a fire and battery risk. Overnight charging is generally fine on modern phones that stop at 100%, but keeping 20-80% extends lifespan; optimised charging features help.',
    reply:
      "Short version:\n\n- **Use a proper charger and cable** for your device. Cheap uncertified ones can skip the safety circuits — that's a battery *and* fire risk\n- **Fast charging is designed to be safe** (it slows down as the battery fills). **Heat** is what really ages a battery, so don't charge under a pillow or in the sun\n- **Overnight charging** is generally fine on modern phones; keeping the battery between roughly **20–80%** makes it last longer, and \"optimised charging\" settings help\n\n⚠️ **Stop and get it checked if:** the phone or charger gets too hot to hold, there's a **burning smell**, the case is **bulging**, or the battery is swollen.\n\nIs your phone getting hot, or are you choosing a charger?",
    expert:
      'CHARGING // Certified charger/cable. Heat ages cells, not fast-charge per se. 20-80% extends life. STOP if: too hot, burning smell, swollen cell.',
    suggestions: ['My phone is not charging', 'Battery care tips', 'Get a quote'],
  },
  {
    id: 'camera-problems',
    domain: 'HARDWARE_REPAIR',
    title: 'Phone camera problems',
    keywords: ['camera not working', 'camera blurry', 'camera black screen', 'camera shaking', 'front camera not working', 'photos are blurry', 'camera app crashing', 'camera lens cracked', 'flashlight not working'],
    content:
      'Camera troubleshooting: clean the lens with a soft cloth; remove the case or magnet accessories; restart; force close the camera app and check storage space; test front/back and video; update the OS; black screen or shaking/buzzing camera after a drop may mean the camera module or stabilisation is damaged and needs replacement; a cracked lens glass can often be replaced separately from the camera.',
    reply:
      "Start with these:\n\n1. **Clean the lens** with a soft cloth and take off the case/magnetic accessories\n2. **Restart** the phone and check that **storage isn't full**\n3. **Force-close** the camera app and try again; also test the *front* and *back* cameras and video separately\n4. **Update** the phone's software\n\n**What the symptom usually means:**\n- **Black screen / app crashes only** → often software\n- **Buzzing, shaking or blurry after a drop** → the camera module or stabiliser may be damaged\n- **Cracked lens glass** → can often be replaced without changing the whole camera\n\nWhich phone is it, and what does the camera do?",
    expert:
      'CAMERA // Clean lens, remove magnets/case, restart, storage, force-close, update. Hardware suspects: module/OIS after impact. Cracked glass may be replaceable separately.',
    suggestions: ['Get a quote', 'My phone is not working', 'Contact the owner'],
  },
  {
    id: 'speaker-mic-problems',
    domain: 'HARDWARE_REPAIR',
    title: 'No sound / microphone not working',
    keywords: ['no sound', 'speaker not working', 'mic not working', 'microphone not working', 'people cant hear me', 'earpiece not working', 'sound crackling', 'volume very low', 'no audio laptop', 'headphone jack not working'],
    content:
      'Audio troubleshooting: check volume and silent/Do Not Disturb modes; unplug headphones or disconnect Bluetooth; restart; clean speaker and mic grilles gently with a soft brush (not sharp objects); test with another app and a call; remove the case that may cover the mic; on Windows check the playback/recording device selection and reinstall the audio driver; crackling or very low volume can be dust, water exposure or a failing speaker; if only one speaker or mic fails, the component or its flex may be damaged.',
    reply:
      "Check these first:\n\n1. **Volume, silent mode, Do Not Disturb** — and **disconnect Bluetooth/headphones** (sound often goes to the wrong place)\n2. **Restart** and test in a different app, plus a normal call\n3. **Clean the grilles** gently with a soft brush — never needles or sharp tools. Take the **case off** in case it covers the mic\n4. **On a PC:** check the right **playback/recording device** is selected, and reinstall the **audio driver**\n\n**Likely causes if that fails:** dust or moisture in the speaker, or a **damaged speaker/microphone** (often after a drop or water). If only *one* speaker or mic fails, that's usually the component or its ribbon cable — a repair job.\n\nPhone or computer, and is it the speaker, the mic or both?",
    expert:
      'AUDIO // Volume/DND/BT routing, restart, test other app, clean grille (soft), remove case, PC: device select + driver. Persistent: speaker/mic component or flex.',
    suggestions: ['Get a quote', 'My phone is not working', 'Contact the owner'],
  },
  {
    id: 'factory-reset',
    domain: 'GENERAL_QA',
    title: 'Before you factory reset',
    keywords: ['factory reset', 'reset my phone', 'wipe my phone', 'reset laptop', 'should i factory reset', 'will i lose my data if i reset', 'reset to factory settings', 'reinstall windows data', 'hard reset'],
    content:
      'Before a factory reset: it erases everything, so back up photos, contacts, chats and files first and check the backup. Sign out of iCloud/Apple ID or Google account first, otherwise the device can be locked to the old account after the reset (Activation Lock / Factory Reset Protection). Keep it charged above 50%. Remove the SIM and memory card if you want to keep them. Know your account passwords. A reset fixes software problems but not hardware faults, and it is not needed for most slowdowns that clearing storage or removing apps would fix.',
    reply:
      "A factory reset **erases everything**, so before you do it:\n\n1. **Back up** photos, contacts, chats and files — and *check* the backup actually has them\n2. **Sign out of your Apple ID / Google account first.** If you don't, the phone can end up **locked to the old account** after the reset\n3. Make sure it's **charged above 50%** and you **know your passwords**\n4. Take out the **SIM and memory card** if you want to keep them\n\nA reset fixes **software** problems, not hardware faults — and it often isn't needed at all: clearing storage and removing apps fixes most slowdowns.\n\nWhat problem are you trying to fix? There may be a gentler first step.",
    expert:
      'RESET // Erases all. Backup + verify. Sign out of Apple ID/Google (Activation Lock/FRP). Charge >50%, know credentials. Fixes software only.',
    suggestions: ['Back up my data', 'My phone is slow', 'Contact the owner'],
  },
  {
    id: 'password-security',
    domain: 'GENERAL_QA',
    title: 'Passwords, 2FA and staying secure',
    keywords: ['password manager', 'strong password', 'two factor authentication', '2fa', 'how to secure my accounts', 'how to stay safe online', 'secure my phone', 'password tips', 'stop getting hacked', 'is public wifi safe'],
    content:
      'Account security basics: use a password manager and a unique long passphrase per account; turn on two-factor authentication (an authenticator app or security key is stronger than SMS); keep the phone and apps updated; do not reuse passwords; avoid logging into banking on public Wi-Fi without a trusted connection; be suspicious of urgent messages with links; set a screen lock and enable Find My Device; review which apps and devices are logged in.',
    reply:
      "The few habits that stop most account takeovers:\n\n1. **Unique, long passwords** — use a **password manager** so you don't have to remember them\n2. **Two-factor authentication** on email, social and banking. An **authenticator app** is stronger than SMS codes\n3. **Keep your phone and apps updated**\n4. **Don't click urgent links** in messages — go to the site yourself\n5. **Screen lock + Find My Device** switched on\n6. On **public Wi-Fi**, avoid banking or sensitive logins\n\nYour **email account is the master key** to everything else, so secure that one first. If you think something's already been compromised, tell me and I'll give you the recovery steps.",
    expert:
      'SECURITY // Password manager, unique passphrases, 2FA (app/key > SMS), updates, no urgent-link clicks, screen lock + Find My Device, avoid sensitive logins on public Wi-Fi. Secure email first.',
    suggestions: ['I think I was hacked', 'Phishing and scams', 'Contact the owner'],
  },
  {
    id: 'keyboard-touchpad',
    domain: 'HARDWARE_REPAIR',
    title: 'Keyboard or touchpad not working',
    keywords: ['keyboard not working', 'keys not working', 'laptop keyboard stopped', 'touchpad not working', 'trackpad not working', 'mouse not working', 'keys typing wrong letters', 'sticky keys', 'cursor jumping', 'cursor moves by itself'],
    content:
      'Keyboard/touchpad troubleshooting: restart; check that the touchpad was not disabled with a function key (Fn + F-key) or in settings; plug in an external USB keyboard/mouse to tell hardware from software; update or reinstall drivers; check for liquid spills (stop using if sticky); a few dead keys may be dirt (clean with compressed air) or a damaged keyboard ribbon; whole keyboard dead after a spill needs a technician; cursor drifting can be a swollen battery pushing on the touchpad, so check for a bulging underside.',
    reply:
      "Quick checks:\n\n1. **Restart**, then check the touchpad wasn't **switched off** (look for an **Fn + F-key** with a touchpad symbol)\n2. Plug in an **external USB keyboard/mouse** — if that works, the built-in one is the problem; if not, it's software/drivers\n3. **Update or reinstall the drivers**\n4. A **few dead keys** are often dirt — try **compressed air**\n5. **Spilled something?** Switch off, unplug, and don't keep typing on a sticky keyboard — that's a job for a technician\n\n⚠️ **Cursor drifting, a clicking touchpad or a raised base?** A **swollen battery** can press on the touchpad from underneath. Stop charging it and get it checked.\n\nWhat laptop is it, and what's the keyboard or touchpad doing?",
    expert:
      'INPUT // Restart, Fn-toggle touchpad, test external USB device to isolate, drivers, compressed air for keys, spill: power off. Swollen battery can distort touchpad — stop charging.',
    suggestions: ['Get a quote', 'My laptop is not working', 'Contact the owner'],
  },
  {
    id: 'monitor-no-signal',
    domain: 'HARDWARE_REPAIR',
    title: 'Monitor says no signal',
    keywords: ['no signal', 'monitor no signal', 'screen says no signal', 'black screen pc on', 'monitor not detected', 'second monitor not working', 'hdmi not working', 'displayport no signal', 'tv no signal pc'],
    content:
      'No signal on a monitor: confirm the monitor input source matches the cable (HDMI 1/2/DisplayPort); reseat both ends of the cable or try another cable/port; on desktops plug the cable into the graphics card, not the motherboard, if there is a dedicated GPU; check the PC is actually on (fans, lights); try another monitor or the PC on another screen to find the faulty part; reseat RAM and graphics card; beeps at startup point to RAM/GPU faults; on laptops with external displays press Windows+P and choose duplicate or extend.',
    reply:
      "Run through this:\n\n1. **Input source** — on the monitor's menu, make sure it's set to the port you plugged into (HDMI 1, HDMI 2, DisplayPort…)\n2. **Reseat both ends** of the cable, or try **another cable and port**\n3. **Desktop with a graphics card?** Plug the monitor into the **graphics card**, not the motherboard\n4. Is the PC actually **on**? Check fans and lights; listen for **beeps** at startup\n5. **Test with another monitor/TV** — that shows whether the screen or the PC is at fault\n6. **Laptop to external screen:** press **Windows + P** and pick *Duplicate* or *Extend*\n7. Still nothing on a desktop? Reseating the **RAM** and **graphics card** fixes it surprisingly often\n\nIs it a desktop or laptop, and does the PC seem to be starting up?",
    expert:
      'DISPLAY // Match input source, reseat/replace cable, use GPU output (not mobo) on dGPU systems, confirm PC power, test alt monitor, laptop: Win+P, desktop: reseat RAM/GPU, note beep codes.',
    suggestions: ['My PC beeps on startup', 'Get a quote', 'Contact the owner'],
  },
];
