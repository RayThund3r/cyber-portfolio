// src/utils/chatEngine/knowledgeBase.ts

import { TopicDomain } from './types';
import { getLearnedMemory } from './learningEngine';

export interface KnowledgeEntry {
  domain: TopicDomain | string;
  keywords: string[];
  humanResponse: string;
  expertResponse: string;
}

const STATIC_KNOWLEDGE: KnowledgeEntry[] = [
  {
    domain: 'GREETINGS',
    keywords: ['hi', 'hello', 'hey', 'greetings', 'yo', 'good morning', 'good afternoon', 'good evening'],
    humanResponse: "Hello! 👋 Great to connect with you. Whether you need device repairs, custom branding, or web development, how can I help you today?",
    expertResponse: "SYS_INIT // Neural link established. Secure relay node active. Standing by for diagnostic telemetry or architecture specifications."
  },
  {
    domain: 'HARDWARE_REPAIR',
    keywords: [
      'repair', 'dead device', 'screen damage', 'screen replacement', 
      'battery replacement', 'motherboard repair', 'won\'t turn on', 
      'not charging', 'fix my phone', 'fix my pc'
    ],
    humanResponse: "I handle comprehensive hardware repairs for mobile phones and PCs! If your device is dead, has screen damage, or isn't charging, tell me the exact symptoms and model so I can assist.",
    expertResponse: "SYS_DIAGNOSTIC // Hardware repair pipeline initialized. Protocols: Motherboard power rail tracing, CMOS recovery, IC soldering, and display assembly replacement."
  },
  {
    domain: 'DESIGN_BRANDING',
    keywords: [
      'graphic design', 'brand identity', 'logo design', 
      'embroidery formatting', 'fabric print', 'figma design', 'ui/ux'
    ],
    humanResponse: "Design is all about clarity and identity! I craft logos, UI/UX layouts in Figma, and format custom name lists and vector artwork ready for fabric printing and embroidery machines.",
    expertResponse: "DESIGN_ENGINE // Multi-format graphics processing active. Delivering SVG vector scale paths, Adobe workflow integration, and PES/DST embroidery machine line formatting."
  },
  {
    domain: 'PRICING_RATES',
    keywords: [
      'price list', 'service cost', 'repair rate', 
      'project quote', 'how much do you charge', 'pricing', 'rates'
    ],
    humanResponse: "Pricing is completely transparent and tailored to your specific project needs with zero hidden fees. Feel free to ask about rates for repairs, web builds, or graphic design!",
    expertResponse: "SLA_METRICS // Tiered pricing structure active based on diagnostic depth, component sourcing, and design asset complexity. Request custom quote via contact link."
  }
];

/**
 * Returns the combined knowledge base:
 * Static core knowledge entries merged with silently learned local storage items.
 */
export function getActiveKnowledgeBase(): KnowledgeEntry[] {
  const learnedMemory = getLearnedMemory();
  
  // Transform learned memory into active knowledge entries (silent execution, no robotic meta-talk)
  const dynamicEntries: KnowledgeEntry[] = learnedMemory.map((item) => ({
    domain: item.mappedIntent as TopicDomain,
    keywords: [item.pattern],
    humanResponse: `Regarding ${item.pattern}: I can help you set up or troubleshoot solutions for this within hardware repair, design branding, or web engineering. What specific details do you need?`,
    expertResponse: `SYS_DYNAMIC_NODE // Pattern [${item.pattern}] resolved for domain [${item.mappedIntent}].`
  }));

  return [...STATIC_KNOWLEDGE, ...dynamicEntries];
}