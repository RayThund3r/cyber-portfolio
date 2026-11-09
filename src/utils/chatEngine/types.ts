// src/utils/chatEngine/types.ts

export type PersonaMode = 'HUMAN' | 'EXPERT';

export type TopicDomain =
  | 'GREETINGS'
  | 'SMALLTALK'
  | 'HARDWARE_REPAIR'
  | 'DESIGN_BRANDING'
  | 'WEB_DEV'
  | 'PRICING_RATES'
  | 'CONTACT'
  | 'PORTFOLIO'
  | 'SYSTEM'
  | 'GENERAL_QA'
  | 'AI_CHAT';

/** Where a reply came from. Shown as a small badge in the widget. */
export type ResponseSource =
  | 'rules'
  | 'knowledge'
  | 'web'
  | 'local-ai'
  | 'remote-ai'
  | 'system'
  | 'safety';

/** Site actions the chat can trigger (the widget broadcasts them as a window event). */
export type SystemAction =
  | 'SCROLL_TO_PROJECTS'
  | 'OPEN_CONTACT'
  | 'TOGGLE_THEME'
  | 'RESET_CHAT'
  | 'NONE';

/** A project category as used by the portfolio page filter. */
export type ProjectCategory = 'UI/UX' | 'BRANDING' | 'WEBAPP' | 'HARDWARE';
export type ThemeName = 'cyan' | 'amber' | 'emerald';

/**
 * Things the chat can DO on the site. They are produced only by the deterministic detector in
 * siteCommands.ts from what the VISITOR typed — never from language-model output — so a model
 * (or text it read from the web) can't make the site navigate on its own.
 * `label` is the short tag shown on the chat bubble ("PORTFOLIO · BRANDING").
 */
export type SiteCommand =
  | { type: 'navigate'; path: string; label: string }
  /** Scroll to a section of the HOME page (the executor goes to "/" first when needed). */
  | { type: 'scroll'; id: string; label: string }
  | { type: 'portfolio'; category?: ProjectCategory; query?: string; label: string }
  /** view 'modal' = quick-look popup on the archive page; 'page' = the full deep-dive page. */
  | { type: 'project'; id: string; view: 'modal' | 'page'; label: string }
  | { type: 'contact'; kind?: 'design' | 'repair'; label: string }
  | { type: 'theme'; theme?: ThemeName; label: string }
  | { type: 'top'; label: string }
  | { type: 'bottom'; label: string }
  | { type: 'back'; label: string }
  /** Open the home-page terminal and (optionally) run a command in it. */
  | { type: 'terminal'; cmd?: string; label: string }
  | { type: 'close-chat'; label: string };

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface SessionMemory {
  interactionCount: number;
  lastTopic: TopicDomain | string;
  userContext: Record<string, any>;
  conversationHistory: ConversationTurn[];
}

/** What the assistant learned about a file the visitor shared (computed in the browser). */
export interface FileInsight {
  id: string;
  name: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  /** One-line facts: "CSV · 120 rows · 5 columns". */
  summary: string;
  /** Start of a text file (never set for images/PDFs). Untrusted data. */
  excerpt?: string;
  width?: number;
  height?: number;
}

/** Small, storable description of a file shown on a chat message. */
export interface AttachmentMeta {
  name: string;
  size: number;
  kind: 'image' | 'pdf' | 'text';
  /** Blob URL for image thumbnails; valid only in this tab, so it is dropped before saving. */
  previewUrl?: string;
}

/** A tappable card shown under a reply (e.g. a portfolio project). Tapping it sends `send` as if typed. */
export interface ChatCard {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  badge?: string;
  send: string;
}

