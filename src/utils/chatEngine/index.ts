// src/utils/chatEngine/index.ts
//
// Orchestrator. Pipeline (first match wins):
//
//   1. safety / policy gate
//   2. site commands       ("show me your projects", "open services", "book a repair", theme...)
//   3. system handlers     (time, status, reset) + calculator (exact maths, never guessed)
//   4. small talk          ("sup", "m good", thanks, jokes, names...)
//   5. follow-ups          (bare "yes"/"ok" continue the current topic)
//   6. gibberish filter
//   7. LANGUAGE MODEL      (on-device WebLLM, or your self-hosted endpoint) grounded with
//                          knowledge-base facts + optional web context
//   8. no model running -> retriever answer -> web lookup -> smart fallback
//
// Steps 1-6 are instant and deterministic. Step 7 is what makes it ChatGPT-like.

import {
  EngineOptions,
  KnowledgeHit,
  PersonaMode,
  ProcessingResult,
  ResponseSource,
  SessionMemory,
  SiteCommand,
  SystemAction,
  TopicDomain,
  ChatCard,
} from './types';
import { evaluateInputSafety } from './evaluator';
import { detectMultiCommand, detectSiteCommand } from './siteCommands';
import { detectNavigation, navReply } from './navigation';
import { tryRecap, tryTour } from './tour';
import { handleSystemQuery } from './systemHandlers';
import { handleSmallTalk, isAffirmative, isNegative, FOLLOW_UP_PROMPTS } from './smalltalk';
import { isGibberish, logUnanswered } from './learningEngine';
import { searchKnowledge } from './retriever';
import { searchWeb, looksLikeLookup, needsLiveData } from './webSearch';
import { tryCalculate, formatNumber } from './calc';
import { tryMathPlus } from './mathPlus';
import { cleanInput, sanitizeMemory } from './sanitize';
import { normalizeSlang } from './slang';
import { tryDates } from './dates';
import { tryCompare } from './compare';
import { termReply, tryGlossary } from './glossary';
import { buildMessages } from './promptBuilder';
import { generateLocal, isLocalLLMReady, labelForModel, getLLMState } from './localLLM';
import { generateRemote, isRemoteLLMConfigured } from './remoteLLM';
import { FALLBACK_SUGGESTIONS } from './siteConfig';
import { normalize, tokens, truncate } from './text';
import { buildFileReply, fileQuestion, handoffIntent, handoffReply } from './fileInsights';
import {
  DialogueOutput,
  answerChip,
  handoffNoteFor,
  lastFromResult,
  noteOffTopic,
  observe,
  readState,
  runDialogue,
  withState,
} from './dialogue';
import { getActiveKnowledgeBase } from './knowledgeBase';
import { personaReply, tryPersona } from './persona';
import { reasonReply, rewriteNegation, stripLead, tryReason } from './reasoner';

export function isAIAvailable(): boolean {
  return isLocalLLMReady() || isRemoteLLMConfigured();
}

function aiLabel(): string {
  if (isLocalLLMReady()) return `ON-DEVICE (${labelForModel(getLLMState().modelId)})`;
  if (isRemoteLLMConfigured()) return 'SELF-HOSTED';
  return 'OFF (rules + search)';
}

function finish(
  memory: SessionMemory,
  input: string,
  reply: string,
  source: ResponseSource,
  extra: {
    topic?: TopicDomain | string;
    learn?: Record<string, any>;
    imageUrl?: string;
    suggestions?: string[];
    action?: SystemAction;
    command?: SiteCommand;
    queuedCommands?: SiteCommand[];
    matchedEntryId?: string;
    handoff?: boolean;
    handoffNote?: string;
    guided?: boolean;
    trace?: string[];
    fileHandled?: boolean;
    cards?: ChatCard[];
  } = {}
): ProcessingResult {
  return {
    cards: extra.cards && extra.cards.length ? extra.cards : undefined,
    reply,
    source,
    imageUrl: extra.imageUrl,
    suggestions: extra.suggestions,
    action: extra.action,
    command: extra.command,
    queuedCommands: extra.queuedCommands && extra.queuedCommands.length ? extra.queuedCommands : undefined,
    matchedEntryId: extra.matchedEntryId,
    handoff: extra.handoff,
    handoffNote: extra.handoffNote,
    guided: extra.guided,
    trace: extra.trace,
    fileHandled: extra.fileHandled,
    updatedMemory: {
      ...memory,
      interactionCount: memory.interactionCount + 1,
      lastTopic: extra.topic ?? memory.lastTopic,
      userContext: {
        ...memory.userContext,
        // A reply that is not a miss resets the "couldn't answer" streak.
        ...(memory.userContext?.missStreak && !(extra.learn && 'missStreak' in extra.learn) ? { missStreak: 0 } : {}),
        ...(extra.learn || {}),
      },
      conversationHistory: [
        ...memory.conversationHistory,
        { role: 'user' as const, text: input },
        { role: 'assistant' as const, text: reply },
      ].slice(-24),
    },
  };
}

