// src/components/Terminal.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TerminalProps {
  setIsOpenContactModal?: (open: boolean) => void;
  setIsDiagnosticActive?: (active: boolean) => void;
}

interface Message {
  sender: 'user' | 'system';
  text: string;
  suggestedPrompts?: string[];
}

export const Terminal: React.FC<TerminalProps> = ({ 
  setIsOpenContactModal, 
  setIsDiagnosticActive 
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'system',
      text: "SYS_ONLINE. I am your AI tech & design liaison. Need a quick troubleshooting guide, or looking to commission a project?",
      suggestedPrompts: ["Diagnose PC Issue", "View Design Work", "Dispatch Message"]
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSessionState, setCurrentSessionState] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const trimmedMsg = userMessage.trim();
    setInputVal('');

    // Append user message
    setMessages((prev) => [...prev, { sender: 'user', text: trimmedMsg }]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMsg,
          sessionState: currentSessionState
        })
      });

      const data = await res.json();

      setIsTyping(false);

      // Append system reply
      setMessages((prev) => [
        ...prev, 
        { 
          sender: 'system', 
          text: data.reply, 
          suggestedPrompts: data.suggestedPrompts || [] 
        }
      ]);

      // Save state session if provided
      if (data.nextState) {
        setCurrentSessionState(data.nextState);
      }

      // Execute Site Actions smoothly
      if (data.action === 'SCROLL_TO_PROJECTS') {
        document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
      } else if (data.action === 'OPEN_CONTACT') {
        setIsOpenContactModal?.(true);
      } else if (data.action === 'START_DIAGNOSTIC') {
        setIsDiagnosticActive?.(true);
      }
    } catch (err) {
      setIsTyping(false);
      console.error('Terminal transmission error:', err);
      setMessages((prev) => [
        ...prev, 
        { 
          sender: 'system', 
          text: "SYS_ERR: Transmission interrupted. Local loop active." 
        }
      ]);
    }
  };

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputVal);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl overflow-hidden font-mono flex flex-col h-[420px] shadow-2xl">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 text-[11px] text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-zinc-200 font-semibold tracking-wider">SYS_INTELLIGENCE // ACTIVE</span>
        </div>
        <span className="text-zinc-600">SECURE_LINK</span>
      </div>

      {/* Message Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[88%] p-3 rounded-lg leading-relaxed ${
              msg.sender === 'user' 
                ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-200' 
                : 'bg-zinc-900/60 border border-zinc-800 text-zinc-300'
            }`}>
              <div className="text-[10px] font-semibold opacity-50 mb-1">
                {msg.sender === 'user' ? 'GUEST@OPERATOR' : 'SYS_LIAISON'}
              </div>
              <div className="whitespace-pre-line">{msg.text}</div>

              {/* Interactive Suggestion Chips */}
              {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-zinc-800/80">
                  {msg.suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-[10px] px-2 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/80 hover:border-cyan-400 transition-all active:scale-95"
                    >
                      ↳ {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-zinc-500 text-[11px] p-2 animate-pulse">
            <span>SYS_PROCESSING...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Footer */}
      <form onSubmit={onSubmitForm} className="border-t border-zinc-800/80 p-3 bg-zinc-900/40 flex items-center gap-2">
        <span className="text-cyan-400 text-xs">guest:~#</span>
        <input 
          type="text" 
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Ask for a guide or professional service..."
          className="flex-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
        <button 
          type="submit"
          className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          SEND
        </button>
      </form>
    </div>
  );
};