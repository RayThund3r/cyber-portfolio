// src/app/global-error.tsx — last-resort screen if the root layout itself fails (it replaces <html>).
'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Global error:', error); }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ color: '#a1a1aa', margin: '0 0 20px' }}>The page could not load. Please try again.</p>
          <button onClick={reset} style={{ padding: '12px 20px', borderRadius: 8, border: 0, background: '#06b6d4', color: '#000', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
