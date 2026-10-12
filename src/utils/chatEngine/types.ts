// src/utils/chatEngine/types.ts

export type PersonaMode = 'HUMAN' | 'EXPERT';

export type TopicDomain = 
  | 'GREETINGS'
  | 'HARDWARE_REPAIR'
  | 'DESIGN_BRANDING'
  | 'PRICING_RATES'
  | 'GENERAL_QA';

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

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  imageUrl?: string;
  time: string;
}

export interface ProcessingResult {
  reply: string;
  updatedMemory: SessionMemory;
  imageUrl?: string;
}

export interface KnowledgeEntry {
  domain: TopicDomain;
  keywords: string[];
  humanResponse: string;
  expertResponse: string;
}

export interface LearnedMemoryItem {
  pattern: string;
  mappedIntent: string;
  timestamp: number;
}