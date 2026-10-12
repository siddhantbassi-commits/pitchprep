// Warm paths: who in the founder's OWN contacts already works at an investor's firm. Everything here is pure and runs in the
// browser; the contacts file is never uploaded. We keep only name, company, role, profile link and connection date. Email
// addresses in the export are dropped on read.

export interface Contact { name: string; company: string; position: string; url: string; connectedOn: string }
export interface WarmMatch { contact: Contact; kind: 'person' | 'firm'; rank: number }

/** Minimal RFC-4180 CSV reader: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/** Reads a LinkedIn "Connections.csv" export (it starts with a few lines of notes before the header). Returns contacts and how many rows were skipped. */
export function parseConnections(text: string): { contacts: Contact[]; skipped: number } {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => r.some((c) => /^first name$/i.test(c.trim())) && r.some((c) => /^company$/i.test(c.trim())));
  if (h < 0) return { contacts: [], skipped: rows.length };
  const head = rows[h].map((c) => c.trim().toLowerCase());
  const at = (n: string) => head.indexOf(n);
  const iF = at('first name'), iL = at('last name'), iU = at('url'), iC = at('company'), iP = at('position'), iD = at('connected on');
  const contacts: Contact[] = []; let skipped = 0;
  for (const r of rows.slice(h + 1)) {
    const name = `${(r[iF] ?? '').trim()} ${(r[iL] ?? '').trim()}`.trim();
    const company = (r[iC] ?? '').trim();
    if (!name || !company) { skipped++; continue; }
    contacts.push({ name, company, position: (r[iP] ?? '').trim(), url: /^https?:\/\//.test((r[iU] ?? '').trim()) ? r[iU].trim() : '', connectedOn: (r[iD] ?? '').trim() });
  }
  return { contacts, skipped };
}

const GENERIC = new Set(['capital', 'ventures', 'venture', 'partners', 'partner', 'fund', 'funds', 'management', 'group', 'investments', 'investment', 'advisors', 'advisory', 'holdings', 'the', 'and', 'llp', 'llc', 'inc', 'ltd', 'limited', 'pvt', 'private', 'india', 'global', 'co', 'company', 'labs']);
const tokens = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
/** The distinctive part of a firm name: "Peak XV Partners" and "Peak XV" both become "peak xv". */
export const firmCore = (s: string) => tokens(s).filter((t) => !GENERIC.has(t)).join(' ');

const SENIOR: [RegExp, number][] = [[/\b(managing (partner|director)|general partner|founding partner)\b/i, 5], [/\bpartner\b/i, 4], [/\b(principal|director|head of)\b/i, 3], [/\b(vice president|vp|investor)\b/i, 2], [/\b(associate|analyst)\b/i, 1]];
const seniority = (position: string) => SENIOR.find(([re]) => re.test(position))?.[1] ?? 0;

/** Contacts who work at the firm (company name matches on its distinctive words) or ARE the named investor. Strongest first. */
export function matchFirm(contacts: Contact[], firm: string, investor?: string): WarmMatch[] {
  const core = firmCore(firm);
  const who = (investor ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const out: WarmMatch[] = [];
  for (const c of contacts) {
    const cc = firmCore(c.company);
    const isPerson = !!who && c.name.toLowerCase().replace(/\s+/g, ' ').trim() === who;
    const firmHit = core.length >= 3 && cc.length >= 3 && (cc === core || ` ${cc} `.includes(` ${core} `) || ` ${core} `.includes(` ${cc} `));
    if (isPerson) out.push({ contact: c, kind: 'person', rank: 100 });
    else if (firmHit) out.push({ contact: c, kind: 'firm', rank: seniority(c.position) });
  }
  return out.sort((a, b) => b.rank - a.rank || a.contact.name.localeCompare(b.contact.name));
}

/** A readable one-liner for a match. */
export function describeMatch(m: WarmMatch, firm: string): string {
  const role = m.contact.position ? `${m.contact.position}, ` : '';
  return m.kind === 'person' ? `You are already connected with ${m.contact.name}${m.contact.connectedOn ? ` (since ${m.contact.connectedOn})` : ''}.` : `${m.contact.name}: ${role}${m.contact.company}${m.contact.connectedOn ? `, connected ${m.contact.connectedOn}` : ''}.`.replace(/, ,/g, ',');
}

// ---------------------------------------------------------------------------------------------------- browser storage

const KEY = 'pp_contacts_v1';
export interface Stored { savedAt: string; sample: boolean; contacts: Contact[] }

export function loadContacts(): Stored | null {
  try { const raw = localStorage.getItem(KEY); if (!raw) return null; const j = JSON.parse(raw) as Stored; return Array.isArray(j.contacts) ? j : null; } catch { return null; }
}
export function saveContacts(s: Stored): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new Event('pp-contacts')); return true; } catch { return false; }
}
export function clearContacts() {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new Event('pp-contacts')); } catch { /* ignore */ }
}

/** Obviously fictional contacts (every name says "sample") at the firms of the example briefs, so the feature can be tried without a real export. */
export const SAMPLE_CONTACTS: Contact[] = [
  { name: 'Aditi Rao (sample)', company: 'Titan Capital', position: 'Associate', url: '', connectedOn: '12 Mar 2024' },
  { name: 'Karan Mehta (sample)', company: 'Forerunner', position: 'Principal', url: '', connectedOn: '02 Sep 2023' },
  { name: 'Meera Iyer (sample)', company: 'Peak XV Partners', position: 'Vice President', url: '', connectedOn: '19 Jan 2025' },
  { name: 'Rohit Sen (sample)', company: 'Fireside Ventures', position: 'Partner', url: '', connectedOn: '07 Jun 2022' },
  { name: 'Nisha Kapoor (sample)', company: 'Blume Ventures', position: 'Investor', url: '', connectedOn: '28 Nov 2024' },
  { name: 'Dev Malhotra (sample)', company: 'Sattva Foods Pvt Ltd', position: 'Operations Lead', url: '', connectedOn: '03 Feb 2021' },
  { name: 'Tara Nair (sample)', company: 'Pune Startup Collective', position: 'Community Manager', url: '', connectedOn: '15 Aug 2023' },
];
