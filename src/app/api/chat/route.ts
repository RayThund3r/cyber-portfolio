// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Safely resolve API key across common environment variable naming conventions
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY || '';

// Initialize client only if key exists to prevent instantiation crashes
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_PERSONA = `You are the elite AI assistant for a professional PC/mobile repair technician and UI/UX graphic designer based in Ndejje, Makindye Ssabagabo, Uganda. 
Your tone is cyber-industrial, tech-savvy, helpful, concise, and professional. 
Specialties: PC & mobile hardware troubleshooting, graphic design, UI/UX prototyping (Figma, Adobe suite), and local tech support. Give sharp, expert guidance and encourage users to book via the contact page or check out the services section.`;

export async function POST(req: Request) {
  try {
    // 1. Safeguard against malformed or empty request bodies
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { reply: "ERR_INVALID_JSON: Request payload could not be parsed." },
        { status: 400 }
      );
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    
    if (!message) {
      return NextResponse.json(
        { reply: "SYS_NOTICE: Please provide a valid message inquiry." },
        { status: 400 }
      );
    }

    const lowerMsg = message.toLowerCase();

    // 2. Attempt Cloud AI Generation with strict timeout (10s) and fallback checks
    if (ai) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              { 
                role: 'user', 
                parts: [{ text: `${SYSTEM_PERSONA}\n\nUser Message: ${message}` }] 
              }
            ],
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 10000))
        ]) as any;

        const reply = response?.text;
        if (reply && typeof reply === 'string') {
          return NextResponse.json({ reply }, { status: 200 });
        }
      } catch (cloudError: any) {
        console.warn(`[AI_FALLBACK_TRIGGERED] Reason: ${cloudError?.message || 'Unknown cloud error'}`);
      }
    } else {
      console.warn("[AI_NOTICE] No valid API key detected. Operating in intelligent offline mode.");
    }

    // 3. Comprehensive Local Knowledge Fallback (Zero dependency, 100% uptime)
    let fallbackReply = "SYS_LOCAL_MODE: Operating on secure backup intelligence. For advanced hardware diagnostics or custom UI/UX projects, drop a dispatch via our contact terminal!";

    if (lowerMsg.includes('lag') || lowerMsg.includes('slow') || lowerMsg.includes('pc') || lowerMsg.includes('optimize') || lowerMsg.includes('omen') || lowerMsg.includes('laptop')) {
      fallbackReply = "PC OPTIMIZATION PROTOCOL:\n1. Clear temp files via 'run' -> %temp%.\n2. Monitor thermal loads and clean cooling fans regularly (especially high-performance rigs like the HP Omen 15).\n3. Check background startup apps in Task Manager.\n\nNeed physical servicing? Book an inspection via our services page!";
    } else if (lowerMsg.includes('phone') || lowerMsg.includes('repair') || lowerMsg.includes('screen') || lowerMsg.includes('battery') || lowerMsg.includes('mobile') || lowerMsg.includes('iphone')) {
      fallbackReply = "MOBILE REPAIR SERVICE:\nSpecialized in screen replacements, battery swaps, and firmware troubleshooting. Avoid amateur DIY heat gun damage—reach out via our contact page for professional bench repair!";
    } else if (lowerMsg.includes('design') || lowerMsg.includes('ui') || lowerMsg.includes('ux') || lowerMsg.includes('logo') || lowerMsg.includes('poster') || lowerMsg.includes('figma')) {
      fallbackReply = "CREATIVE & UI/UX DESIGN:\nWe craft cyber-industrial web interfaces using Next.js & Tailwind, along with Adobe Illustrator & Photoshop for striking brand identities and promotional posters.";
    } else if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('charge') || lowerMsg.includes('pay')) {
      fallbackReply = "PRICING & DISPATCH:\nService fees vary based on hardware complexity or design scope. You can initiate an official quote request or submit project parameters via our contact terminal.";
    }

    return NextResponse.json({ reply: fallbackReply }, { status: 200 });

  } catch (globalError) {
    console.error('Critical Chat API Failure:', globalError);
    // Ultimate failsafe response so the UI widget never breaks or hangs
    return NextResponse.json(
      { reply: "SYS_FAILSAFE: Transmission anomaly detected. Please use our direct contact page to submit your inquiry." },
      { status: 200 } // Returning 200 with friendly text prevents frontend crash loops
    );
  }
}