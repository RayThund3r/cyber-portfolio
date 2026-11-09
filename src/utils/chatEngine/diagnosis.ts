// src/utils/chatEngine/diagnosis.ts
//
// Guided troubleshooting knowledge. For each common fault: the one or two questions a good technician
// would ask first, and a conclusion that RANKS the likely causes from the answers and says what is safe
// to try. This is what lets the chat reason through a problem without any language model.
//
// Rules the content follows:
//   * nothing that could hurt the person or the device (no opening batteries, no heat guns, no "rice")
//   * never invent prices or guarantees — cost depends on the part and is quoted by the owner
//   * ranked causes, not a single confident verdict: a remote diagnosis is a best guess

import type { DeviceType, SymptomId } from './entities';

export interface Ctx {
  device?: DeviceType;
  noun: 'phone' | 'tablet' | 'laptop' | 'computer';
  isPhone: boolean; // phone or tablet
  isComputer: boolean; // laptop / desktop / pc
}

export function makeCtx(device?: DeviceType): Ctx {
  const isPhone = device === 'phone' || device === 'tablet';
  const noun = device === 'phone' ? 'phone' : device === 'tablet' ? 'tablet' : device === 'laptop' ? 'laptop' : 'computer';
  return { device, noun, isPhone, isComputer: !isPhone && !!device };
}

export interface Opt {
  label: string;
  test: RegExp;
  val: string;
}

export interface Question {
  id: string;
  /** Short phrase used when recapping the reasoning ("a different cable and charger"). */
  recap: string;
  ask: (c: Ctx) => string;
  expert?: (c: Ctx) => string;
  opts: Opt[];
  /** Skip this question when it makes no sense for the device or earlier answers. */
  skip?: (a: Answers, c: Ctx) => boolean;
}

export type Answers = Record<string, string>;

export interface Cause {
  name: string;
  why: string;
}

export interface Conclusion {
  causes: Cause[];
  tryNow: string[];
  stopIf: string[];
  /** Short lines explaining WHY the causes are ranked this way (shown for "why do you say that?"). */
  because: string[];
  /** Safety or time-critical: the reply leads with this and nudges the visitor to act today. */
  urgent?: string;
  /** Used to look up a matching picture in the knowledge base. */
  kbQuery?: string;
}

export interface Tree {
  id: SymptomId;
  title: string;
  /** One-sentence opener shown with the first question. */
  intro: (c: Ctx) => string;
  questions: Question[];
  conclude: (a: Answers, c: Ctx) => Conclusion;
}

const yes = /\b(yes|yeah|yep|yup|ya|sure|it does|does|did|correct|true)\b/;
const no = /^(no|nope|nah)\b|\b(it doesnt|doesnt|dont|didnt|not really|negative)\b/;

const YN = (y: string, n: string): Opt[] => [
  { label: y, test: yes, val: 'yes' },
  { label: n, test: no, val: 'no' },
];

