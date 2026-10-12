import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import CommandPalette from '@/components/CommandPalette';
import SearchButton from '@/components/SearchButton';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://pitchprep-three.vercel.app'),
  title: 'PitchPrep: pre-meeting investor briefs',
  openGraph: { title: 'PitchPrep: know who you are sitting across from', description: 'Sourced, fact-checked investor briefs with tailored talking points, in about a minute.', type: 'website', siteName: 'PitchPrep', url: '/' },
  twitter: { card: 'summary_large_image', title: 'PitchPrep: know who you are sitting across from', description: 'Sourced, fact-checked investor briefs with tailored talking points, in about a minute.' },
  description: 'Enter an investor and their firm. Get a sourced, fact-checked briefing in under two minutes: recent deals, stated thesis, watch-outs and three tailored talking points.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1f5f4a' };

const nav = [
  { href: '/', label: 'New brief' },
  { href: '/discover', label: 'Discover' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/raise', label: 'Raise' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/briefs', label: 'History' },
  { href: '/settings', label: 'My startup' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
        <header className="no-print border-b border-line bg-bg/90 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-5xl px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold" aria-label="PitchPrep home">
              <span aria-hidden className="inline-block h-6 w-6 rounded-md bg-brand text-brand-ink text-sm grid place-items-center font-sans font-bold">P</span>
              PitchPrep
            </Link>
            <div className="flex w-full items-center gap-2 lg:w-auto"><nav aria-label="Main" className="flex w-full items-center gap-1 overflow-x-auto text-sm lg:w-auto">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="px-2.5 py-1.5 rounded-lg text-muted hover:text-ink hover:bg-brand-soft whitespace-nowrap">{n.label}</Link>
              ))}
            </nav>
            <SearchButton /></div>
          </div>
        </header>
        <CommandPalette />
        <main id="main" className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="no-print border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col sm:flex-row gap-2 justify-between">
            <p>Built from public, professional information only. Every claim is quoted from a source and checked before it is shown. AI by Gemini Flash.</p>
            <p>PitchPrep is a research aid. Verify anything critical before you rely on it.<br /><a className="underline" href="/method">How it works</a> · <a className="underline" href="/evidence">Evidence</a> · <a className="underline" href="/dashboard">Dashboard</a> · <a className="underline" href="https://github.com/siddhantbassi-commits/pitchprep" target="_blank" rel="noopener noreferrer">Source code</a></p>
          </div>
        </footer>
      </body>
    </html>
  );
}
