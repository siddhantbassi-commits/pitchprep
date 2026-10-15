// Small, dependency-free SVG charts. Every chart has a text equivalent (role="img" label plus a listed table), so nothing is colour-only.

const COLORS = ['var(--brand)', 'var(--gold)', 'var(--blue)', 'var(--muted)', 'var(--leaf)'];

export interface Slice { label: string; value: number; shown?: string }

/** A donut of shares. `value` can be any positive unit; the ring shows each share of the total. */
export function Donut({ slices, ariaLabel, centre, legend = true, size = 168, colors = COLORS }: { slices: Slice[]; ariaLabel: string; centre?: { big: string; small: string }; legend?: boolean; size?: number; colors?: string[] }) {
  const total = slices.reduce((n, s) => n + Math.max(0, s.value), 0);
  const R = 52, C = 2 * Math.PI * R, GAP = slices.filter((s) => s.value > 0).length > 1 ? 2.4 : 0;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={ariaLabel} className="shrink-0">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="20" />
        {total > 0 && slices.map((s, i) => {
          if (s.value <= 0) return null;
          const len = (s.value / total) * C;
          const el = <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={colors[i % colors.length]} strokeWidth="20" strokeDasharray={`${Math.max(0, len - GAP)} ${C - Math.max(0, len - GAP)}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
          offset += len;
          return el;
        })}
        {centre && (<><text x="70" y="68" textAnchor="middle" fontSize="23" fontFamily="Georgia, serif" fontWeight="700" fill="var(--ink)">{centre.big}</text><text x="70" y="85" textAnchor="middle" fontSize="9.5" fill="var(--muted)">{centre.small}</text></>)}
      </svg>
      {legend && (
        <ul className="min-w-[9rem] space-y-1.5 text-sm">
          {slices.map((s, i) => (
            <li key={s.label} className="flex items-start gap-2"><span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[i % colors.length] }} /><span><span className="font-medium">{s.shown ?? `${s.value}%`}</span> <span className="text-muted">{s.label}</span></span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface Col { label: string; value: number; hatched?: boolean }

/** Vertical bars with the value above each. A hatched bar means "worked out from other figures, not stated". */
export function Columns({ items, unit, ariaLabel, badge }: { items: Col[]; unit: string; ariaLabel: string; badge?: string }) {
  const W = 260, H = 170, PAD = 28, base = H - 30, max = Math.max(...items.map((i) => i.value), 1);
  const bw = 66, gap = (W - items.length * bw) / (items.length + 1);
  return (
    <div>
    {badge && <span className="chip mb-1 bg-brand-soft text-brand border-transparent">{badge}</span>}
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[22rem]" role="img" aria-label={ariaLabel}>
      <defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--gold-soft)" /><rect width="3" height="7" fill="var(--gold)" /></pattern></defs>
      <line x1="10" x2={W - 10} y1={base} y2={base} stroke="var(--line)" strokeWidth="1.5" />
      {items.map((it, i) => {
        const h = Math.max(4, ((base - PAD) * it.value) / max);
        const x = gap + i * (bw + gap);
        return (
          <g key={it.label}>
            <rect className="grow-y" style={{ animationDelay: `${i * 0.15}s` }} x={x} y={base - h} width={bw} height={h} rx="7" fill={it.hatched ? 'url(#hatch)' : 'var(--brand)'} stroke={it.hatched ? 'var(--gold)' : 'none'} strokeWidth="1.5" />
            <text x={x + bw / 2} y={base - h - 7} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">{it.value}{unit ? ` ${unit}` : ''}</text>
            <text x={x + bw / 2} y={base + 16} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{it.label}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** Horizontal percentage bars, one row per figure. */
export function PercentBars({ rows, ariaLabel }: { rows: { label: string; value: number }[]; ariaLabel: string }) {
  return (
    <ul className="space-y-3" aria-label={ariaLabel}>
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm"><span>{r.label}</span><span className="font-semibold tabular-nums">{r.value}%</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="grow-x h-2.5 rounded-full" style={{ width: `${Math.min(100, r.value)}%`, background: COLORS[i % 2 === 0 ? 0 : 1], animationDelay: `${i * 0.1}s` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
