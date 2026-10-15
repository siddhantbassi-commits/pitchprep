// Original vector illustrations of millet (foxtail millet heads, a bowl of grain, leaves). Decorative only; drawn in the site's own
// palette so they follow light and dark mode. Positions come from a seeded generator so server and browser always agree.

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const GRAIN = ['var(--gold)', 'var(--gold-deep)', 'var(--gold-soft)'];

/** One millet head: a curved stem with a dense, slightly drooping head of grains and two leaves. Drawn upright at (0,0), growing up. */
function Panicle({ x, y, rot = 0, scale = 1, seed = 1, sway = true }: { x: number; y: number; rot?: number; scale?: number; seed?: number; sway?: boolean }) {
  const r = rng(seed);
  // stem: from (0,0) up to the base of the head, curving right; head continues the curve and droops
  const stem = 'M0,0 C-6,-60 6,-120 16,-170';
  const headBase = { x: 16, y: -170 };
  const grains: React.ReactElement[] = [];
  const N = 62;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // axis of the head: leans right then droops
    const ax = headBase.x + 26 * t + 22 * t * t;
    const ay = headBase.y - 84 * t + 16 * t * t;
    const ang = (Math.atan2(-84 + 32 * t, 26 + 44 * t) * 180) / Math.PI + 90;
    const w = Math.pow(Math.sin(Math.PI * (0.12 + 0.82 * t)), 0.75) * 10.5;
    for (const side of [-1, 1]) {
      const off = side * (w * (0.55 + 0.45 * r()));
      const gx = ax + off * Math.cos((ang * Math.PI) / 180) + (r() - 0.5) * 2;
      const gy = ay + off * Math.sin((ang * Math.PI) / 180) + (r() - 0.5) * 2;
      grains.push(<ellipse key={`${i}-${side}`} cx={gx.toFixed(1)} cy={gy.toFixed(1)} rx="3.3" ry="5.1" transform={`rotate(${(ang + side * 12 + (r() - 0.5) * 16).toFixed(0)} ${gx.toFixed(1)} ${gy.toFixed(1)})`} fill={GRAIN[Math.floor(r() * 3)]} opacity={0.92} />);
    }
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <g className={sway ? 'sway' : undefined}>
        <path d={stem} stroke="var(--leaf)" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M2,-40 C-30,-52 -62,-48 -86,-30 C-58,-24 -26,-26 2,-40Z" fill="var(--leaf)" opacity="0.9" />
        <path d="M8,-92 C40,-112 76,-112 100,-96 C72,-84 38,-82 8,-92Z" fill="var(--leaf)" opacity="0.75" />
        {grains}
      </g>
    </g>
  );
}

