import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/context/ThemeContext';
import BuilderHome from '@/app/builder/page';
import EditPage from '@/app/builder/edit/page';
function App() {
  const [, f] = useState(0);
  useEffect(() => { const h = () => f((n) => n + 1); window.addEventListener('app:nav', h); window.addEventListener('popstate', h); return () => { window.removeEventListener('app:nav', h); window.removeEventListener('popstate', h); }; }, []);
  const p = location.pathname;
  return p.startsWith('/builder/edit') ? <EditPage /> : <BuilderHome />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>);