/** Paraphrase hints so retrieval understands vague wording. */
function expandQuery(q: string, lastTopic: string): string {
  let out = q;
  // "what do you charge" is about prices, not about a phone that won't charge.
  out = out.replace(/\b(do|does|would|will|did) (you|u|they|he|she) charge\b/gi, '$1 $2 price').replace(/\bcharge (me|for|per)\b/gi, 'price $1');
  // Only treat "how much" as a price question when nothing else in the sentence says what it is about
  // ("how much ram do I need" must stay a RAM question).
  if (/\bhow much (for|to|is|does|would|will)\b/i.test(out) || (/\bhow much\b/i.test(out) && tokens(out).length === 0)) {
    out += ' price cost';
  }
  // Very short follow-ups inherit the topic they follow ("what about screens?")
  if (tokens(out).length <= 1) {
    const hint: Record<string, string> = {
      HARDWARE_REPAIR: 'repair',
      DESIGN_BRANDING: 'design',
      WEB_DEV: 'website',
      PRICING_RATES: 'price',
    };
    if (hint[lastTopic]) out += ' ' + hint[lastTopic];
  }
  return out;
}

function trimToSentences(text: string, max = 650): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > 200 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…');
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

async function route(
  input: string,
  mode: PersonaMode,
  memory: SessionMemory,
  options: EngineOptions = {}
): Promise<ProcessingResult> {
  // Texting-style words are spelled out first ("hw mch for scren repar" -> "how much for screen repair") so every
  // step below, including the safety check, sees plain language.
  // Filler in front of a question ("ok and how long?") is dropped, and "I don't want a website, just a logo" becomes
  // the request it really is, so nothing below mistakes the opposite for what was asked.
  const raw = rewriteNegation(stripLead(normalizeSlang(input.trim()).text)).text;
  const q = normalize(raw);
  const wordCount = q ? q.split(' ').length : 0;
  const name = memory.userContext?.name as string | undefined;

  // 0. Remember what the visitor says (device, brand, problem, project, urgency, mood) so replies can be
  //    specific and the guided dialogue can pick up where it left off. -------------------------------
  const dlg = observe(readState(memory), raw);
  memory = withState(memory, dlg);
  const dlgHooks = { name, entryById: (id: string) => getActiveKnowledgeBase().find((e) => e.id === id) };
  const fromDialogue = (d: DialogueOutput): ProcessingResult => {
    const image = d.imageQuery ? searchKnowledge(d.imageQuery, 1)[0]?.entry.image : undefined;
    return finish(withState(memory, d.state), raw, d.reply, 'rules', {
      topic: d.topic,
      suggestions: d.suggestions,
      imageUrl: image,
      handoff: d.handoff,
      handoffNote: d.handoffNote,
      guided: true,
      trace: d.trace,
    });
  };

  // 1. Safety --------------------------------------------------------------
  const safety = evaluateInputSafety(raw, mode);
  if (!safety.isSafe) {
    return finish(memory, raw, safety.safeReply || 'Request blocked by policy.', 'safety');
  }

  // 1b. "Send this to the owner": opens the hand-off card in the widget. Nothing is sent from here;
  //     the visitor reviews and confirms in the card. Decided only from what the visitor typed.
  const files = options.files || [];
  const hasFiles = files.length > 0;
  if (handoffIntent(raw, hasFiles)) {
    return finish(memory, raw, handoffReply(mode, hasFiles), 'system', {
      topic: 'SYSTEM',
      handoff: true,
      handoffNote: [handoffNoteFor(dlg), memory.userContext?.budget ? `Budget: ${memory.userContext.budget}` : ''].filter(Boolean).join('\n'),
      fileHandled: true,
    });
  }

  // 1c. A button of the current guided question ("Laptop", "Not sure", "ASAP") answers it directly,
  //     before site commands, so a button like "Website" is never mistaken for navigation.
  const chip = answerChip(raw, mode, dlg);
  if (chip) return fromDialogue(chip);

  // 1d. Guided site tour ("give me a tour" -> "Next stop") and a recap of the conversation so far.
  const tour = tryTour(raw, mode, memory) || tryRecap(raw, mode, memory, dlg.ent);
  if (tour) {
    return finish(memory, raw, mode === 'EXPERT' ? tour.expert : tour.human, 'system', {
      topic: 'SYSTEM',
      command: tour.command,
      suggestions: tour.suggestions,
      learn: tour.learn,
    });
  }

  // 2. Site commands: the chat can drive the whole site ("show branding projects", "open
  //    services", "book a repair", "go amber"). Deterministic and decided ONLY from what the
  //    visitor typed — language-model output can never trigger one. -------------------------
  // 2a. Two requests in one message ("show branding projects and then book a repair"): only when BOTH
  //     halves are clear site commands, so ordinary sentences containing "and" are never split.
  const multi = detectMultiCommand(raw, options.pathname, options.projects);
  if (multi) {
    return finish(memory, raw, mode === 'EXPERT' ? multi.expert : multi.human, 'system', {
      topic: 'SYSTEM',
      command: multi.commands[0],
      queuedCommands: multi.commands.slice(1),
      suggestions: multi.suggestions,
    });
  }
  const detected = detectSiteCommand(raw, { pathname: options.pathname, projects: options.projects });
  if (detected) {
    return finish(memory, raw, mode === 'EXPERT' ? detected.expert : detected.human, 'system', {
      topic: 'SYSTEM',
      command: detected.command,
      suggestions: detected.suggestions,
    });
  }

  // 2a-. Wider page-name matching (pricing, rates, work, ...). Decided only from the visitor's own words.
  //      Questions that merely mention a page are NOT intercepted here; they get a normal answer plus an
  //      "Open ... →" button (see processChatQuery).
  const loose = detectNavigation(raw, options.projects ?? []);
  if (loose && loose.kind === 'go' && loose.target) {
    const nr = navReply(loose, mode, options.pathname || '');
    return finish(memory, raw, nr.reply, 'system', {
      topic: 'SYSTEM',
      command: { type: 'navigate', path: loose.target.path, label: loose.target.label.toUpperCase() },
      suggestions: nr.suggestions,
    });
  }

  // 2b. Questions about shared files. Without an AI model the answer is built from the local analysis;
  //     with one, the normal LLM step below receives the file text as (untrusted) context.
  const fileTurn = hasFiles && (fileQuestion(raw) || (!!options.filesAreNew && wordCount <= 6));
  // File text is only ever given to the ON-DEVICE model; a self-hosted remote endpoint never receives it.
  if (fileTurn && !isLocalLLMReady()) {
    const fr = buildFileReply(files, raw, mode, !!options.filesAreNew);
    return finish(memory, raw || '[shared files]', fr.reply, 'system', { topic: 'SYSTEM', suggestions: fr.suggestions, fileHandled: true });
  }

  // 3. System handlers -----------------------------------------------------
  const sys = handleSystemQuery(raw, mode, aiLabel());
  if (sys) {
    return finish(memory, raw, sys.reply, 'system', { topic: 'SYSTEM', action: sys.action });
  }

  // 3b. Calculator ---------------------------------------------------------
  const calc = tryCalculate(raw);
  if (calc) {
    const result = Number.isFinite(calc.value) ? formatNumber(calc.value) : null;
    const reply = result
      ? mode === 'EXPERT'
        ? `CALC // ${calc.expr} = ${result}`
        : `${calc.expr} = **${result}** 🧮`
      : mode === 'EXPERT'
      ? 'CALC // Undefined result (division by zero or overflow).'
      : "That one's undefined (dividing by zero breaks maths) 😄 Try another calculation?";
    return finish(memory, raw, reply, 'system', {
      topic: 'GENERAL_QA',
      learn: result ? { lastNum: calc.value } : undefined,
      suggestions: result ? ['And 20% of that', 'Times 2', 'Convert 5 km to miles'] : undefined,
    });
  }

  // 3b+. Everything numeric the basic calculator declines: units ("72 f to c", "3 gb in mb"), tips and
  //      discounts, percentages, roots and powers, lists, and follow-ups on the last result.
  const lastNum = typeof memory.userContext?.lastNum === 'number' ? (memory.userContext.lastNum as number) : undefined;
  const mp = tryMathPlus(raw, lastNum);
  if (mp) {
    return finish(memory, raw, mode === 'EXPERT' ? mp.expert : mp.human, 'system', {
      topic: 'GENERAL_QA',
      learn: mp.value !== undefined ? { lastNum: mp.value } : undefined,
      suggestions: mp.suggestions,
    });
  }

  // 3b++. Exact answers that need no model: date maths ("days until Christmas"), "X vs Y" comparisons and
  //       plain-English definitions ("define latency", "explain DNS like I'm five").
  const dateAns = tryDates(raw);
  if (dateAns) {
    return finish(memory, raw, mode === 'EXPERT' ? dateAns.expert : dateAns.human, 'system', { topic: 'GENERAL_QA', suggestions: dateAns.suggestions });
  }
  const cmp = tryCompare(raw);
  if (cmp) {
    return finish(memory, raw, mode === 'EXPERT' ? cmp.expert : cmp.human, 'knowledge', { topic: 'GENERAL_QA', suggestions: cmp.suggestions });
  }
  const gloss = tryGlossary(raw);
  if (gloss) {
    const g = termReply(gloss);
    return finish(memory, raw, mode === 'EXPERT' ? g.expert : g.human, 'knowledge', { topic: 'GENERAL_QA', suggestions: g.suggestions });
  }

  // 3c-. Reasoning: what clues mean ("it charges on another cable"), date estimates, several questions at
  //      once, recommendations, vague problems and plain statements. Deterministic; no model needed. -----
  const reasoned = tryReason(raw, { memory, dlg, mode });
  if (reasoned) {
    return finish(reasoned.last ? withState(memory, { ...dlg, last: reasoned.last }) : memory, raw, reasonReply(reasoned, mode), 'rules', {
      topic: reasoned.keepTopic ? memory.lastTopic : reasoned.topic ?? 'GENERAL_QA',
      suggestions: reasoned.suggestions,
      trace: reasoned.trace,
      learn: reasoned.learn,
      command: reasoned.command,
      cards: reasoned.cards,
    });
  }

  // 3c. Guided dialogue: multi-turn diagnosis, project briefs, repair-or-replace, quotes and follow-ups
  //     ("why?", "what if that doesn't work?", "how long?"). Works with no AI model at all. ------------
  if (dlg.flow && wordCount <= 4 && /^(hi|hello|hey|yo|thanks|thank you|thx|cheers|lol|haha|nice|cool|great|awesome)\b/.test(q)) {
    const chat = handleSmallTalk(raw, mode, name);
    if (chat) {
      const off = noteOffTopic(dlg);
      const resume =
        mode === 'EXPERT' ? '\nFLOW // Paused. "continue" to resume.' : '\n\n(We’re partway through something — say **continue** to pick it back up.)';
      return finish(withState(memory, off.state), raw, chat.reply + resume, 'rules', {
        topic: memory.lastTopic,
        suggestions: ['Continue', 'Cancel'],
        learn: chat.learn,
      });
    }
  }
  const guided = runDialogue(raw, mode, dlg, dlgHooks);
  if (guided) return fromDialogue(guided);

  // 3d. Talks like a person: recall ("what did I just ask?"), questions about the bot and privacy, feelings,
  //     budgets and "can you fix a PS5?"-style scope questions. Deterministic and honest; no model needed. -----
  const persona = tryPersona(raw, memory);
  if (persona) {
    return finish(memory, raw, personaReply(persona, mode), 'rules', {
      topic: persona.keepTopic ? memory.lastTopic : persona.topic ?? 'GENERAL_QA',
      suggestions: persona.suggestions,
      learn: persona.learn,
    });
  }

  // 4. Small talk ----------------------------------------------------------
  const talk = handleSmallTalk(raw, mode, name);
  if (talk) {
    return finish(memory, raw, talk.reply, 'rules', {
      topic: talk.keepTopic ? memory.lastTopic : talk.topic,
      learn: talk.learn,
      suggestions: talk.suggestions,
    });
  }

  // 5. Bare yes / no -------------------------------------------------------
  if (isAffirmative(q)) {
    const fu = FOLLOW_UP_PROMPTS[memory.lastTopic as string];
    if (fu) {
      return finish(memory, raw, mode === 'EXPERT' ? fu.expert : fu.human, 'rules', { suggestions: fu.suggestions });
    }
    return finish(
      memory,
      raw,
      mode === 'EXPERT' ? 'SYS_PROMPT // Specify domain: [HARDWARE] [DESIGN] [WEB].' : 'Great! What would you like to talk about — a repair, a design, or a website?',
      'rules',
      { suggestions: FALLBACK_SUGGESTIONS }
    );
  }
  if (isNegative(q)) {
    return finish(
      memory,
      raw,
      mode === 'EXPERT' ? 'SYS_ACK // Standing by.' : 'No problem! I\'m here if you need anything else. 😊',
      'rules'
    );
  }

  // 6. Gibberish -----------------------------------------------------------
  if (isGibberish(raw)) {
    return finish(
      memory,
      raw,
      mode === 'EXPERT'
        ? 'SYS_INPUT_ERR // Unparseable character sequence.'
        : "Hmm, I couldn't make sense of that one 😄 Try asking in a sentence — for example \"my laptop won't turn on\" or \"I need a logo\".",
      'rules',
      { suggestions: FALLBACK_SUGGESTIONS }
    );
  }

  // Retrieval is used by both the LLM path (as grounding) and the rules path.
  const hits: KnowledgeHit[] = searchKnowledge(expandQuery(raw, memory.lastTopic as string), 3);
  const best = hits[0];
  const strong = !!best && best.confidence >= 0.5;

  // A plain "what is DNS?" is answered from the glossary unless the knowledge base has a strong answer of its own.
  if (!strong) {
    const bare = tryGlossary(raw, true);
    if (bare) {
      const g = termReply(bare);
      return finish(memory, raw, mode === 'EXPERT' ? g.expert : g.human, 'knowledge', { topic: 'GENERAL_QA', suggestions: g.suggestions });
    }
  }

  // 7. Language model ------------------------------------------------------
  if (isAIAvailable()) {
    let webContext: { title: string; extract: string } | null = null;
    if (!strong && looksLikeLookup(raw)) {
      const web = await withTimeout(searchWeb(raw, mode, options.signal), 2500);
      if (web) webContext = { title: web.title, extract: web.extract };
    }

    const messages = buildMessages({ input: raw, mode, memory, hits, webContext, files: isLocalLLMReady() ? files : [] });
    let partial = '';
    const onToken = (t: string) => {
      partial = t;
      options.onToken?.(t);
    };

    try {
      let text = '';
      let source: ResponseSource = 'local-ai';
      if (isLocalLLMReady()) {
        text = await generateLocal(messages, onToken, options.signal);
      } else {
        source = 'remote-ai';
        text = await generateRemote(messages, onToken, options.signal);
      }

      text = text.replace(/^(assistant|ai)\s*:\s*/i, '').trim();
      if (text.length >= 2) {
        return finish(memory, raw, text, source, {
          topic: best && best.confidence >= 0.4 ? best.entry.domain : 'AI_CHAT',
          suggestions: best && best.confidence >= 0.4 ? best.entry.suggestions : undefined,
          imageUrl: strong ? best?.entry.image : undefined,
          fileHandled: fileTurn,
        });
      }
    } catch (err) {
      if (options.signal?.aborted) {
        return finish(memory, raw, partial.trim() || 'Stopped.', isLocalLLMReady() ? 'local-ai' : 'remote-ai', { topic: 'AI_CHAT' });
      }
      console.warn('LLM generation failed, falling back to rules:', err);
    }
    // fall through to rule-based path
  }

  // The model was unavailable or failed on a file question: answer from the local analysis instead.
  if (fileTurn) {
    const fr = buildFileReply(files, raw, mode, !!options.filesAreNew);
    return finish(memory, raw || '[shared files]', fr.reply, 'system', { topic: 'SYSTEM', suggestions: fr.suggestions, fileHandled: true });
  }

  // 8a. Knowledge base answer ----------------------------------------------
  if (strong && best) {
    return finish(memory, raw, mode === 'EXPERT' ? best.entry.expert : best.entry.reply, 'knowledge', {
      topic: best.entry.domain,
      suggestions: best.entry.suggestions,
      imageUrl: best.entry.image,
      matchedEntryId: best.entry.id,
    });
  }

  // 8b. Web lookup ---------------------------------------------------------
  let lookupFailed = false;
  if (looksLikeLookup(raw)) {
    const web = await searchWeb(raw, mode, options.signal);
    if (web?.blockedReply) {
      return finish(memory, raw, web.blockedReply, 'safety');
    }
    if (web) {
      const body = trimToSentences(web.extract);
      const src = web.url ? `[Wikipedia](${web.url})` : 'Wikipedia';
      const reply =
        mode === 'EXPERT'
          ? `SYS_INTEL_FETCH // "${truncate(raw, 60)}" -> ${web.title}\n\n${body}`
          : `**${web.title}**\n${body}\n\nSource: ${src}${web.fromCache ? ' (saved)' : ''}`;
      return finish(memory, raw, reply, 'web', { topic: 'GENERAL_QA', imageUrl: web.imageUrl });
    }
    lookupFailed = true;
  }

  // Live prices / weather / news / "near me": an encyclopedia can't answer, so say so honestly.
  if (needsLiveData(raw) && !(best && best.confidence >= 0.45)) {
    logUnanswered(raw);
    return finish(
      memory,
      raw,
      mode === 'EXPERT'
        ? 'SYS_SCOPE // Live data (prices, weather, news, local listings) is outside this node. Use a search engine.'
        : "I can't check live info like current prices, weather, news or what's nearby from here — a quick web search will do better for that. I can still help with advice on repairs, design and websites, or take you to the contact section for a quote. 🙂",
      'rules',
      { suggestions: FALLBACK_SUGGESTIONS }
    );
  }

  // 8c. Smart fallback -----------------------------------------------------
  logUnanswered(raw);

  const hintShown = !!memory.userContext?.aiHintShown;
  const canHint = !hintShown && !isAIAvailable() && mode === 'HUMAN';
  const aiHint = canHint
    ? "\n\n💡 Tip: tap **ENABLE AI** at the top of this window and I can chat about almost anything."
    : '';

  if (best && best.confidence >= 0.45) {
    const reply =
      mode === 'EXPERT'
        ? `SYS_PARTIAL_MATCH // Closest module: ${best.entry.title}. ${best.entry.expert}`
        : `Here's the closest thing I know about — **${best.entry.title.toLowerCase()}**:\n\n${best.entry.reply}\n\nIf that's not what you meant, tell me a bit more and I'll narrow it down.${aiHint}`;
    return finish(memory, raw, reply, 'knowledge', {
      topic: best.entry.domain,
      suggestions: best.entry.suggestions,
      imageUrl: best.entry.image,
      matchedEntryId: best.entry.id,
      learn: canHint ? { aiHintShown: true } : undefined,
    });
  }

  const lookedUp = lookupFailed ? "I tried looking that up but couldn't find a reliable answer. " : '';
  // Questions about the BUSINESS itself (prices, discounts, schools, bulk, hours...) that the knowledge base
  // can't answer: say so plainly and offer to ask the owner, instead of a generic menu.
  const aboutBusiness = /\b(your|you)\b.{0,30}\b(shop|business|company|prices?|rates?|discounts?|offers?|clients?|customers?|schools?|bulk|team|staff|experience|years|certified|licensed|insured|branches?|stock|parts?|brands?)\b|\b(do you|can you|are you|will you)\b.{0,40}\b(work with|accept|offer|sell|stock|supply|do|support|handle|take on)\b/i.test(raw);
  if (aboutBusiness && mode !== 'EXPERT') {
    return finish(memory, raw, `${lookedUp}I don't have that detail on hand, and I'd rather not guess about the business. 🙂 The owner can answer it properly. Want me to send your question to them?`, 'rules', {
      suggestions: ['Send my question to the owner', ...FALLBACK_SUGGESTIONS.slice(0, 2)],
    });
  }
  // Don't repeat the same apology: rephrase once, then stop guessing and offer a real person.
  const streak = Number(memory.userContext?.missStreak) || 0;
  const reply =
    mode === 'EXPERT'
      ? `SYS_NO_MATCH // No module matched "${truncate(raw, 60)}"${lookupFailed ? ' (web lookup: no reliable result)' : ''}${streak ? ` (x${streak + 1})` : ''}. Specify: [HARDWARE] [DESIGN] [WEB]${streak ? ' or dispatch to owner.' : '.'}`
      : streak === 0
      ? `${lookedUp}I don't have a good answer for that yet. I can help with **phone/PC repairs**, **design & branding**, and **websites** — or point you to the contact section so you can ask directly.${aiHint}`
      : streak === 1
      ? `Still not sure what you mean — sorry! 🙏 Could you say it another way, or tell me the **device** or **project** it's about? If it's easier, I can pass your question straight to the owner.`
      : `I'm not getting this one right, and I'd rather not keep guessing. 🤝 Want me to send your question to the owner so a real person answers it?`;
  return finish(memory, raw, reply, 'rules', {
    suggestions: streak >= 1 ? ['Send my question to the owner', ...FALLBACK_SUGGESTIONS.slice(0, 2)] : FALLBACK_SUGGESTIONS,
    learn: { missStreak: streak + 1, ...(canHint ? { aiHintShown: true } : {}) },
  });
}

