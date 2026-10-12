// src/components/CyberChatWidget.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { processChatQuery } from '@/utils/chatEngine';
import { PersonaMode, Message, SessionMemory } from '@/utils/chatEngine/types';

export default function CyberChatWidget() {
  const { theme, themeClasses } = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PersonaMode>('HUMAN');
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  
  const [memory, setMemory] = useState<SessionMemory>({
    interactionCount: 0,
    lastTopic: 'GREETINGS',
    userContext: {},
    conversationHistory: []
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Hey there! 👋 I'm your interactive chat assistant. Ask me anything about hardware repairs, brand design, web engineering, or project estimates!",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isThinking]);

  const toggleMode = () => {
    const nextMode: PersonaMode = mode === 'HUMAN' ? 'EXPERT' : 'HUMAN';
    setMode(nextMode);

    const modeMsg: Message = {
      id: Date.now().toString(),
      sender: 'bot',
      text: nextMode === 'EXPERT'
        ? "SYS_MODE: [EXPERT] // Telemetry, hardware diagnostic scripts, and technical toolchains active."
        : "Human Mode Active! 😊 Warm, conversational, and simple guidance enabled.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, modeMsg]);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      // Process query through our chunked engine with silent self-growing memory and background intel
      const { reply, updatedMemory, imageUrl } = await processChatQuery(textToSend, mode, memory);
      setMemory(updatedMemory);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: reply,
        imageUrl: imageUrl, // Supports dynamic images returned from background intel
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Engine execution error:", error);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-mono">
      {/* Floating Chat Trigger Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-900 border ${themeClasses.border} text-zinc-100 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer group`}
        >
          <span className={`w-2.5 h-2.5 rounded-full animate-ping ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
          <span className="text-xs font-bold tracking-wide">CHAT_ASSIST</span>
        </button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className={`w-80 sm:w-96 h-[520px] bg-zinc-950 border ${theme === 'cyan' ? 'border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]' : theme === 'amber' ? 'border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]'} rounded-xl flex flex-col overflow-hidden animate-page-in`}>
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${theme === 'cyan' ? 'bg-cyan-400' : theme === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`text-xs font-bold ${themeClasses.accent}`}>CHAT_ENGINE</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMode}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                  mode === 'HUMAN'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20'
                }`}
              >
                MODE: [{mode}]
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-zinc-500 hover:text-zinc-200 px-1.5 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs font-sans">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-lg leading-relaxed ${
                    msg.sender === 'user'
                      ? `${theme === 'cyan' ? 'bg-cyan-500 text-black' : theme === 'amber' ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'} font-medium`
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                  }`}
                >
                  {/* Dynamic Image Preview */}
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Intelligence preview"
                      className="w-full h-36 object-cover rounded-md mb-2 border border-zinc-700/50"
                    />
                  )}
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
                <span className="text-[9px] font-mono text-zinc-600 mt-1 px-1">
                  {msg.time}
                </span>
              </div>
            ))}

            {/* Thinking State */}
            {isThinking && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 bg-zinc-900/60 p-2 rounded max-w-[120px] border border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="p-3 bg-zinc-900/90 border-t border-zinc-800 flex gap-2"
          >
            <input
              type="text"
              placeholder={mode === 'HUMAN' ? "Ask anything..." : "ENTER_QUERY..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
            />
            <button
              type="submit"
              className={`px-3.5 py-2 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                theme === 'cyan' ? 'bg-cyan-500 text-black hover:bg-cyan-400' : theme === 'amber' ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'
              }`}
            >
              SEND
            </button>
          </form>
        </div>
      )}
    </div>
  );
}