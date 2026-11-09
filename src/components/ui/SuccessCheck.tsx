// src/components/ui/SuccessCheck.tsx
//
// The iOS-style "done" checkmark: the circle draws itself, then the tick. Pure CSS (see globals.css);
// visitors who prefer reduced motion simply see the finished check.
export default function SuccessCheck({ size = 56, className = 'text-emerald-400' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle className="ios-check-circle" cx="28" cy="28" r="26" />
      <path className="ios-check-tick" d="M16 29l8 8 16-17" />
    </svg>
  );
}
