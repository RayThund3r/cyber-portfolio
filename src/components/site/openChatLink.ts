'use client';
import { openChat } from '@/lib/chatBus';
/** Opens the assistant with a ready-made question about the developer. */
export const openChatLink = () => openChat({ prefill: 'Tell me about the developer' });