export async function processChatQuery(
  input: string,
  mode: PersonaMode,
  memory: SessionMemory,
  options: EngineOptions = {}
): Promise<ProcessingResult> {
  // Odd, hostile or corrupted input can't slow anything down or break a regex, and memory restored from
  // storage (or an older version of the site) always has the shape the engine expects.
  const safeInput = cleanInput(input);
  const safeMemory = sanitizeMemory(memory);
  let result = await route(safeInput, mode, safeMemory, options);
  // A question that merely mentions a page ("what are your prices?") is answered normally; offer the page as a button.
  if (!result.command && result.source !== 'safety') {
    const hint = detectNavigation(safeInput, options.projects ?? []);
    if (hint?.kind === 'suggest' && hint.target) result = { ...result, nav: { path: hint.target.path, label: hint.target.label } };
  }
  // Bookkeeping for non-guided replies: remember what was just said (so "why?" / "more" / "simpler" can
  // refer to it) and let an unfinished guided flow wait a few turns before it expires.
  if (!result.guided) {
    let st = readState(result.updatedMemory);
    const last = lastFromResult(result.reply, result.source, result.matchedEntryId, result.trace);
    if (last) st = { ...st, last };
    let resumeChip = false;
    if (st.flow && !result.handoff) {
      const off = noteOffTopic(st);
      st = off.state;
      resumeChip = off.resumeChip;
    }
    result = {
      ...result,
      updatedMemory: withState(result.updatedMemory, st),
      suggestions: resumeChip ? [...(result.suggestions || []).slice(0, 3), 'Continue'] : result.suggestions,
    };
  }
  // Files were attached to this message but the reply was about something else (e.g. a repair
  // question with a photo): keep the answer, and quietly note that the file can be forwarded.
  if (options.filesAreNew && (options.files?.length ?? 0) > 0 && !result.fileHandled && result.source !== 'safety') {
    const note =
      mode === 'EXPERT'
        ? '\n\nFILE // Attached file noted. Say "send this to the owner" to forward it.'
        : "\n\n📎 I've noted your file too — say **send this to the owner** and I'll forward it along with your message.";
    return {
      ...result,
      reply: result.reply + note,
      suggestions: ['Send this to the owner', ...(result.suggestions || [])].slice(0, 4),
    };
  }
  return result;
}

export { isLocalLLMReady } from './localLLM';
export type { PersonaMode, SessionMemory, Message, ProcessingResult, SiteCommand } from './types';
