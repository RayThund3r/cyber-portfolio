// src/data/portfolioData.ts

export interface ProjectItem {
  id: string;
  title: string;
  category: 'UI/UX' | 'BRANDING' | 'WEBAPP' | 'HARDWARE';
  description: string;
  image: string;
  metrics?: string;
  tools?: string[];
  clientType?: string;
  gallery?: string[];
}

export const ALL_PROJECTS: ProjectItem[] = [
  {
    id: '01',
    title: 'Cyber-Industrial Brand Identity',
    category: 'BRANDING',
    description: 'High-contrast neon visual identity, custom typography styling, and promotional poster design for high-tech service workflows.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
    metrics: '100% Vector Scalability',
    tools: ['Adobe Illustrator', 'Photoshop', 'Typography'],
    clientType: 'Commercial Event',
    gallery: [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1542744094-3a312439c4d0?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?q=80&w=1000&auto=format&fit=crop',
    ]
  },
  {
    id: '02',
    title: 'Next.js Cyber Portfolio Hub',
    category: 'WEBAPP',
    description: 'Blazing-fast client-side rendered architecture featuring terminal microcopy, responsive layouts, and optimized component hierarchy.',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop',
    metrics: '0.4s Load Index',
    tools: ['Next.js', 'Tailwind CSS', 'TypeScript'],
    clientType: 'Personal Brand',
    gallery: [
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1555099962-4199c345e5dd?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1000&auto=format&fit=crop',
    ]
  },
  {
    id: '03',
    title: 'Mobile & PC Diagnostics Suite',
    category: 'HARDWARE',
    description: 'Advanced firmware flashing, component-level repair protocols, software unbricking, and performance optimization benchmarks.',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1000&auto=format&fit=crop',
    metrics: '99.8% Success Rate',
    tools: ['UnlockTool', 'SamFw', 'ADB Terminal', 'Hardware Diagnostics'],
    clientType: 'Technical Service',
    gallery: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1588580000645-4562a6d2c839?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?q=80&w=1000&auto=format&fit=crop',
    ]
  },
  {
    id: '04',
    title: 'Figma UI/UX Design System & Prototyping',
    category: 'UI/UX',
    description: 'Comprehensive mobile and web interface layouts built with Auto Layout, interactive states, and pixel-aligned spacing grids.',
    image: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=1000&auto=format&fit=crop',
    metrics: 'Fully Responsive UI',
    tools: ['Figma', 'Auto Layout', 'UI Prototyping'],
    clientType: 'Product Design',
    gallery: [
      'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop',
    ]
  },
  {
    id: '05',
    title: 'Precision Fabric Embroidery Assets (.jef)',
    category: 'BRANDING',
    description: 'Digitized name lists and custom graphic patterns formatted precisely for Janome industrial embroidery machines using Wilcom ES.',
    image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1000&auto=format&fit=crop',
    metrics: '72 Files Processed',
    tools: ['Wilcom ES v9', '.jef Formatter', 'Vector Conversion'],
    clientType: 'Textile Customization',
    gallery: [
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1000&auto=format&fit=crop',
    ]
  },
  {
    id: '06',
    title: 'Desktop Workspace Translucency & Customization',
    category: 'WEBAPP',
    description: 'Custom Rainmeter Mond skin configurations and Windhawk YAML window mods engineered for optimal developer visual feedback.',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
    metrics: '60 FPS UI Rendering',
    tools: ['Rainmeter', 'Windhawk', 'CSS/YAML'],
    clientType: 'Environment Optimization',
    gallery: [
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=1000&auto=format&fit=crop',
    ]
  },
];

export const TECH_STACK = [
  { label: 'Mobile & PC Repair', category: 'HARDWARE', level: 'Expert' },
  { label: 'Adobe Illustrator & Photoshop', category: 'DESIGN', level: 'Advanced' },
  { label: 'Figma UI/UX Prototyping', category: 'DESIGN', level: 'Advanced' },
  { label: 'Next.js & TypeScript', category: 'DEVELOPMENT', level: 'Active' },
  { label: 'Tailwind CSS & Styling', category: 'DEVELOPMENT', level: 'Advanced' },
  { label: 'Asset Conversion (.jef / Vector)', category: 'TOOLING', level: 'Specialized' },
];

export const FEATURED_PROJECTS = ALL_PROJECTS.slice(0, 3);