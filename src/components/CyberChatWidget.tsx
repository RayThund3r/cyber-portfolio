// src/components/CyberChatWidget.tsx
//
// Same import path the site has always used (layout.tsx imports this). The widget itself now lives
// in components/chat/*; this wrapper just adds a crash guard so a chat bug can never blank a page.
'use client';

import ChatErrorBoundary from './chat/ChatErrorBoundary';
import ChatWidget from './chat/ChatWidget';

export default function CyberChatWidget() {
  return (
    <ChatErrorBoundary>
      <ChatWidget />
    </ChatErrorBoundary>
  );
}