/** A bowl of millet with a mound of grain and a little steam. */
function Bowl({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const r = rng(7);
  const grains: React.ReactElement[] = [];
  for (let i = 0; i < 190; i++) {
    const gx = -92 + r() * 184;
    const h = 62 * Math.sqrt(Math.max(0, 1 - Math.pow(gx / 96, 2)));
    const gy = -r() * h + 2;
    grains.push(<ellipse key={i} cx={gx.toFixed(1)} cy={gy.toFixed(1)} rx="3.1" ry="2.5" transform={`rotate(${(r() * 180).toFixed(0)} ${gx.toFixed(1)} ${gy.toFixed(1)})`} fill={GRAIN[Math.floor(r() * 3)]} />);
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className="float" opacity="0.55" fill="none" stroke="var(--muted)" strokeWidth="3" strokeLinecap="round">
        <path d="M-30,-86 C-42,-104 -18,-112 -30,-132" /><path d="M0,-92 C-12,-112 12,-120 0,-142" /><path d="M30,-86 C18,-104 42,-112 30,-130" />
      </g>
      <ellipse cx="0" cy="2" rx="104" ry="17" fill="var(--gold-soft)" />
      {grains}
      <path d="M-112,0 Q-112,94 0,94 Q112,94 112,0 Q0,22 -112,0Z" fill="var(--brand)" />
      <path d="M-112,0 Q0,22 112,0" stroke="var(--brand-ink)" strokeOpacity="0.28" strokeWidth="3" fill="none" />
      <ellipse cx="0" cy="96" rx="52" ry="7" fill="var(--brand)" opacity="0.35" />
    </g>
  );
}

/** The home page hero: a bowl of millet between two swaying heads, with grains drifting. */
export function MilletHero({ className = '' }: { className?: string }) {
  const r = rng(21);
  const drift = Array.from({ length: 16 }, (_, i) => ({ cx: 30 + r() * 420, cy: 20 + r() * 220, k: i % 3, d: (r() * 4).toFixed(1) }));
  return (
    <svg viewBox="-10 0 500 380" className={`millet-art hero-art ${className}`} aria-hidden="true" focusable="false">
      <ellipse cx="240" cy="205" rx="212" ry="168" fill="var(--brand-soft)" />
      <ellipse cx="240" cy="338" rx="160" ry="12" fill="var(--brand)" opacity="0.14" />
      {drift.map((g, i) => <ellipse key={i} className="float" style={{ animationDelay: `${g.d}s` }} cx={g.cx.toFixed(0)} cy={g.cy.toFixed(0)} rx="3.2" ry="5" transform={`rotate(${(i * 37) % 180} ${g.cx.toFixed(0)} ${g.cy.toFixed(0)})`} fill={GRAIN[g.k]} opacity="0.7" />)}
      <Panicle x={104} y={330} rot={-6} scale={0.95} seed={3} />
      <Panicle x={372} y={330} rot={5} scale={1.0} seed={11} />
      <Bowl x={240} y={242} scale={0.9} />
    </svg>
  );
}

/** A thin rule with a small millet head in the middle. */
export function GrainDivider({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 30" preserveAspectRatio="xMidYMid meet" className={`millet-art block h-6 w-full ${className}`} aria-hidden="true" focusable="false">
      <line x1="0" y1="15" x2="168" y2="15" stroke="var(--line)" strokeWidth="1.5" />
      <line x1="232" y1="15" x2="400" y2="15" stroke="var(--line)" strokeWidth="1.5" />
      <g transform="translate(200 27) scale(0.115)"><Panicle x={0} y={0} seed={5} sway={false} /></g>
    </svg>
  );
}

const iconProps = { viewBox: '0 0 32 32', width: 28, height: 28, 'aria-hidden': true, focusable: 'false' as const, className: 'millet-art shrink-0' };
export function SprigIcon() {
  return (
    <svg {...iconProps}><path d="M16 29 C15 21 16 13 19 4" stroke="var(--leaf)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {[0, 1, 2, 3, 4, 5].map((i) => <g key={i}><ellipse cx={18.2 - i * 0.2 + 3} cy={7 + i * 3.4} rx="2.1" ry="3" transform={`rotate(25 ${21.2 - i * 0.2} ${7 + i * 3.4})`} fill="var(--gold)" /><ellipse cx={15 - i * 0.2} cy={9 + i * 3.4} rx="2.1" ry="3" transform={`rotate(-25 ${15 - i * 0.2} ${9 + i * 3.4})`} fill="var(--gold-deep)" /></g>)}
    </svg>
  );
}
export function BowlIcon() {
  return (
    <svg {...iconProps}><path d="M4 16 Q4 27 16 27 Q28 27 28 16Z" fill="var(--brand)" />
      {[[9, 14], [13, 12], [17, 11], [21, 12], [24, 14], [15, 14], [19, 14], [11, 15]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.1" fill={GRAIN[i % 3]} />)}
    </svg>
  );
}
export function LeafIcon() {
  return (
    <svg {...iconProps}><path d="M5 27 C5 12 15 5 28 5 C28 19 20 27 5 27Z" fill="var(--leaf)" opacity="0.9" /><path d="M7 25 C13 18 18 14 24 9" stroke="var(--brand-ink)" strokeOpacity="0.5" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
  );
}
