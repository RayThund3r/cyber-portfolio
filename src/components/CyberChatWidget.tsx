// src/components/CyberChatWidget.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';

interface Message {
  sender: 'user' | 'system';
  text: string;
}

export default function CyberChatWidget() {
  const { theme, themeClasses } = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'system', text: 'SYS_ONLINE. Hey there! I am your AI tech & design liaison. Need a quick troubleshooting guide, or looking to commission a project?' }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg = text.trim();
    if (!textToSend) setInput('');
    
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      
      setMessages((prev) => [...prev, { sender: 'system', text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { sender: 'system', text: 'ERR: Failed to connect to neural backend.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-mono">
      {/* Floating Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className={`px-4 py-3 bg-zinc-950 border ${themeClasses.border} ${themeClasses.accent} rounded-full shadow-lg hover:bg-zinc-900 transition-all flex items-center gap-2.5`}
          >
            <span className={`w-2.5 h-2.5 rounded-full animate-ping ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            <span className="text-xs font-bold tracking-wider">AI_ASSISTANT // ENGAGE</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Interactive Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`bg-zinc-950 border ${themeClasses.border} rounded-xl w-80 sm:w-[400px] shadow-2xl overflow-hidden flex flex-col h-[520px]`}
          >
            {/* Header */}
            <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className={`text-xs font-bold ${themeClasses.accent}`}>SYS_INTELLIGENCE // ACTIVE</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-zinc-400 hover:text-zinc-100 bg-zinc-800/60 px-2 py-0.5 rounded transition-colors"
              >
                [CLOSE ✕]
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-3 py-2 bg-zinc-900/40 border-b border-zinc-900 flex gap-1.5 overflow-x-auto text-[10px] [&::-webkit-scrollbar]:hidden">
              <button onClick={() => handleSendMessage("How do I fix a lagging PC?")} className={`px-2 py-1 bg-zinc-900 border border-zinc-800 ${themeClasses.accent} rounded hover:opacity-80 whitespace-nowrap`}>
                ⚡ Fix Laggy PC
              </button>
              <button onClick={() => handleSendMessage("I need a custom UI design")} className={`px-2 py-1 bg-zinc-900 border border-zinc-800 ${themeClasses.accent} rounded hover:opacity-80 whitespace-nowrap`}>
                🎨 UI/UX Project
              </button>
              <button onClick={() => handleSendMessage("Phone repair inquiry")} className={`px-2 py-1 bg-zinc-900 border border-zinc-800 ${themeClasses.accent} rounded hover:opacity-80 whitespace-nowrap`}>
                📱 Phone Repair
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[9px] text-zinc-500 mb-0.5">
                    {msg.sender === 'user' ? 'YOU' : 'AI_LIAISON'}
                  </span>
                  <div
                    className={`p-3 rounded-xl max-w-[90%] leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? `bg-zinc-900 border ${themeClasses.border} text-zinc-100`
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className={`${themeClasses.accent} text-[11px] animate-pulse flex items-center gap-2`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-ping ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                  COMPILING INTELLIGENT RESPONSE...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
              className="p-3 border-t border-zinc-900 bg-zinc-900/60 flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask for a guide or professional service..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={`w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500`}
              />
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 font-semibold rounded transition-colors disabled:opacity-50 ${theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}
              >
                SEND
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}