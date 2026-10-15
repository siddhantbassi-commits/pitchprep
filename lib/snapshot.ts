// "Your numbers at a glance": the figures already written in the founder's profile, read by plain rules (no AI) so a chart can be
// drawn from them. Anything the profile does not state is simply absent; nothing is estimated except the one value labelled "implied".

import type { FounderProfile } from './types';

export interface Slice { label: string; value: number }
export interface Ratio { label: string; value: number }
export interface Snapshot {
  mix: Slice[] | null;                              // where revenue comes from, percentages summing to 100
  growth: { label: string; value: number; implied: boolean }[] | null; // revenue a year ago (implied) and now, in Rs crore
  growthNote: string | null;
  ratios: Ratio[];                                  // percentages worth seeing side by side
}

const num = (s: string | undefined) => (s == null ? NaN : parseFloat(s));
const cap = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** "Mix: 62% own website and app, 38% quick-commerce (Blinkit, Zepto)" -> slices. */
export function parseMix(text: string): Slice[] | null {
  const m = text.match(/\bmix:\s*([^.]*(?:\.\d+[^.]*)*)/i);
  if (!m) return null;
  const body = m[1].replace(/\([^)]*\)/g, ' ');
  const slices: Slice[] = [];
  for (const part of body.split(/,|;|\band\b(?=\s+\d)/i)) {
    const p = part.match(/(\d+(?:\.\d+)?)\s*%\s*(.+)/);
    if (p && p[2].trim()) slices.push({ label: cap(p[2]), value: num(p[1]) });
  }
  const sum = slices.reduce((n, s) => n + s.value, 0);
  if (slices.length < 2 || sum > 100.5 || sum < 50) return null;
  return sum < 99.5 ? [...slices, { label: 'Other', value: Math.round((100 - sum) * 10) / 10 }] : slices;
}

export function snapshot(p: FounderProfile): Snapshot {
  const t = `${p.traction}\n${p.geography}\n${p.differentiators}\n${p.stage}`;

  const revenue = num(p.traction.match(/(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*crore[^.]*?(?:run-?rate|revenue)/i)?.[1] ?? p.traction.match(/(?:run-?rate|revenue)[^.]*?(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*crore/i)?.[1]);
  const mult = num(p.traction.match(/(?:up\s+)?(\d+(?:\.\d+)?)\s*x\s+year on year/i)?.[1]);
  const growth = revenue > 0 && mult > 1
    ? [{ label: 'A year ago', value: Math.round((revenue / mult) * 10) / 10, implied: true }, { label: 'Now (run-rate)', value: revenue, implied: false }]
    : null;

  const pick = (re: RegExp) => { const v = num(t.match(re)?.[1]); return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null; };
  const us = t.match(/\b([A-Z][A-Za-z]+) orders[^.]*?(\d+(?:\.\d+)?)\s*%\s*of revenue/);
  const candidates: [string, number | null][] = [
    ['Gross margin', pick(/gross margin\s*(?:is|of)?\s*(\d+(?:\.\d+)?)\s*%/i)],
    ['Contribution margin', pick(/contribution margin\s*(?:is|of)?\s*(?:about|around|roughly)?\s*(\d+(?:\.\d+)?)\s*%/i)],
    ['Customers who reorder within 90 days', pick(/(\d+(?:\.\d+)?)\s*%\s*of customers reorder/i)],
    ['Repeat orders driven by the community', pick(/(\d+(?:\.\d+)?)\s*%\s*of repeat orders/i)],
    [us ? `${us[1]} share of revenue` : '', us ? num(us[2]) : null],
  ];
  const ratios = candidates.filter((c): c is [string, number] => !!c[0] && c[1] != null).map(([label, value]) => ({ label, value }));

  return { mix: parseMix(t), growth, growthNote: growth && mult ? `${mult}x year on year` : null, ratios };
}

/** Is there enough to draw anything worth showing? */
export const hasSnapshot = (s: Snapshot) => !!s.mix || !!s.growth || s.ratios.length >= 2;
