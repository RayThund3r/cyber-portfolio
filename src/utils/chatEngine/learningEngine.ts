// src/utils/chatEngine/learningEngine.ts

import { LearnedMemoryItem } from './types';

const STORAGE_KEY = 'cyber_chat_engine_learned_memory_v1';

// 1. Retrieve self-grown memory from browser local storage safely
export function getLearnedMemory(): LearnedMemoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load learned memory:", err);
    return [];
  }
}

// 2. Silently record new user patterns to local storage for permanent self-expansion
export function recordUserFeedback(pattern: string, mappedIntent: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanPattern = pattern.toLowerCase().trim();
    if (!cleanPattern || cleanPattern.length < 2) return;

    const current = getLearnedMemory();
    
    // Avoid duplicate storage entries
    if (current.some(item => item.pattern === cleanPattern)) return;

    const newItem: LearnedMemoryItem = {
      pattern: cleanPattern,
      mappedIntent,
      timestamp: Date.now()
    };

    const updated = [newItem, ...current].slice(0, 100); // Keep last 100 learned items max
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to record user feedback:", err);
  }
}

// 3. Advanced Gibberish, Keyboard Smash & Meta-Talk Detection
export function isGibberish(input: string): boolean {
  if (!input) return true;
  const clean = input.toLowerCase().trim();

  // Meta-talk or testing words
  if (['gibberish', 'random', 'testing', 'asdf', 'test', 'qwerty', '12345'].includes(clean)) {
    return true;
  }

  // High repeated character frequency (e.g., "aaaaa", "zzzzz")
  if (/(.)\1{4,}/.test(clean)) {
    return true;
  }

  // Low vowel-to-consonant ratio for words over 6 chars without spaces (keyboard smashes like "sdfghjkl")
  if (clean.length > 6 && !clean.includes(' ')) {
    const vowels = clean.match(/[aeiouy]/g);
    if (!vowels || vowels.length / clean.length < 0.15) {
      return true;
    }
  }

  return false;
}