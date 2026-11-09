// src/components/chat/chatContent.ts
// Words and static data for the chat UI, kept out of the components so they're easy to edit.

import type { Message, ResponseSource } from '@/utils/chatEngine/types';
import { FALLBACK_SUGGESTIONS } from '@/utils/chatEngine/siteConfig';

export const WELCOME_TEXT =
  "Hey there! 👋 I'm your interactive assistant. Ask me about phone & PC repairs, brand design or web projects — or tell me where to go (\"show me your projects\", \"book a repair\") and I'll take you there.";

export const WELCOME: Message = { id: 'welcome', sender: 'bot', text: WELCOME_TEXT, time: '' };

export const SOURCE_BADGE: Partial<Record<ResponseSource, string>> = {
  'local-ai': 'AI · ON-DEVICE',
  'remote-ai': 'AI',
  knowledge: 'KB',
  web: 'WEB',
};

/** Starter chips that fit the page the visitor is looking at. */
export function startersFor(path: string | null): string[] {
  if (!path || path === '/') return ['My device is not working', 'I need a logo', 'Show me your projects', 'Get a quote'];
  if (path === '/portfolio') return ['Show branding projects', 'Show hardware projects', 'Open services', 'Book a repair'];
  if (path.startsWith('/portfolio/')) return ['Next project', 'Show me your projects', 'I need something similar', 'Book a repair'];
  if (path === '/services') return ['Book a repair', 'How long does a repair take?', 'I need a logo', 'Get a quote'];
  if (path === '/contact') return ['Book a repair', 'I need a design', 'Go home'];
  return FALLBACK_SUGGESTIONS;
}

export const HELP_HUMAN = [
  '**Here’s what I can do** ✨',
  '- **Walk you through a problem** — “my phone won’t charge”, “my laptop is overheating”. I ask a few questions, then rank the likely causes.',
  '- **Scope a project** — “I need a logo” or “build me a website”, and I’ll draft a brief.',
  '- **Help you decide** — “repair or replace my laptop?”',
  '- **Take you anywhere** — “show branding projects”, “open services”, “book a repair”, “go amber”.',
  '- **Give you a tour** — say “give me a tour”, then “next stop”. Or “run neofetch in the terminal”.',
  '- **Play games** — “play chess”, “play sudoku”, or “which game should I play?”.',
  '- **Recap** — “recap” sums up what we have covered so far.',
  '- **Read your files** — tap 📎 or drop a file in. It stays on your device.',
  '- **Pass things to the owner** — say “send this to the owner”; nothing is sent until you press Send.',
  '',
  'Handy shortcuts: type **/** for commands · **Ctrl+K** opens and closes me · say **why?** and I’ll show my reasoning.',
].join('\n');

export const HELP_EXPERT = [
  'HELP //',
  'DIAGNOSE  "my phone won\'t charge" -> guided questions -> ranked causes',
  'BRIEF     "i need a logo" -> parameters -> brief',
  'DECIDE    "repair or replace my laptop"',
  'NAVIGATE  "show branding projects" | "open services" | "go amber"',
  'TOUR      "give me a tour" -> "next stop" | "run neofetch in the terminal" | "recap"',
  'FILES     attach (📎) or drop; parsed locally',
  'DISPATCH  "send this to the owner" (confirm required)',
  'KEYS      "/" commands | Ctrl+K toggle | "why?" reasoning',
].join('\n');

export interface SlashCommand {
  name: string;
  hint: string;
  /** Text sent to the assistant for commands that are really just shortcuts for a question. */
  say?: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help', hint: 'What can you do?' },
  { name: 'projects', hint: 'Show me your projects', say: 'Show me your projects' },
  { name: 'services', hint: 'Open the services page', say: 'Open services' },
  { name: 'contact', hint: 'Book a repair or a design', say: 'Open the contact page' },
  { name: 'quote', hint: 'Start a quote', say: 'Can I get a quote' },
  { name: 'owner', hint: 'Send a message or files to the owner' },
  { name: 'tour', hint: 'A guided tour of the site', say: 'Give me a tour' },
  { name: 'terminal', hint: 'Open the home-page terminal', say: 'Open the terminal' },
  { name: 'recap', hint: 'Summarise our conversation', say: 'Recap' },
  { name: 'theme', hint: 'Switch the colour theme', say: 'Switch theme' },
  { name: 'expert', hint: 'Technical, compact replies' },
  { name: 'human', hint: 'Friendly, conversational replies' },
  { name: 'export', hint: 'Download this conversation' },
  { name: 'clear', hint: 'Start a fresh chat' },
];
