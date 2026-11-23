// src/components/ui/IconAny.tsx — draws ANY icon from the big set in lib/icons.ts (the small <Icon> only knows its own names).
import { iconSvg } from '@/lib/icons';

export default function IconAny({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return <span className={`inline-flex align-[-2px] ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: iconSvg(name, { size }) }} />;
}
