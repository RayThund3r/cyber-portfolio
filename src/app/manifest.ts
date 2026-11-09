import type { MetadataRoute } from 'next';

// Lets phones offer "Add to Home Screen" with the right name and colours.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'System Portfolio // Tech & Design Hub',
    short_name: 'SYS_PORTFOLIO',
    description: 'Hardware repair technician and UI/UX design portfolio.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
  };
}
