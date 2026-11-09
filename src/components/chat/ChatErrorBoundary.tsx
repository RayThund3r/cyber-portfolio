// src/components/chat/ChatErrorBoundary.tsx
//
// If the chat ever throws while rendering, the rest of the site must keep working. This swaps the
// widget for a small "reload chat" button instead of taking the page down with it.
'use client';

import React from 'react';

interface State {
  failed: boolean;
}

export default class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Chat widget crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <button
        type="button"
        onClick={() => this.setState({ failed: false })}
        className="fixed bottom-4 right-4 z-[60] rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs text-zinc-300 hover:text-accent"
      >
        CHAT_OFFLINE · TAP TO RETRY
      </button>
    );
  }
}