export interface Message {
  cards?: ChatCard[];
  id: string;
  /** Milliseconds since epoch (older saved messages may not have it). */
  ts?: number;
  /** UI only: reveal this reply progressively. Never saved. */
  reveal?: boolean;
  /** Answered by the guided dialogue; the widget offers "why?" for these. */
  guided?: boolean;
  /** The reasoning behind a guided answer. */
  trace?: string[];
  /** Set on an error reply: the text to send again when the visitor taps Retry. */
  retryText?: string;
  attachments?: AttachmentMeta[];
  sender: 'user' | 'bot';
  text: string;
  imageUrl?: string;
  time: string;
  source?: ResponseSource;
  streaming?: boolean;
  /** Short tag for a reply that moved/changed the site, e.g. "PORTFOLIO · BRANDING". */
  commandLabel?: string;
  /** Set on replies the visitor can rate; rating teaches the retriever (per browser). */
  learn?: { query: string; entryId: string };
  rated?: 'up' | 'down';
  /** A page the assistant offers ("Open Services →") after answering a question that merely mentioned it. */
  nav?: { path: string; label: string };
}

export interface EngineOptions {
  /** Called with the full text so far while an AI model is streaming. */
  onToken?: (partialText: string) => void;
  signal?: AbortSignal;
  /** The page the visitor is on (usePathname()). Lets "open services" say "you're already here". */
  pathname?: string;
  /** Files the visitor has shared in this conversation (analysed locally). */
  files?: FileInsight[];
  /** True when `files` were attached to THIS message. */
  filesAreNew?: boolean;
  /** Portfolio projects (id/title/category), including ones added in /admin, so "open the logo project" resolves. */
  projects?: { id: string; title: string; category: string }[];
}

export interface ProcessingResult {
  /** Offer a button to open a page (the question was answered normally, not hijacked). */
  nav?: { path: string; label: string };
  /** Tappable cards to show under the reply. */
  cards?: ChatCard[];
  reply: string;
  updatedMemory: SessionMemory;
  imageUrl?: string;
  source: ResponseSource;
  suggestions?: string[];
  action?: SystemAction;
  /** A site command for the widget to execute (navigate, scroll, filter, theme...). */
  command?: SiteCommand;
  /** Further commands from the same message ("show projects and then book a repair"), run in order after `command`. */
  queuedCommands?: SiteCommand[];
  /** The visitor wants to pass something on to the owner: the widget opens its "send to owner" card. */
  handoff?: boolean;
  /** Pre-filled text for the hand-off card (what the visitor and the assistant worked out together). */
  handoffNote?: string;
  /** Answered by the guided dialogue (diagnosis / brief / repair-or-replace / follow-up), not by lookup. */
  guided?: boolean;
  /** 'Why I said that': the reasoning behind a guided answer, shown on request. */
  trace?: string[];
  /** The reply already dealt with the shared file(s). */
  fileHandled?: boolean;
  /** Id of the knowledge entry used for the reply (lets the widget offer 👍/👎 learning). */
  matchedEntryId?: string;
}

export interface KnowledgeEntry {
  id: string;
  domain: TopicDomain;
  title: string;
  keywords: string[];
  /** Plain facts. Used as grounding context for the AI model. */
  content: string;
  /** Ready-made reply for HUMAN mode (used when no AI model is running). */
  reply: string;
  /** Ready-made reply for EXPERT mode. */
  expert: string;
  suggestions?: string[];
  /** Optional picture shown with the reply (restored from the original hot-PC / computers answers). */
  image?: string;
}

export interface KnowledgeHit {
  entry: KnowledgeEntry;
  score: number;
  /** 0..1 — share of the query's (rarity-weighted) terms found in this entry. */
  confidence: number;
}

export interface CachedAnswer {
  query: string;
  extract: string;
  title: string;
  imageUrl?: string;
  timestamp: number;
}

export interface UnansweredItem {
  query: string;
  timestamp: number;
}

/** Legacy shape (original learningEngine). Still exported for compatibility. */
export interface LearnedMemoryItem {
  pattern: string;
  mappedIntent: string;
  timestamp: number;
}

/** A visitor-confirmed link between a phrasing and a knowledge entry. */
export interface LearnedAlias {
  query: string;
  entryId: string;
  /** 1 = "that was helpful", -1 = "that was wrong" */
  polarity: 1 | -1;
  timestamp: number;
}
