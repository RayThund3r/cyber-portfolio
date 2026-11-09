// src/components/ProjectImage.tsx — next/image with a safe fallback. Parent must be `relative` with a height.
'use client';

import Image from 'next/image';
import { useState } from 'react';

const FALLBACK = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop';
const OPTIMIZED_HOSTS = ['images.unsplash.com', ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean)];

function canOptimize(src: string): boolean {
  if (src.startsWith('/')) return true;
  try { return OPTIMIZED_HOSTS.includes(new URL(src).hostname); } catch { return false; }
}

export default function ProjectImage({ src, alt, sizes, className, priority }: {
  src: string; alt: string; sizes: string; className?: string; priority?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const real = failed === src ? FALLBACK : src;
  return (
    <Image
      src={real}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // Hosts not whitelisted in next.config still display, just without Next's optimization.
      unoptimized={!canOptimize(real)}
      onError={() => setFailed(src)}
      className={className}
    />
  );
}
