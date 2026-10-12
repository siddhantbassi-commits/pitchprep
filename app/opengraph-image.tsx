import { ImageResponse } from 'next/og';

export const alt = 'PitchPrep: sourced, fact-checked investor briefs in about a minute';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GREEN = '#1f5f4a';
const INK = '#15181e';
const MUTED = '#5d6470';

const chip = (t: string) => (
  <div style={{ display: 'flex', alignItems: 'center', height: 52, padding: '0 20px', flexShrink: 0, whiteSpace: 'nowrap', border: '2px solid #d9d3c4', borderRadius: 999, fontSize: 24, color: MUTED, background: '#ffffff' }}>{t}</div>
);

// The card a founder sees: one claim, with its source and date. Drawn with plain shapes so it renders anywhere.
const row = (text: string, tag: string) => (
  <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 22px', border: '2px solid #e6e1d6', borderRadius: 16, background: '#ffffff', marginTop: 14 }}>
    <div style={{ display: 'flex', fontSize: 24, color: INK, lineHeight: 1.3 }}>{text}</div>
    <div style={{ display: 'flex', marginTop: 8, fontSize: 20, color: GREEN, fontWeight: 700 }}>{tag}</div>
  </div>
);

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#faf8f3', padding: 64, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 540, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 16, background: GREEN, color: '#ffffff', fontSize: 40, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }}>P</div>
            <div style={{ display: 'flex', marginLeft: 18, fontSize: 40, fontWeight: 700, color: INK }}>PitchPrep</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, color: INK, lineHeight: 1.08 }}>Know who you are sitting across from.</div>
            <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: MUTED, lineHeight: 1.3 }}>A sourced, fact-checked investor brief in about a minute, and a plan for the whole raise.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {chip('Every claim quoted')}
            <div style={{ display: 'flex', width: 12 }} />
            {chip('Dates verified')}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 492, marginLeft: 40, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: MUTED, letterSpacing: 2 }}>IN 20 SECONDS</div>
          {row('Fund VII closed $500M to back early-stage consumer companies.', 'Exact quote · dated · linked to its source')}
          {row('Cheques of $1M to $20M, seed to Series A.', 'Exact quote · dated · linked to its source')}
          {row('Rs 34 crore raise fits the cheque window.', 'Fit: stage strong · cheque strong')}
        </div>
      </div>
    ),
    { ...size },
  );
}
