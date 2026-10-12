import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'PitchPrep: pre-meeting investor briefs',
  description: 'Enter an investor and their firm. Get a sourced, fact-checked briefing in under two minutes: recent deals, stated thesis, watch-outs and three tailored talking points.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1f5f4a' };

const nav = [
  { href: '/', label: 'New brief' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/briefs', label: 'History' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/method', label: 'How it works' },
  { href: '/settings', label: 'My startup' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col">
        <header className="no-print border-b border-line bg-bg/90 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold" aria-label="PitchPrep home">
              <span aria-hidden className="inline-block h-6 w-6 rounded-md bg-brand text-brand-ink text-sm grid place-items-center font-sans font-bold">P</span>
              PitchPrep
            </Link>
            <nav aria-label="Main" className="flex items-center gap-1 overflow-x-auto text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="px-2.5 py-1.5 rounded-lg text-muted hover:text-ink hover:bg-brand-soft whitespace-nowrap">{n.label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="no-print border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col sm:flex-row gap-2 justify-between">
            <p>Built from public, professional information only. Every claim is quoted from a source and checked before it is shown. AI by Gemini Flash.</p>
            <p>PitchPrep is a research aid. Verify anything critical before you rely on it.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
