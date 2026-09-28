// src/app/api/contact/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, formType, serviceType, details, telemetry } = body;

    // 1. Basic Server-Side Validation
    if (!name || !email || !details) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and details are mandatory.' },
        { status: 400 }
      );
    }

    // 2. Dispatch Email via Resend
    const data = await resend.emails.send({
      from: 'System Portfolio Hub <onboarding@resend.dev>',
      to: ['raytbolt@gmail.com'],
      subject: `[SYS_INQUIRY] ${formType.toUpperCase()} - ${name}`,
      html: `
        <div style="font-family: monospace; background-color: #09090b; color: #f4f4f5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #22d3ee; border-bottom: 1px solid #27272a; padding-bottom: 10px;">// NEW SYSTEM INQUIRY RECEIVED</h2>
          <p><strong>Inquiry Type:</strong> ${formType}</p>
          <p><strong>Service Requested:</strong> ${serviceType || 'N/A'}</p>
          <p><strong>Client Name:</strong> ${name}</p>
          <p><strong>Client Email:</strong> ${email}</p>
          
          <div style="background-color: #18181b; padding: 15px; border-radius: 6px; margin-top: 15px; border: 1px solid #27272a;">
            <h3 style="color: #38bdf8; margin-top: 0;">Client Message / Details:</h3>
            <p style="white-space: pre-wrap; color: #d4d4d8;">${details}</p>
          </div>

          ${telemetry ? `
            <div style="background-color: #18181b; padding: 15px; border-radius: 6px; margin-top: 15px; border: 1px solid #f59e0b;">
              <h3 style="color: #f59e0b; margin-top: 0;">Attached Hardware Telemetry:</h3>
              <pre style="color: #fbbf24; font-size: 11px; overflow-x: auto;">${JSON.stringify(telemetry, null, 2)}</pre>
            </div>
          ` : ''}

          <p style="color: #71717a; font-size: 10px; margin-top: 20px;">System Portfolio v1 // Automated Secure Dispatch</p>
        </div>
      `,
    });

    return NextResponse.json(
      { success: true, message: 'Transmission and email dispatch successful.', data },
      { status: 200 }
    );

  } catch (error) {
    console.error('API Email Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during email dispatch.' },
      { status: 500 }
    );
  }
}