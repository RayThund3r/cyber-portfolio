// src/utils/chatEngine/actions.ts
//
// Lets the chat drive the website ("show me your projects", "contact you", "change theme").
// The widget broadcasts these as a window event AND runs a default scroll behaviour.

import { SystemAction } from './types';
import { normalize } from './text';

export function detectAction(input: string): SystemAction {
  const q = normalize(input);

  if (/\b(show|see|view|open|take me to|go to|scroll to|check out|let me see)\b.*\b(projects?|work|portfolio|archive|case stud(y|ies)|examples? of your work)\b/.test(q) || /^(projects?|portfolio|your work)$/.test(q)) {
    return 'SCROLL_TO_PROJECTS';
  }

  if (
    /\b(open|show|take me to|go to|scroll to)\b.*\bcontact\b/.test(q) ||
    /\b(i want to|i'?d like to|how (do|can) i|let me|i need to|can i) (hire|contact|reach|message|email|book|get in touch)\b/.test(q) ||
    /^(contact|contact you|hire you|hire me|get in touch|book( a)? (repair|appointment)?)$/.test(q)
  ) {
    return 'OPEN_CONTACT';
  }

  if (/\b(change|switch|toggle|swap|cycle)\b.*\b(theme|colou?rs?|accent)\b/.test(q) || /^(theme|change theme|toggle theme)$/.test(q)) {
    return 'TOGGLE_THEME';
  }

  return 'NONE';
}

export function actionReply(action: SystemAction, mode: 'HUMAN' | 'EXPERT'): string | null {
  switch (action) {
    case 'SCROLL_TO_PROJECTS':
      return mode === 'EXPERT'
        ? 'NAV // Scrolling to project archive.'
        : 'Sure! Scrolling to the project archive now. 👀';
    case 'OPEN_CONTACT':
      return mode === 'EXPERT'
        ? 'NAV // Opening contact module.'
        : 'Taking you to the contact section now. 📬 Tell them what you need and include your device model or project details.';
    case 'TOGGLE_THEME':
      return mode === 'EXPERT' ? 'UI // Theme cycled.' : 'Switching the theme for you. 🎨';
    default:
      return null;
  }
}
