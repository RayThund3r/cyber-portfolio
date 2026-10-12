// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { reply: "ERR_INVALID_JSON: Request payload could not be parsed.", action: "NONE" },
        { status: 400 }
      );
    }

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    
    if (!message) {
      return NextResponse.json(
        { reply: "SYS_NOTICE: Please provide a valid message inquiry.", action: "NONE" },
        { status: 400 }
      );
    }

    const q = message.toLowerCase();
    let reply = "";
    let action = "NONE";
    let suggestedPrompts: string[] = [];

    // --- 1. GREETINGS & INTROS ---
    if (/^(hi|hello|hey|yo|sup|greetings|who are you|what is this|help)/.test(q)) {
      reply = "SYS_ONLINE: Systems operational. I'm your embedded technical co-pilot. I handle hardware diagnostics, UI/UX architecture, and site automation. What are we optimizing today?";
      suggestedPrompts = ["Diagnose PC Issue", "View Design Work", "Dispatch Message"];
    } 
    // --- 2. HARDWARE & DIAGNOSTICS ---
    else if (/(lag|slow|pc|laptop|phone|screen|battery|repair|fix|heat|hot|freeze|blue screen|gpu|cpu|omen|latitude)/.test(q)) {
      if (/(phone|mobile|screen|iphone|android|battery)/.test(q)) {
        reply = "MOBILE_DIAGNOSTIC: Screen flickering, power draw issues, or board-level component failure? Let me open the service portal so you can detail the device state.";
        action = "START_DIAGNOSTIC";
        suggestedPrompts = ["Book Screen Repair", "Battery Replacement", "Talk to Design Team"];
      } else {
        reply = "HARDWARE_TELEMETRY: Sounds like thermal throttling, startup bloat, or driver corruption. I can walk you through local troubleshooting or queue a physical bench inspection.";
        action = "START_DIAGNOSTIC";
        suggestedPrompts = ["Clear PC Bloat", "Book Bench Inspection", "Check UI/UX Portfolio"];
      }
    } 
    // --- 3. DESIGN & PORTFOLIO ---
    else if (/(ui|ux|design|figma|photoshop|illustrator|portfolio|projects|work|showcase|logo|poster|flyer|website)/.test(q)) {
      reply = "CREATIVE_CORE: Shifting focus to design systems and UI/UX prototypes. Scrolling to the project archive now...";
      action = "SCROLL_TO_PROJECTS";
      suggestedPrompts = ["Figma Case Studies", "Brand Identity", "Request Design Quote"];
    } 
    // --- 4. PRICING & DISPATCH ---
    else if (/(price|cost|quote|charge|hire|contact|reach|book|message|email|talk)/.test(q)) {
      reply = "DISPATCH_CHANNEL: Initiating secure transmission line. Opening contact terminal...";
      action = "OPEN_CONTACT";
      suggestedPrompts = ["Hardware Quote", "Custom Design Project", "General Question"];
    } 
    // --- 5. CASUAL BANTER ---
    else if (/(cool|nice|thanks|thank you|awesome|great|what can you do|who made this)/.test(q)) {
      reply = "ACKNOWLEDGED. Built with custom TypeScript state orchestration and zero external API dependencies. Fully autonomous. Need to run another directive?";
      suggestedPrompts = ["Fix Laggy PC", "Explore Projects", "Contact Direct"];
    } 
    // --- 6. SMART FALLBACK ---
    else {
      reply = `SYS_INTELLIGENCE: Analyzed phrase "${message}". While I don't have a direct hardcoded rule for that exact syntax, I am wired for hardware repair dispatches, UI/UX portfolio navigation, and tech assistance. Where should we head?`;
      suggestedPrompts = ["Diagnose PC Issue", "View UI/UX Work", "Open Contact Line"];
    }

    return NextResponse.json({ reply, action, suggestedPrompts, status: "ONLINE" }, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { 
        reply: "SYS_FAILSAFE: Transmission anomaly detected. Please use our direct contact page to submit your inquiry.", 
        action: "OPEN_CONTACT",
        status: "FAILSAFE" 
      },
      { status: 200 }
    );
  }
}