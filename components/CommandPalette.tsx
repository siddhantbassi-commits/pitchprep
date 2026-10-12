'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Item { id: string; label: string; hint: string; href: string }

const PAGES: Item[] = [
  { id: 'p-new', label: 'New brief', hint: 'Research an investor', href: '/' },
  { id: 'p-pipe', label: 'Pipeline', hint: 'Every investor, ranked by fit', href: '/pipeline' },
  { id: 'p-meet', label: 'Meetings', hint: 'Calendar and email nudges', href: '/meetings' },
  { id: 'p-hist', label: 'History', hint: 'Your briefs', href: '/briefs' },
  { id: 'p-dash', label: 'Dashboard', hint: 'Time, cost and quality', href: '/dashboard' },
  { id: 'p-how', label: 'How it works', hint: 'Method and limits', href: '/method' },
  { id: 'p-evid', label: 'Evidence', hint: 'Evaluation results', href: '/evidence' },
  { id: 'p-set', label: 'My startup', hint: 'Founder profile, export, delete', href: '/settings' },
];

/** Press ⌘K or Ctrl+K anywhere. Type to jump to a page or straight to an investor's brief. */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [investors, setInvestors] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); opener.current = document.activeElement as HTMLElement; setOpen((o) => !o); }
    };
    const onOpen = () => { opener.current = document.activeElement as HTMLElement; setOpen(true); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('pp:palette', onOpen);
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('pp:palette', onOpen); };
  }, []);

  useEffect(() => {
    if (!open) { opener.current?.focus?.(); return; }
    setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 0);
    fetch('/api/pipeline', { cache: 'no-store' }).then((r) => r.json()).then((j) => setInvestors((j.items ?? []).map((i: { briefId: string; name: string; firm: string; status: string }) => ({ id: i.briefId, label: i.name, hint: `${i.firm} · ${i.status.replace('_', ' ')}`, href: `/brief/${i.briefId}` })))).catch(() => {});
  }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = [...investors, ...PAGES];
    return (t ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(t)) : all).slice(0, 9);
  }, [q, investors]);

  function go(i: Item | undefined) { if (!i) return; setOpen(false); router.push(i.href); }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[sel]); }
    else if (e.key === 'Tab') { e.preventDefault(); input.current?.focus(); }
  }

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-label="Search and jump" className="card w-full max-w-lg overflow-hidden shadow-xl" onKeyDown={onKey}>
        <input ref={input} className="w-full border-b border-line bg-surface px-4 py-3 text-base outline-none" placeholder="Jump to a page or an investor…" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }}
          role="combobox" aria-expanded="true" aria-controls="pp-results" aria-activedescendant={results[sel] ? `pp-${results[sel].id}` : undefined} aria-label="Search" />
        <ul id="pp-results" role="listbox" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing matches &ldquo;{q}&rdquo;.</li>}
          {results.map((r, i) => (
            <li key={r.id} id={`pp-${r.id}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(r)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 ${i === sel ? 'bg-brand-soft' : ''}`}>
              <span className="font-medium">{r.label}</span><span className="truncate text-sm text-muted">{r.hint}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