export const TREES: Record<SymptomId, Tree> = {
  /* ------------------------------------------------------------------ not charging */
  no_charge: {
    id: 'no_charge',
    title: 'Not charging',
    intro: (c) => `Charging problems are usually cheap to fix once we know which part is failing — the ${c.noun}, the cable, or the charger.`,
    questions: [
      {
        id: 'tried',
        recap: 'a different cable and charger',
        ask: (c) => `Have you tried a **different cable and a different charger/socket**? (Not a laptop USB port — a wall adapter${c.isComputer ? ' that matches your laptop' : ''}.)`,
        expert: () => 'DIAG // Swap test done? Different cable + adapter + socket.',
        opts: [
          { label: 'Not yet', test: /\b(not yet|havent|have not|didnt try|not tried|never tried|dont have)\b/, val: 'untried' },
          { label: 'Yes, same problem', test: /\b(yes|yeah|yep|tried|already|same|still|did)\b/, val: 'tried' },
          { label: 'Not yet', test: /^(no|nope|nah)\b/, val: 'untried' },
        ],
      },
      {
        id: 'sign',
        recap: 'what shows when plugged in',
        ask: (c) => `When you plug it in, does it show **any** sign of charging${c.isPhone ? ' (lightning bolt, battery icon, vibration)' : ' (charge light, battery icon)'}?`,
        expert: () => 'DIAG // Charge indicator on plug-in?',
        skip: (a) => a.tried === 'untried',
        opts: [
          { label: 'Yes, but it stays low / slow', test: /\b(slow|stays|low|barely|crawl\w*|but|yes)\b/, val: 'slow' },
          { label: 'Comes and goes', test: /\b(comes and goes|on and off|flicker\w*|sometimes|intermittent|keeps? (stopping|disconnect\w*))\b/, val: 'flaky' },
          { label: 'Nothing at all', test: /\b(nothing|none|no sign|dead|no|nope|zero)\b/, val: 'none' },
        ],
      },
      {
        id: 'fit',
        recap: 'how the plug fits',
        ask: () => 'Does the plug feel **loose** in the port, or only work if you hold it at an angle?',
        expert: () => 'DIAG // Connector seating: loose / angle-dependent?',
        skip: (a) => a.tried === 'untried',
        opts: [
          { label: 'Yes, loose or wobbly', test: /\b(yes|loose|wobbl\w*|angle|wiggle|hold|jiggle)\b/, val: 'loose' },
          { label: 'Fits firmly', test: /\b(no|firm\w*|fine|tight|snug|normal|ok)\b/, val: 'firm' },
          { label: 'Looks dirty / bent', test: /\b(dirt\w*|lint|dust|bent|damag\w*|green|corrod\w*|burn\w*)\b/, val: 'dirty' },
        ],
      },
    ],
    conclude: (a, c) => {
      if (a.tried === 'untried') {
        return {
          causes: [
            { name: 'Faulty cable or adapter', why: 'The most common cause by far — cables fray inside the connector where you can’t see it.' },
            { name: 'Dirty or worn charging port', why: 'Pocket lint packs into the port and stops the plug seating fully.' },
            { name: 'Battery or charging circuit', why: 'Only worth suspecting once a known-good cable and charger fail too.' },
          ],
          tryNow: [
            'Try another cable **and** another wall adapter (ideally the original, or one with the same rating).',
            'Use a different wall socket — not a power strip or a computer USB port.',
            c.isPhone ? 'Power the phone off, then look into the port with a torch for lint.' : 'Check that the adapter’s own light is on and the plug is fully seated.',
          ],
          stopIf: ['the plug or adapter feels hot or smells burnt', 'there is visible damage or green/white residue in the port'],
          because: ['A swap test hasn’t been done yet, and it explains most charging faults — so it comes first.'],
          kbQuery: 'phone not charging',
        };
      }
      const causes: Cause[] = [];
      const because: string[] = ['A different cable and charger didn’t help, so those are unlikely to be the cause.'];
      if (a.fit === 'loose' || a.fit === 'dirty') {
        causes.push({ name: 'Worn, damaged or clogged charging port', why: 'A loose fit or visible dirt/damage points straight at the port itself.' });
        because.push(`A ${a.fit === 'loose' ? 'loose fit' : 'dirty or bent port'} is the classic sign of port wear.`);
      }
      if (a.sign === 'flaky') {
        causes.push({ name: 'Intermittent contact in the port or its flex cable', why: 'Charging that comes and goes means the connection is breaking and remaking.' });
        because.push('Charging that comes and goes means a connection that is intermittent.');
      }
      if (a.sign === 'slow') {
        causes.push({ name: 'Weak or worn battery', why: 'A tired battery accepts charge slowly and drops quickly.' });
        causes.push({ name: 'Charger delivers too little power', why: 'Low-wattage adapters can’t keep up while the device is in use.' });
        because.push('It does charge, just poorly — that points to the battery or power delivery rather than a dead port.');
      }
      if (a.sign === 'none') {
        causes.push({ name: c.isComputer ? 'Charging jack, adapter or mainboard charging circuit' : 'Charging port or charging chip on the board', why: 'No sign at all, even with a known-good charger, means power isn’t reaching or entering the battery.' });
        causes.push({ name: 'Fully drained battery', why: 'A battery left at 0% for long can refuse to wake until it has trickle-charged for a while.' });
        because.push('No sign of charging at all after a swap test narrows it to the port, the board or a deeply drained battery.');
      }
      if (causes.length === 0) causes.push({ name: 'Charging port or battery wear', why: 'With cables ruled out, those are the usual suspects.' });
      return {
        causes: causes.slice(0, 3),
        tryNow: [
          c.isPhone ? 'Power it off, then gently clear the port with a **wooden or plastic toothpick** (never metal) and try again.' : 'Wiggle-test the plug gently; if the light flickers, the jack is worn.',
          'Leave it on a known-good charger for 30–60 minutes — a deeply drained battery needs time.',
          'Back up what you can while it still turns on.',
        ],
        stopIf: ['it gets hot while plugged in', 'the case is bulging or the screen is lifting', 'you smell burning'],
        because,
        kbQuery: 'phone not charging',
      };
    },
  },

  /* ------------------------------------------------------------------ won't turn on */
  no_power: {
    id: 'no_power',
    title: 'Won’t turn on',
    intro: (c) => `A ${c.noun} that won’t start can be something simple (power) or something deeper — a few questions will tell us which.`,
    questions: [
      {
        id: 'life',
        recap: 'signs of life',
        ask: () => 'When you press the power button or plug it in, is there **any** sign of life — a light, vibration, fan, sound or logo?',
        expert: () => 'DIAG // Any LED / haptic / fan / chime / logo on power?',
        opts: [
          { label: 'Nothing at all', test: /\b(nothing|none|no|nope|zero|dead|completely)\b/, val: 'none' },
          { label: 'Light or sound, no picture', test: /\b(light|led|sound|beep\w*|fan|vibrat\w*|hear|noise|spin\w*|no (picture|display|screen))\b/, val: 'partial' },
          { label: 'Starts, then stops', test: /\b(logo|starts?|then|stops?|turns? off|loop|restart\w*|shut\w*)\b/, val: 'stops' },
        ],
      },
      {
        id: 'powered',
        recap: 'charged for 30+ minutes on a working charger',
        ask: (c) => `Has it been on a **working charger for 30+ minutes**${c.isComputer ? ' (and does the adapter light come on)' : ''}?`,
        expert: () => 'DIAG // ≥30 min on known-good charger?',
        skip: (a) => a.life === 'stops',
        opts: [
          { label: 'Yes', test: yes, val: 'yes' },
          { label: 'Not yet', test: /^(no|nope|nah|not yet)\b|\b(havent|not yet|didnt)\b/, val: 'no' },
        ],
      },
      {
        id: 'event',
        recap: 'what happened before',
        ask: () => 'Did anything happen just before — a **drop, liquid, update** — or did it just die?',
        expert: () => 'DIAG // Preceding event: drop / liquid / update / none?',
        opts: [
          { label: 'A drop or knock', test: /\b(drop\w*|fell|knock\w*|hit|impact|crash\w*|stepped)\b/, val: 'drop' },
          { label: 'Liquid', test: /\b(liquid|water|spill\w*|wet|rain|coffee|juice)\b/, val: 'liquid' },
          { label: 'After an update', test: /\b(update\w*|install\w*|upgrad\w*|software|reset)\b/, val: 'update' },
          { label: 'Nothing, it just died', test: /\b(nothing|just|suddenly|out of nowhere|randomly|no)\b/, val: 'none' },
        ],
      },
    ],
    conclude: (a, c) => {
      const causes: Cause[] = [];
      const because: string[] = [];
      let urgent: string | undefined;
      if (a.event === 'liquid') {
        urgent = 'Liquid damage gets worse with every hour — **don’t try to power it on or charge it**.';
        causes.push({ name: 'Liquid damage / corrosion on the board', why: 'Liquid shorts and then corrodes the circuitry; the sooner it is opened and cleaned, the better the odds.' });
        because.push('You mentioned liquid, which outweighs every other explanation.');
      }
      if (a.event === 'drop') {
        causes.push({ name: 'Loose or damaged internal connector, battery or board', why: 'An impact commonly knocks the battery or display connector loose, or cracks a solder joint.' });
        because.push('A drop right before it died points at something physically displaced or broken.');
      }
      if (a.life === 'none' && a.powered === 'no') {
        causes.push({ name: 'Simply flat, or a bad charger', why: 'A fully drained battery can show nothing for the first 15–30 minutes of charging.' });
        because.push('It hasn’t had a proper charge on a working charger yet, which is the cheapest thing to rule out.');
      }
      if (a.life === 'none' && a.powered !== 'no') {
        causes.push({ name: c.isComputer ? 'Power supply / DC jack / mainboard power circuit' : 'Dead battery or board power fault', why: 'No sign of life even after proper charging means power isn’t reaching the circuitry.' });
        because.push('No response at all after a proper charge narrows it to the battery or the power section of the board.');
      }
      if (a.life === 'partial') {
        causes.push({ name: 'Display, backlight or connector fault (the device may actually be on)', why: 'Lights, sounds or a fan with no picture usually means the machine runs but the screen path has failed.' });
        causes.push({ name: c.isComputer ? 'Faulty RAM or graphics' : 'Software hang or bad display', why: 'Beeps or a spinning fan with a blank screen often mean memory or graphics can’t initialise.' });
        because.push('Signs of life without a picture split the problem into “screen path” versus “can’t start up”.');
      }
      if (a.life === 'stops' || a.event === 'update') {
        causes.push({ name: 'Corrupted software / failed update (boot loop)', why: 'Starting and then stopping, or failing after an update, usually means the system files are damaged.' });
        causes.push({ name: 'Failing storage or battery under load', why: 'A drive or battery that can’t sustain the start-up surge shuts the device down mid-boot.' });
        because.push('Starting up and then stopping (or following an update) is the typical pattern of a software or storage problem.');
      }
      if (causes.length === 0) causes.push({ name: 'Battery or power circuit fault', why: 'The most common reason for a device that gives no response.' });
      return {
        causes: causes.slice(0, 3),
        urgent,
        tryNow: a.event === 'liquid'
          ? ['Leave it **off** and unplugged.', 'Remove the case, SIM and memory card if you can.', 'Dry the outside with a cloth — **no hair dryer, oven or rice** (heat and starch make it worse).', 'Bring it in as soon as possible.']
          : [
              c.isPhone ? 'Hold the power button for **15–20 seconds** (a forced restart), then charge it for 30 minutes.' : 'Unplug everything, hold the power button for 30 seconds, then try the charger only.',
              'Try a different cable, adapter and socket.',
              c.isComputer ? 'If you hear fans or see lights but no picture, connect an external monitor to test the display.' : 'Check the charging port for lint and try once more after 30 minutes on charge.',
            ],
        stopIf: ['it is hot, swollen or smells burnt', 'there was liquid or a hard drop', 'you can’t afford to lose what is on it (stop retrying — repeated attempts can make data recovery harder)'],
        because: because.length ? because : ['No other clues, so I’m starting with the most common power-related causes.'],
        kbQuery: 'phone won\'t turn on',
      };
    },
  },

  /* ------------------------------------------------------------------ overheating */
  overheat: {
    id: 'overheat',
    title: 'Overheating',
    intro: (c) => `Heat is a symptom with a short list of causes. When the ${c.noun} gets hot tells us a lot.`,
    questions: [
      {
        id: 'when',
        recap: 'when it gets hot',
        ask: () => 'When does it get hot?',
        expert: () => 'DIAG // Thermal trigger: idle / load / charging?',
        opts: [
          { label: 'Even when idle', test: /\b(idle|nothing|always|even when|constant\w*|just sitting|doing nothing)\b/, val: 'idle' },
          { label: 'Heavy use or games', test: /\b(game\w*|gaming|heavy|video|edit\w*|load|stream\w*|zoom|meeting|apps?|work)\b/, val: 'load' },
          { label: 'While charging', test: /\b(charg\w*|plugged|plug)\b/, val: 'charging' },
        ],
      },
      {
        id: 'age',
        recap: 'age and last clean',
        ask: (c) => (c.isComputer ? 'How old is it, and has it **ever been opened and cleaned** (dust, thermal paste)?' : 'Is it usually in a **thick case or in the sun**, and how old is the phone?'),
        expert: (c) => (c.isComputer ? 'DIAG // Age + last service (dust/paste)?' : 'DIAG // Case/ambient conditions + age?'),
        opts: [
          { label: 'Older / never cleaned', test: /\b(old|older|never|years?|3|4|5|6|long time|ages)\b/, val: 'old' },
          { label: 'Newer (under 2 years)', test: /\b(new|newer|recent\w*|month\w*|1|2|under|bought|less)\b/, val: 'new' },
          { label: 'Recently cleaned / serviced', test: /\b(clean\w*|serviced|repasted|repaired|fixed)\b/, val: 'cleaned' },
        ],
      },
    ],
    conclude: (a, c) => {
      const causes: Cause[] = [];
      const because: string[] = [];
      if (a.when === 'idle') {
        causes.push({ name: 'A runaway background process (or unwanted software)', why: 'Heat while doing nothing means something is quietly working hard.' });
        causes.push({ name: c.isPhone ? 'Battery or charging circuit fault' : 'Failing fan, dried paste or a stuck high-performance mode', why: 'Hardware that can’t shed even idle heat is faulty rather than just dusty.' });
        because.push('Heat at idle is not normal load, so I looked for background activity and hardware faults first.');
      }
      if (a.when === 'load') {
        causes.push({ name: c.isComputer ? 'Dust-clogged vents and dried thermal paste' : 'Normal throttling under heavy use, worsened by a case or sun', why: 'Under load the cooling system is pushed to its limit; clogged airflow is the most common weakness.' });
        because.push('Heat only under load is the classic cooling-capacity pattern.');
      }
      if (a.when === 'charging') {
        causes.push({ name: 'Charging heat plus a worn battery', why: 'Charging adds heat; an aged battery makes more of it.' });
        causes.push({ name: 'Wrong or low-quality charger', why: 'Poor chargers run hotter and charge less efficiently.' });
        because.push('Heat that follows charging points at the battery and charger.');
      }
      if (a.age === 'old' && c.isComputer) {
        causes.unshift({ name: 'Dust and dried-out thermal paste (due for a clean and re-paste)', why: 'Paste hardens after a few years and vents clog — temperatures creep up until the machine throttles or shuts down.' });
        because.push('Age with no cleaning makes dust and old paste the top suspect.');
      }
      if (causes.length === 0) causes.push({ name: 'Restricted airflow or heavy background load', why: 'The two most common causes of unexplained heat.' });
      return {
        causes: causes.slice(0, 3),
        tryNow: c.isComputer
          ? ['Use it on a **hard flat surface** (not a bed or lap) and keep vents clear.', 'Open Task Manager / Activity Monitor and look for a process using most of the CPU.', 'Set power mode to Balanced and restart.', 'Blow dust out of the vents with short bursts of air if you’re comfortable — never open it if it’s under warranty.']
          : ['Take it out of its case and out of the sun.', 'Close background apps and stop charging while using heavy apps.', 'Restart it, and install pending system updates.', 'Use the original charger.'],
        stopIf: ['it is too hot to hold', 'it shuts itself down', 'the case is swelling or smells burnt'],
        because,
        kbQuery: 'overheating',
      };
    },
  },

  /* ------------------------------------------------------------------ slow / freezing */
  slow: {
    id: 'slow',
    title: 'Slow or freezing',
    intro: (c) => `A slow ${c.noun} nearly always comes down to storage, memory or software — easy to narrow down.`,
    questions: [
      {
        id: 'scope',
        recap: 'where it is slow',
        ask: () => 'Is it slow **everywhere**, or only in one app or website?',
        expert: () => 'DIAG // Scope: system-wide or single app?',
        opts: [
          { label: 'Everywhere', test: /\b(everywhere|all|everything|whole|system|always|overall|yes)\b/, val: 'all' },
          { label: 'One app or site', test: /\b(one|only|just|app|site|website|browser|game|specific)\b/, val: 'one' },
        ],
      },
      {
        id: 'age',
        recap: 'age and storage',
        ask: (c) => (c.isComputer ? 'How old is it, and does it use an **old hard drive (HDD)** or a newer SSD? (Not sure? Just give the age.)' : 'How **full is the storage**, and how old is the phone?'),
        expert: (c) => (c.isComputer ? 'DIAG // Age + drive type (HDD/SSD)?' : 'DIAG // Free storage + device age?'),
        opts: [
          { label: 'Old (4+ years) / HDD', test: /\b(old|older|hdd|hard drive|spinning|years?|4|5|6|7|8|ages)\b/, val: 'old' },
          { label: 'Fairly new / SSD', test: /\b(new|newer|ssd|nvme|recent\w*|month\w*|1|2|3)\b/, val: 'new' },
          { label: 'Storage almost full', test: /\b(full|no space|almost|nearly|low space)\b/, val: 'full' },
        ],
      },
    ],
    conclude: (a, c) => {
      const causes: Cause[] = [];
      const because: string[] = [];
      if (a.scope === 'one') {
        causes.push({ name: 'That one app or site, not the device', why: 'If everything else is fast, the device itself is healthy.' });
        causes.push({ name: 'Outdated app or a heavy browser extension', why: 'Updates and extensions are the usual culprits.' });
        because.push('Only one thing is slow, so the device is probably fine.');
      } else {
        if (a.age === 'full') {
          causes.push({ name: 'Storage almost full', why: 'Below ~10% free space, devices slow down sharply because they can’t cache or swap.' });
          because.push('Nearly full storage is a very common cause of general slowness.');
        }
        if (a.age === 'old' && c.isComputer) {
          causes.push({ name: 'Old hard drive (HDD) — an SSD upgrade is the single biggest speed-up', why: 'Spinning drives are many times slower than SSDs; swapping one often makes an old laptop feel new.' });
          because.push('An older machine that’s slow everywhere is usually held back by the drive or too little memory.');
        }
        if (a.age === 'old' && c.isPhone) {
          causes.push({ name: 'Ageing battery and an update the phone is too old to run well', why: 'Old batteries make phones throttle their processor, and newer software is heavier.' });
        }
        causes.push({ name: 'Too many startup apps, background tasks or unwanted software', why: 'The easiest fix and the most common cause overall.' });
        if (c.isComputer) causes.push({ name: 'Not enough RAM for how you use it', why: '4 GB is tight for modern browsing; 8 GB or more makes a big difference.' });
      }
      return {
        causes: causes.slice(0, 3),
        tryNow: c.isComputer
          ? ['Restart, then disable heavy startup apps (Task Manager → Startup).', 'Free up space — aim for **at least 15% free**.', 'Check for malware with a reputable scanner.', 'Check the drive type (Task Manager → Performance → Disk): HDD means an SSD upgrade is worth asking about.']
          : ['Delete unused apps and move photos/videos to the cloud or a computer.', 'Clear app cache for the slowest apps, then restart.', 'Install pending system and app updates.', 'Check battery health in Settings.'],
        stopIf: ['it freezes completely or restarts by itself', 'the drive makes clicking sounds (back up immediately)', 'you see disk errors on start-up'],
        because: because.length ? because : ['Slowness without other clues most often comes from storage, memory or background software.'],
        kbQuery: 'slow computer',
      };
    },
  },

  /* ------------------------------------------------------------------ restarts / shutdowns */
  shutdown: {
    id: 'shutdown',
    title: 'Restarting or shutting down',
    intro: (c) => `A ${c.noun} that restarts or shuts off on its own is telling us something — the pattern matters.`,
    questions: [
      {
        id: 'pattern',
        recap: 'the pattern',
        ask: () => 'What exactly does it do?',
        expert: () => 'DIAG // Pattern: loop / random / load-triggered / blue screen?',
        opts: [
          { label: 'Stuck in a restart loop', test: /\b(loop|logo|stuck|keeps? restarting|never (gets|finish\w*)|boot)\b/, val: 'loop' },
          { label: 'Shuts off randomly', test: /\b(random\w*|suddenly|by itself|on its own|out of nowhere|any ?time)\b/, val: 'random' },
          { label: 'Only under load / when hot', test: /\b(load|game\w*|gaming|heavy|hot|heat\w*|charging|video)\b/, val: 'load' },
          { label: 'Blue screen / error', test: /\b(blue|bsod|error|code|stop code|crash\w*)\b/, val: 'bsod' },
        ],
      },
      {
        id: 'recent',
        recap: 'recent changes',
        ask: () => 'Did it start **after** an update, a new app/driver, a drop, or a battery change?',
        expert: () => 'DIAG // Onset: update / install / drop / none?',
        opts: [
          { label: 'After an update or install', test: /\b(update\w*|install\w*|driver|app|software|upgrad\w*)\b/, val: 'software' },
          { label: 'After a drop or knock', test: /\b(drop\w*|fell|knock\w*|hit|impact)\b/, val: 'drop' },
          { label: 'No change I know of', test: /\b(no|nothing|dont know|not sure|just)\b/, val: 'none' },
        ],
      },
    ],
    conclude: (a, c) => {
      const causes: Cause[] = [];
      const because: string[] = [];
      if (a.pattern === 'loop') {
        causes.push({ name: 'Corrupted operating system or failed update', why: 'A loop that never reaches the home screen is the textbook sign of damaged system files.' });
        causes.push({ name: 'Failing storage', why: 'If the drive can’t read the system reliably, start-up repeats.' });
        because.push('A restart loop before the desktop/home screen points to the system files or the drive.');
      }
      if (a.pattern === 'random') {
        causes.push({ name: 'Worn battery or loose battery connection', why: 'Sudden shutdowns at “20–30%” are a classic worn-battery sign.' });
        causes.push({ name: 'Overheating protection kicking in', why: 'Devices cut power to protect themselves when too hot.' });
        because.push('Unpredictable shutdowns usually mean the power supply to the circuitry is unstable — battery or heat.');
      }
      if (a.pattern === 'load') {
        causes.push({ name: 'Overheating under load', why: 'It copes at idle but trips its thermal limit when working hard.' });
        causes.push({ name: c.isComputer ? 'Weak power supply / adapter' : 'Battery that can’t deliver peak power', why: 'Heavy use asks for the most power — a tired supply fails first.' });
        because.push('Failing only under load separates heat and power delivery from software.');
      }
      if (a.pattern === 'bsod') {
        causes.push({ name: 'Faulty driver or recent software change', why: 'Most blue screens trace back to a driver.' });
        causes.push({ name: 'Failing RAM or storage', why: 'Repeated stop codes across different apps suggest hardware.' });
        because.push('A blue screen gives an error code — the usual causes are drivers, then memory or storage.');
      }
      if (a.recent === 'drop') causes.unshift({ name: 'Physical damage from the impact (battery, connector or board)', why: 'Problems that begin right after a knock are physical until proven otherwise.' });
      if (causes.length === 0) causes.push({ name: 'Battery, heat or software fault', why: 'The three usual causes of unexpected restarts.' });
      return {
        causes: causes.slice(0, 3),
        tryNow: [
          'Note the **exact error text or code** if there is one — it narrows things down a lot.',
          c.isComputer ? 'Boot into Safe Mode; if it’s stable there, a driver or app is the cause.' : 'Restart in Safe Mode; if it’s stable, an app is the cause.',
          'Keep it cool and charged above 30% while testing.',
          'Back up important files if it stays up long enough.',
        ],
        stopIf: ['it won’t stay on long enough to back up and the data matters', 'it gets very hot or smells burnt', 'the battery is swollen'],
        because: because.length ? because : ['Restarts without other clues usually come from the battery, heat or software.'],
        kbQuery: 'keeps restarting',
      };
    },
  },

  /* ------------------------------------------------------------------ display */
  black_screen: {
    id: 'black_screen',
    title: 'Display problem',
    intro: () => 'A blank or glitchy display can be the screen itself — or the device behind it. One test separates the two.',
    questions: [
      {
        id: 'alive',
        recap: 'whether the device is on behind the blank screen',
        ask: (c) => `Is the ${c.noun} actually **on** — can you hear sounds, feel vibrations, or see lights?`,
        expert: () => 'DIAG // Device alive behind black display?',
        opts: [
          { label: 'Yes, it seems on', test: yes, val: 'yes' },
          { label: 'No sign of life', test: no, val: 'no' },
        ],
      },
      {
        id: 'torch',
        recap: 'the torch test',
        ask: () => 'Shine a **torch at an angle** onto the dark screen. Can you faintly see the image?',
        expert: () => 'DIAG // Torch test: faint image visible?',
        skip: (a) => a.alive === 'no',
        opts: [
          { label: 'Yes, faintly', test: yes, val: 'faint' },
          { label: 'No image at all', test: no, val: 'none' },
        ],
      },
      {
        id: 'impact',
        recap: 'impact or pressure',
        ask: () => 'Was there a **drop, pressure or liquid** before it went blank — or lines/colour patches first?',
        expert: () => 'DIAG // Preceded by impact / liquid / lines?',
        skip: (a) => a.alive === 'no',
        opts: [
          { label: 'Drop or pressure', test: /\b(drop\w*|fell|knock\w*|pressure|squash\w*|sat on|bent)\b/, val: 'impact' },
          { label: 'Lines or colours first', test: /\b(lines?|colou?rs?|patch\w*|spots?|flicker\w*|glitch\w*|green|pink)\b/, val: 'lines' },
          { label: 'Nothing, suddenly', test: /\b(no|nothing|sudden\w*|just)\b/, val: 'none' },
        ],
      },
    ],
    conclude: (a, c) => {
      if (a.alive === 'no') {
        return {
          causes: [
            { name: 'The device itself isn’t starting (not just the screen)', why: 'No sounds, vibration or lights means this is really a power/start-up fault.' },
            { name: 'Battery or board power fault', why: 'The usual reasons for total silence.' },
          ],
          tryNow: ['Charge it for 30 minutes on a known-good charger.', 'Force a restart (hold power 15–20 s).', 'See the “won’t turn on” checks if there’s still nothing.'],
          stopIf: ['it is hot, swollen or smells burnt'],
          because: ['With no sign of life, the screen isn’t the first thing to blame.'],
          kbQuery: 'phone won\'t turn on',
        };
      }
      const causes: Cause[] = [];
      const because: string[] = [];
      if (a.torch === 'faint') {
        causes.push({ name: 'Failed backlight or its power circuit', why: 'A faint image under a torch means the panel works but the light behind it doesn’t.' });
        because.push('Seeing the image with a torch is the classic backlight-failure test.');
      }
      if (a.impact === 'impact' || a.impact === 'lines') {
        causes.push({ name: 'Damaged display panel or flex cable', why: 'Lines, patches or a black screen after a knock mean the panel or its connector is damaged.' });
        because.push('Lines or damage before it went blank point to the panel or its cable.');
      }
      causes.push({ name: c.isComputer ? 'Loose display cable or failing graphics' : 'Software hang or a loose display connector', why: 'A common and sometimes inexpensive cause.' });
      return {
        causes: causes.slice(0, 3),
        tryNow: [
          c.isComputer ? 'Plug in an **external monitor or TV**: if that works, the laptop’s screen/cable is at fault, not the computer.' : 'Force a restart (hold power 15–20 s) and try plugging it in.',
          'Turn brightness all the way up and check any sleep/hybernate state.',
          'Don’t press on the screen or flex the device.',
        ],
        stopIf: ['the screen is leaking, spreading dark patches or hot', 'there are glass shards'],
        because: because.length ? because : ['The device is running, so the display path is the likely culprit.'],
        kbQuery: 'screen not working',
      };
    },
  },

  /* ------------------------------------------------------------------ cracked / touch */
  cracked: {
    id: 'cracked',
    title: 'Cracked screen / touch',
    intro: () => 'Cracks come in two kinds — glass only, or glass plus display — and that decides the repair.',
    questions: [
      {
        id: 'display',
        recap: 'what the display shows under the cracks',
        ask: () => 'Under the cracks, do you see **lines, black spots, colour patches or leaking ink**?',
        expert: () => 'DIAG // Panel artefacts (lines/spots/bleed)?',
        opts: [
          { label: 'Yes, display is damaged', test: /\b(yes|yeah|yep|yup|lines?|spots?|patch(es)?|leak\w*|ink|bleed\w*|colou?rs?|black|green|purple|pink|dead pixels?|flicker\w*|damaged)\b/i, val: 'panel' },
          { label: 'No, picture is clean', test: no, val: 'glass' },
        ],
      },
      {
        id: 'touch',
        recap: 'touch response',
        ask: () => 'Does **touch still respond** everywhere (including near the cracks)?',
        expert: () => 'DIAG // Touch response intact?',
        opts: [
          { label: 'Yes, works fine', test: yes, val: 'ok' },
          { label: 'Partly / ghost touches', test: /\b(partly|partial\w*|some|ghost|random|jump\w*|dead (zone|spot)|only)\b/, val: 'partial' },
          { label: 'No touch at all', test: no, val: 'dead' },
        ],
      },
    ],
    conclude: (a) => {
      const panel = a.display === 'panel' || a.touch === 'dead' || a.touch === 'partial';
      return {
        causes: panel
          ? [
              { name: 'Damaged display / digitizer assembly (needs a full screen replacement)', why: 'Lines, patches or lost touch mean the layers under the glass are damaged, not just the surface.' },
              { name: 'Cracked glass with a damaged connector', why: 'An impact can also loosen the connector even when the panel is fine.' },
            ]
          : [
              { name: 'Cracked glass only', why: 'A clean picture and working touch suggest only the top layer is damaged — but cracks spread, so don’t wait long.' },
              { name: 'Hidden panel damage that appears later', why: 'Moisture and pressure through cracks often cause lines within days.' },
            ],
        tryNow: [
          'Cover it with **clear tape or a screen protector** to hold the glass and protect your fingers.',
          'Back up photos and files while touch still works.',
          'Avoid pressing on the cracks and keep it dry.',
        ],
        stopIf: ['glass is lifting or sharp', 'the display is spreading ink-like patches', 'it gets warm near the crack'],
        because: [panel ? 'Display artefacts or touch loss mean the damage goes below the glass.' : 'A clean picture with normal touch suggests damage is limited to the glass.'],
        kbQuery: 'screen replacement',
      };
    },
  },

  /* ------------------------------------------------------------------ battery */
  battery: {
    id: 'battery',
    title: 'Battery problem',
    intro: () => 'Batteries wear out predictably — but a swollen one is a safety issue, so I’ll check that first.',
    questions: [
      {
        id: 'swollen',
        recap: 'swelling',
        ask: (c) => `First, safety: is the ${c.noun}’s **back or case bulging, or the screen lifting** away from the frame?`,
        expert: () => 'SAFETY // Swelling: back bulging or screen lifting?',
        opts: [
          { label: 'Yes, it’s swollen', test: yes, val: 'yes' },
          { label: 'No, looks normal', test: no, val: 'no' },
        ],
      },
      {
        id: 'drain',
        recap: 'how it drains',
        ask: () => 'How does the battery behave?',
        expert: () => 'DIAG // Drain pattern?',
        skip: (a) => a.swollen === 'yes',
        opts: [
          { label: 'Dies within a few hours', test: /\b(hours?|fast|quick\w*|drain\w*|dies)\b/, val: 'fast' },
          { label: 'Jumps or shuts off at 20–30%', test: /\b(jump\w*|shut\w*|turns? off|20|30|suddenly|percent\w*)\b/, val: 'jumpy' },
          { label: 'Fine, but old', test: /\b(old|years?|ages|worn|age)\b/, val: 'old' },
        ],
      },
    ],
    conclude: (a) => {
      if (a.swollen === 'yes') {
        return {
          urgent: 'A swollen battery can **catch fire**. Stop using and charging it now.',
          causes: [{ name: 'Swollen (failing) lithium battery', why: 'Gas builds up inside as the cells fail; it will not get better and can be dangerous.' }],
          tryNow: ['Switch it off and **unplug it**; don’t charge it again.', 'Keep it away from heat and flammable things — not on a bed or sofa.', 'Don’t press on it, puncture it or try to open it.', 'Bring it in so the battery can be replaced safely.'],
          stopIf: ['you smell chemicals or see smoke (move away and call emergency services)'],
          because: ['Swelling is a safety sign and overrides every other explanation.'],
          kbQuery: 'battery',
        };
      }
      return {
        causes: [
          { name: 'Worn-out battery (the most common cause)', why: 'Lithium batteries lose capacity with every cycle — after roughly 2–3 years the loss is noticeable.' },
          { name: 'A background app draining power', why: 'One misbehaving app can empty a healthy battery.' },
          ...(a.drain === 'jumpy' ? [{ name: 'Battery that can’t deliver power under load', why: 'Sudden drops from 30% to off mean the cells can’t keep voltage up.' }] : []),
        ].slice(0, 3),
        tryNow: ['Check **battery health / usage** in Settings to see the worst app.', 'Lower screen brightness and turn off background refresh.', 'Avoid leaving it at 0% or at 100% on charge for days.'],
        stopIf: ['it gets hot while idle', 'the case starts to bulge'],
        because: ['No swelling, so this is about wear and usage rather than safety.'],
        kbQuery: 'battery replacement',
      };
    },
  },

  /* ------------------------------------------------------------------ liquid */
  water: {
    id: 'water',
    title: 'Liquid damage',
    intro: () => 'Liquid is time-critical — what you do in the next minutes matters most.',
    questions: [
      {
        id: 'on',
        recap: 'power state when it got wet',
        ask: () => 'Was it **switched on or charging** when the liquid got in?',
        expert: () => 'DIAG // Powered at time of exposure?',
        opts: [
          { label: 'Yes, it was on', test: yes, val: 'on' },
          { label: 'No, it was off', test: no, val: 'off' },
        ],
      },
      {
        id: 'time',
        recap: 'how long ago',
        ask: () => 'How long ago was it, and what was the liquid (water, tea/coffee/juice, salt water)?',
        expert: () => 'DIAG // Elapsed time + liquid type?',
        opts: [
          { label: 'Just now (minutes)', test: /\b(just|now|minutes?|few min\w*|moment\w*|seconds?)\b/, val: 'now' },
          { label: 'Hours ago', test: /\b(hours?|today|tonight|morning|afternoon)\b/, val: 'hours' },
          { label: 'Days ago', test: /\b(days?|week\w*|yesterday|month\w*)\b/, val: 'days' },
        ],
      },
    ],
    conclude: (a) => ({
      urgent: 'Don’t power it on or charge it — **short-circuits and corrosion start immediately**.',
      causes: [
        { name: 'Moisture on the board (corrosion risk rises by the hour)', why: 'Liquid conducts electricity and leaves residue that eats the circuitry — sugary drinks and salt water are worst.' },
        ...(a.on === 'on' ? [{ name: 'A short circuit that may already have damaged components', why: 'Being powered when wet is what causes most permanent damage.' }] : []),
      ],
      tryNow: [
        'Switch it **off**, unplug everything and **don’t charge** it.',
        'Remove the case, SIM tray and memory card if you can; dry the outside with a cloth.',
        'Keep it upright in a dry place with some airflow.',
        '**Don’t** use a hair dryer, oven or rice — heat can warp parts and rice does not draw out liquid.',
        'Bring it in as soon as possible so it can be opened and cleaned.',
      ],
      stopIf: ['it is hot or smells burnt', 'the liquid was salt water or a sugary drink (corrosion is faster — hurry)'],
      because: [a.time === 'days' ? 'Time since exposure matters: after days, corrosion is likely already underway.' : 'Quick action gives the best odds, so the advice is about stopping any current flow and getting it cleaned.'],
      kbQuery: 'water damage',
    }),
  },

  /* ------------------------------------------------------------------ connectivity */
  wifi: {
    id: 'wifi',
    title: 'Connection problem',
    intro: () => 'First question is always: is it this device, or the network?',
    questions: [
      {
        id: 'others',
        recap: 'whether other devices have the problem',
        ask: () => 'Do **other devices** have the same problem on the same network?',
        expert: () => 'DIAG // Other devices affected?',
        opts: [
          { label: 'Yes, all devices', test: yes, val: 'network' },
          { label: 'No, only this one', test: no, val: 'device' },
        ],
      },
      {
        id: 'which',
        recap: 'what is failing',
        ask: () => 'What exactly is failing?',
        expert: () => 'DIAG // Failing radio: wifi / bluetooth / mobile data?',
        opts: [
          { label: 'Wi-Fi', test: /\b(wi-?fi|wireless|internet|router)\b/, val: 'wifi' },
          { label: 'Bluetooth', test: /\b(bluetooth|bt|earbuds|headphones|pair\w*)\b/, val: 'bt' },
          { label: 'Mobile data / SIM', test: /\b(data|sim|signal|network|mobile|calls?)\b/, val: 'mobile' },
        ],
      },
    ],
    conclude: (a) => ({
      causes: a.others === 'network'
        ? [
            { name: 'Router or internet provider problem', why: 'If every device struggles, the fault is upstream of your device.' },
            { name: 'Interference or congestion', why: 'Crowded channels and distance cause drops.' },
          ]
        : [
            { name: 'Software/network settings on this device', why: 'Saved-network glitches are the usual cause when only one device is affected.' },
            { name: 'Failing Wi-Fi/Bluetooth antenna or module (hardware)', why: 'If resets don’t help, the radio itself may be at fault — often after drops or liquid.' },
          ],
      tryNow: a.others === 'network'
        ? ['Restart the router (unplug 30 s) and the device.', 'Move closer and try again; check whether the provider has an outage.']
        : ['Toggle Airplane mode, then **forget the network** and reconnect.', 'Restart, then **reset network settings**.', 'Install pending system updates.'],
      stopIf: ['it worked until a drop or liquid exposure', 'nothing helps after a network reset'],
      because: [a.others === 'network' ? 'Several devices fail the same way, which points to the network.' : 'Only this device fails, so I focused on its settings and radio.'],
      kbQuery: 'wifi',
    }),
  },

  /* ------------------------------------------------------------------ noises */
  noise: {
    id: 'noise',
    title: 'Strange noises',
    intro: () => 'Different sounds point at different parts — which one are you hearing?',
    questions: [
      {
        id: 'kind',
        recap: 'the kind of sound',
        ask: () => 'What does it sound like?',
        expert: () => 'DIAG // Sound class?',
        opts: [
          { label: 'Clicking or grinding', test: /\b(click\w*|grind\w*|tick\w*|scrap\w*|knock\w*)\b/, val: 'drive' },
          { label: 'Beeping', test: /\b(beep\w*|chirp\w*)\b/, val: 'beep' },
          { label: 'Loud fan / rattle', test: /\b(fan|rattl\w*|loud|spin\w*|whirr\w*|jet)\b/, val: 'fan' },
          { label: 'Buzz or whine', test: /\b(buzz\w*|whin\w*|hum\w*|coil|squeal\w*|high.?pitch\w*)\b/, val: 'buzz' },
        ],
      },
    ],
    conclude: (a) => {
      const map: Record<string, Conclusion> = {
        drive: {
          urgent: 'Clicking or grinding from a hard drive is a **failure warning** — back up now if you can.',
          causes: [{ name: 'Failing hard drive', why: 'Repeated clicking is the drive’s heads failing to read; it usually gets worse quickly.' }, { name: 'Loose fan blade or debris', why: 'Less likely, but easy to check.' }],
          tryNow: ['Copy important files to another drive **now**.', 'Don’t keep restarting it — each start can damage the platters further.', 'Bring it in for data recovery if files matter.'],
          stopIf: ['the sound is constant and the files matter (stop using it)'],
          because: ['Mechanical clicking/grinding is characteristic of a failing drive, and that’s a data-loss risk.'],
        },
        beep: {
          causes: [{ name: 'Start-up error code (memory or graphics not detected)', why: 'Computers beep patterns on start to report faults like RAM or GPU not seated.' }, { name: 'A notification or alarm from an app', why: 'On phones, repeating beeps are usually an app or alarm.' }],
          tryNow: ['Count the beeps and note the pattern (the maker’s manual lists the meaning).', 'Power off, unplug, and **reseat the RAM** if you’re comfortable opening it.', 'Try with one RAM stick at a time.'],
          stopIf: ['you’re not comfortable opening it', 'beeping continues after reseating'],
          because: ['Beep patterns are standard power-on diagnostics, most often memory.'],
        },
        fan: {
          causes: [{ name: 'Dust-clogged fan and vents', why: 'Dust adds drag and noise and cuts airflow.' }, { name: 'Failing fan bearing or dried thermal paste', why: 'An old fan whines or rattles; dried paste makes it spin harder.' }],
          tryNow: ['Use it on a hard surface and clear the vents with short bursts of air.', 'Check for a process pinning the CPU.'],
          stopIf: ['it also overheats or shuts down', 'the rattle is a loose part'],
          because: ['Fan noise nearly always means more heat than the cooling can handle — dust or age.'],
          kbQuery: 'overheating',
        },
        buzz: {
          causes: [{ name: 'Charger or adapter coil whine', why: 'Many chargers whine under load; usually harmless.' }, { name: 'Damaged speaker or loose component', why: 'A speaker with debris or a loose part rattles or buzzes.' }],
          tryNow: ['Try another charger/cable.', 'Check whether the buzz follows the volume (speaker) or the charger.'],
          stopIf: ['the noise comes with heat or a burning smell'],
          because: ['Buzzing or whining is usually electrical (charger) or a speaker.'],
        },
      };
      return map[a.kind] || map.fan;
    },
  },

  /* ------------------------------------------------------------------ storage */
  storage: {
    id: 'storage',
    title: 'Storage full',
    intro: () => 'Full storage is the easiest slowdown to fix — and often needs no repair at all.',
    questions: [
      {
        id: 'what',
        recap: 'what is using the space',
        ask: () => 'What do you think is taking the space?',
        expert: () => 'DIAG // Primary storage consumer?',
        opts: [
          { label: 'Photos & videos', test: /\b(photo\w*|picture\w*|video\w*|camera|gallery|media)\b/, val: 'media' },
          { label: 'Apps & games', test: /\b(app\w*|game\w*|program\w*|software)\b/, val: 'apps' },
          { label: 'No idea', test: /\b(dont know|not sure|no idea|idk|unknown|what)\b/, val: 'unknown' },
        ],
      },
    ],
    conclude: (a, c) => ({
      causes: [
        { name: a.what === 'media' ? 'Photos and videos' : a.what === 'apps' ? 'Large apps and games' : 'Cached files, downloads and old backups', why: 'These are the biggest users of space on most devices.' },
        { name: 'Cache and “other” data', why: 'Apps quietly store temporary files that add up.' },
      ],
      tryNow: [
        c.isComputer ? 'Open **Settings → Storage** to see what is using space, then clear Downloads and temporary files.' : 'Open **Settings → Storage** to see the biggest apps and files.',
        'Move photos/videos to cloud storage or a computer, then delete them from the device.',
        'Uninstall apps you haven’t opened in months.',
        'If it’s still always full, a **bigger drive or an SSD upgrade** (computers) is the lasting fix.',
      ],
      stopIf: ['the device freezes with errors even after freeing space'],
      because: ['Space problems are almost always about what you’ve stored, not a faulty device.'],
      kbQuery: 'slow computer',
    }),
  },

  /* ------------------------------------------------------------------ audio */
  audio: {
    id: 'audio',
    title: 'Sound problem',
    intro: () => 'Sound problems are split by which direction is failing — hearing, speaking, or both.',
    questions: [
      {
        id: 'part',
        recap: 'which sound path',
        ask: () => 'What exactly isn’t working?',
        expert: () => 'DIAG // Audio path: output / input / headphones?',
        opts: [
          { label: 'I can’t hear (speaker)', test: /\b(hear|speaker|sound|volume|quiet|music|crackl\w*|muffl\w*)\b/, val: 'speaker' },
          { label: 'Others can’t hear me (mic)', test: /\b(mic\w*|they|others|cant hear me|calls?|voice)\b/, val: 'mic' },
          { label: 'Headphones / jack', test: /\b(headphone\w*|earphone\w*|earbud\w*|jack|aux|bluetooth)\b/, val: 'phones' },
        ],
      },
    ],
    conclude: (a) => ({
      causes:
        a.part === 'mic'
          ? [{ name: 'Blocked microphone port or a permission/setting issue', why: 'Dust, a case or a mic muted in an app is the most common cause.' }, { name: 'Faulty microphone hardware', why: 'If it fails in every app, the mic itself may be damaged.' }]
          : a.part === 'phones'
          ? [{ name: 'Debris or damage in the audio jack / port', why: 'Lint stops the plug seating; the jack can also wear.' }, { name: 'The headphones themselves', why: 'Test them on another device first.' }]
          : [{ name: 'Muted / wrong output selected', why: 'The most common “no sound” cause by far.' }, { name: 'Clogged or blown speaker', why: 'Dust, moisture or past volume abuse cause muffled or crackling sound.' }],
      tryNow: ['Check volume, mute and the **selected output** (speaker vs Bluetooth).', 'Restart the device, then test in two different apps.', 'Gently clean the opening with a dry soft brush (no liquids, no pins).'],
      stopIf: ['sound cuts out after liquid or a drop'],
      because: ['I split it by which sound path fails — settings first, then hardware.'],
      kbQuery: 'speaker',
    }),
  },
};

export const DEVICE_CHOICES = [
  { label: 'Phone', val: 'phone' as const, test: /\b(phone|iphone|android|mobile|smartphone|samsung|tecno|infinix|itel|redmi|xiaomi)\b/ },
  { label: 'Laptop', val: 'laptop' as const, test: /\b(laptop|notebook|macbook|chromebook)\b/ },
  { label: 'Desktop PC', val: 'desktop' as const, test: /\b(desktop|tower|pc|computer|gaming pc)\b/ },
  { label: 'Tablet', val: 'tablet' as const, test: /\b(tablet|ipad|tab)\b/ },
];
