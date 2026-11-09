// src/data/servicesData.ts
//
// Moved out of services/page.tsx so the page AND the chat assistant read the same facts
// (timelines, deliverables). Edit here once; both stay in sync.

export interface ServiceItem {
  id: string;
  title: string;
  tag: string;
  description: string;
  deliverables: string[];
  timeline: string;
  status: 'ONLINE' | 'ACTIVE';
}

export const SERVICES: ServiceItem[] = [
  {
    id: '01',
    title: 'Mobile & PC Hardware Diagnostics & Repair',
    tag: 'HARDWARE_OPS',
    description:
      'Advanced troubleshooting, component-level repairs, screen/battery replacements, and system optimization for mobile devices and PCs.',
    deliverables: ['Full Diagnostic Report', 'Thermal Paste Re-pasting', 'OS Clean Installation', 'Hardware Stress Testing'],
    timeline: '24 - 48 Hours',
    status: 'ONLINE',
  },
  {
    id: '02',
    title: 'Brand Identity & Graphic Design',
    tag: 'VISUAL_ENGINEERING',
    description:
      'Custom visual systems, logo upscaling, typography styling, and promotional poster engineering built in Adobe Illustrator & Photoshop.',
    deliverables: ['Vector Logo Packages', 'High-Resolution Event Posters', 'Brand Guidelines', 'Social Media Assets'],
    timeline: '3 - 5 Days',
    status: 'ONLINE',
  },
  {
    id: '03',
    title: 'UI/UX Prototyping & Web Layouts',
    tag: 'INTERFACE_DESIGN',
    description:
      'Cyber-industrial web interfaces, interactive component states, and responsive layouts designed in Figma with clean Auto Layouts.',
    deliverables: [
      'Figma Wireframes & Prototypes',
      'Design System Components',
      'Next.js / Tailwind Layout Integration',
      'Interactive Animations',
    ],
    timeline: 'Custom Scope',
    status: 'ACTIVE',
  },
  {
    id: '04',
    title: 'Digital Asset Optimization & Formats',
    tag: 'ASSET_TRANSFORM',
    description:
      'Specialized file format conversions, embroidery pattern digitization (e.g., Wilcom .jef formatting), and raster-to-vector tracing.',
    deliverables: ['.jef Embroidery Files', 'Clean SVG Conversions', 'Batch Image Resizing', 'Color Profile Correction'],
    timeline: '24 Hours',
    status: 'ONLINE',
  },
];

/** The "How it works" steps on the services page. Edit the wording to match how you really work. */
export const PROCESS_STEPS: { id: string; title: string; text: string }[] = [
  { id: '01', title: 'BRIEF', text: 'Tell me what you need through the contact form or the chat assistant: the device and its symptoms, or the design goal.' },
  { id: '02', title: 'SCOPE', text: 'You get a clear scope and timeline estimate before any work begins.' },
  { id: '03', title: 'BUILD', text: 'The repair, design or file conversion is carried out against the agreed scope.' },
  { id: '04', title: 'DELIVER', text: 'The finished files or repaired device are handed over to you.' },
];
