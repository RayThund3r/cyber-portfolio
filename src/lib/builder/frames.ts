// src/lib/builder/frames.ts — state machine for the editor's double-buffered preview (two stacked iframes).
// The new page loads in the HIDDEN frame and is swapped in only once it has actually loaded, so the canvas never flashes white.
// Kept as a pure function so the tricky cases are unit-tested (tests/builder.frames.test.mjs).
export interface FrameState { docs: [string, string]; front: 0 | 1 }
export type FrameEvent = { t: 'doc'; doc: string } | { t: 'load'; i: 0 | 1 };
export const initialFrames: FrameState = { docs: ['', ''], front: 0 };

export function frameReducer(s: FrameState, e: FrameEvent): FrameState {
  if (e.t === 'doc') {
    const back = (1 - s.front) as 0 | 1;
    if (!s.docs[s.front]) { const docs: [string, string] = [s.docs[0], s.docs[1]]; docs[s.front] = e.doc; return { ...s, docs }; }   // first page goes straight to the visible frame
    if (s.docs[s.front] === e.doc) { return s.docs[back] ? { ...s, docs: s.front === 0 ? [s.docs[0], ''] : ['', s.docs[1]] } : s; } // back to what is already showing: cancel any pending load
    if (s.docs[back] === e.doc) return s;
    const docs: [string, string] = [s.docs[0], s.docs[1]]; docs[back] = e.doc; return { ...s, docs };
  }
  if (e.i === s.front) return s;          // the visible frame finished loading: nothing to do
  if (!s.docs[e.i]) return s;             // an EMPTY frame fires `load` too (about:blank) — swapping to it would blank the whole canvas
  const docs: [string, string] = [s.docs[0], s.docs[1]]; docs[s.front] = ''; // release the old page (stops its timers/animations)
  return { docs, front: e.i };
}
