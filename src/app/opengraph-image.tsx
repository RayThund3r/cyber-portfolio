// Generated link-preview image (WhatsApp, Slack, X, LinkedIn...). No image file needed.
import { ImageResponse } from 'next/og';

export const alt = 'System Portfolio // Tech & Design Hub';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          background: '#09090b',
          color: '#f4f4f5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, color: '#22d3ee', letterSpacing: 6 }}>SYS_PORTFOLIO.v1</div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, marginTop: 28, lineHeight: 1.1 }}>
          Engineering digital systems &amp; hardware precision.
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#a1a1aa', marginTop: 32 }}>
          Hardware repair technician &amp; UI/UX designer
        </div>
      </div>
    ),
    size
  );
}
