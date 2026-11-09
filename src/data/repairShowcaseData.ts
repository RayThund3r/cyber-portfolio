// src/data/repairShowcaseData.ts
//
// Everything the "Hardware Restoration Lab" section on /services displays. Edit here only.
// No prices or guarantees are stated on purpose: they depend on the exact device and fault, so the
// section sends people to the owner/assistant for a quote instead of guessing a number.
import type { IconName } from '@/components/ui/Icon';

export interface RepairType {
  icon: IconName;
  title: string;
  covers: string;
  /** Questions the visitor can send to the assistant in one tap. */
  ask: string;
}

export const REPAIR_TYPES: RepairType[] = [
  { icon: 'phone', title: 'Screens & touch', covers: 'Cracked glass, dead touch, flicker, ghost touch, lines on the display.', ask: 'My phone screen is cracked' },
  { icon: 'battery', title: 'Battery & charging', covers: 'Fast drain, swelling, slow or no charging, loose or dirty charging ports.', ask: 'My phone is not charging' },
  { icon: 'droplet', title: 'Water damage', covers: 'Liquid exposure: cleaning, corrosion treatment and a power-up check. Switch it off and keep it dry first.', ask: 'My phone got wet' },
  { icon: 'cpu', title: 'Board-level faults', covers: 'No power, boot loops, short circuits and component-level repairs on phones and PCs.', ask: 'My device will not turn on' },
  { icon: 'bolt', title: 'Overheating & slow PCs', covers: 'Re-pasting, fan and vent cleaning, thermal testing, OS clean install and tune-up.', ask: 'My laptop is overheating' },
  { icon: 'disk', title: 'Software & data', covers: 'Unbricking, flashing, OS reinstall, virus clean-up and recovering what can be recovered.', ask: 'My phone is stuck on the logo' },
];

export interface RepairStep {
  n: string;
  title: string;
  text: string;
}

export const REPAIR_STEPS: RepairStep[] = [
  { n: '01', title: 'Describe it', text: 'Tell the assistant or the owner the device, the model and what it does (or does not do).' },
  { n: '02', title: 'Diagnose', text: 'A full diagnostic comes first, so you pay to fix the real fault, not a guess.' },
  { n: '03', title: 'Approve the plan', text: 'You get the finding, the parts needed and the cost before any repair starts.' },
  { n: '04', title: 'Repair & stress-test', text: 'The fix is done, then the device is tested under load before it goes back to you.' },
];

export const REPAIR_FACTS: Array<{ label: string; value: string }> = [
  { label: 'Typical turnaround', value: '24 – 48 hours' },
  { label: 'Starts with', value: 'Full diagnostic report' },
  { label: 'Devices', value: 'Phones, laptops, desktops' },
  { label: 'Location', value: 'Ndejje, Makindye Ssabagabo' },
];

export const BRING_LIST = [
  'The device, with its charger if it has one',
  'The passcode, or a note if you would rather unlock it yourself',
  'What happened just before it failed (drop, water, update, power cut)',
  'Anything you must not lose: say so up front',
];

export const REPAIR_NOTES =
  'Turnaround is a typical range, not a promise: a part that must be ordered, the queue and what inspection finds can all change it.';
