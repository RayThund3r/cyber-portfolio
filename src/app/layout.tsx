// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CyberChatWidget from '@/components/CyberChatWidget';
import { ThemeProvider } from '@/context/ThemeContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "System Portfolio // Tech & Design Hub[cite: 15]",
  description: "Advanced hardware repair technician and UI/UX design portfolio[cite: 15].",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black">
        <ThemeProvider>
          {/* Global Page Transition Wrapper */}
          <main className="flex-1 flex flex-col animate-page-in">
            {children}
          </main>
          <CyberChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}