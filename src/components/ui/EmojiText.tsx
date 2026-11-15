// src/components/ui/EmojiText.tsx
//
// Shows text in which emojis that have a matching line icon (lib/icons.ts) are drawn as that icon, so the chat matches the
// site's cyber style and looks the same on every phone. Emojis without a matching icon are left exactly as written.
import { Fragment, type ReactNode } from 'react';
import { EMOJI_RE, ICONS, emojiToIcon } from '@/lib/icons';

function Svg({ name }: { name: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width="1.05em" height="1.05em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-[0.1em] inline-block shrink-0 align-[-0.15em]"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export function emojiToNodes(text: string): ReactNode {
  if (!text) return text;
  const re = new RegExp(EMOJI_RE.source, EMOJI_RE.flags);
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    const name = emojiToIcon(m[0]);
    if (!name || !ICONS[name]) continue; // unknown emoji: stays as text
    if (i > last) out.push(text.slice(last, i));
    out.push(<Svg key={`e${n++}`} name={name} />);
    last = i + m[0].length;
  }
  if (!n) return text;
  if (last < text.length) out.push(text.slice(last));
  return out.map((x, k) => <Fragment key={k}>{x}</Fragment>);
}
