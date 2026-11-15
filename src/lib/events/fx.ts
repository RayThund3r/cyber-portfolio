// src/lib/events/fx.ts — tiny bus for screen effects (confetti, snow, ...). Anything can call triggerFx(); <FxLayer /> draws it.
import type { FxName } from './calendar';
export const FX_EVENT = 'site:fx';
export const FX_NAMES: FxName[] = ['confetti', 'snow', 'hearts', 'lanterns', 'stars', 'leaves', 'rain', 'matrix', 'barrel'];
export function triggerFx(fx: FxName, ms = 6000) {
  if (typeof window === 'undefined' || fx === 'none') return;
  window.dispatchEvent(new CustomEvent(FX_EVENT, { detail: { fx, ms } }));
}
