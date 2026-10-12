import type { MetadataRoute } from 'next';

// Lets Priya "Add to Home Screen" so the meeting card is one tap away on her phone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PitchPrep',
    short_name: 'PitchPrep',
    description: 'Sourced, fact-checked pre-meeting investor briefs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f3',
    theme_color: '#1f5f4a',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
