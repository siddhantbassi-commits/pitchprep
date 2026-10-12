// Turns Google's grounding output into an evidence pack we hold ourselves: real URLs, page text, publication dates.

import type { Evidence, Section } from './types';
import type { GroundedResult } from './gemini';
import { domainOf, extractPublishedDate, extractTitle, htmlToText, relevantExcerpt, isoDay } from './text';
import { resolveRedirect, safeFetch } from './safeFetch';

const TIER2 = new Set([
  'reuters.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'nytimes.com', 'economist.com', 'forbes.com', 'fortune.com', 'cnbc.com',
  'techcrunch.com', 'theinformation.com', 'axios.com', 'businessinsider.com', 'theverge.com', 'semafor.com', 'sifted.eu', 'pitchbook.com',
  'crunchbase.com', 'economictimes.indiatimes.com', 'economictimes.com', 'livemint.com', 'business-standard.com', 'thehindubusinessline.com',
  'moneycontrol.com', 'entrackr.com', 'inc42.com', 'yourstory.com', 'the-ken.com', 'medianama.com', 'financialexpress.com', 'cnbctv18.com',
  'forbesindia.com', 'ndtvprofit.com', 'techinasia.com', 'dealstreetasia.com', 'vccircle.com', 'tracxn.com', 'sec.gov', 'prnewswire.com',
  'businesswire.com', 'globenewswire.com', 'bbc.com', 'theguardian.com', 'scmp.com', 'nikkei.com', 'afr.com', 'straitstimes.com',
]);

export function tierOf(domain: string, firmDomain: string | null): 1 | 2 | 3 {
  if (firmDomain && (domain === firmDomain || domain.endsWith('.' + firmDomain))) return 1;
  if (domain.endsWith('.gov') || domain.endsWith('.gov.in') || domain === 'sec.gov') return 1;
  for (const d of TIER2) if (domain === d || domain.endsWith('.' + d)) return 2;
  return 3;
}

/** Finds the firm's own domain among the cited sources, e.g. "Peak XV Partners" -> peakxv.com. */
export function guessFirmDomain(firm: string, domains: string[]): string | null {
  const stop = new Set(['partners', 'capital', 'ventures', 'venture', 'fund', 'funds', 'vc', 'management', 'group', 'the', 'and', 'investments', 'investment', 'holdings', 'labs', 'advisors']);
  const toks = firm.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((t) => t && !stop.has(t));
  if (!toks.length) return null;
  const joined = toks.join('');
  const longest = [...toks].sort((a, b) => b.length - a.length)[0];
  for (const d of domains) {
    const stem = d.split('.').slice(0, -1).join('').replace(/[^a-z0-9]/g, '');
    if (stem === joined || stem.includes(joined)) return d;
  }
  if (longest.length >= 5) for (const d of domains) if (d.split('.')[0].includes(longest)) return d;
  return null;
}

function canonical(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export interface EvidenceInput {
  results: { section: Section; g: GroundedResult }[];
  firm: string;
  terms: string[]; // name tokens used to pick relevant paragraphs
  userContext?: string;
  maxItems?: number;
}

export async function buildEvidence(input: EvidenceInput): Promise<{ evidence: Evidence[]; firmDomain: string | null; notes: string[] }> {
  const notes: string[] = [];
  // 1. Unique chunks across all collectors, with the sentences Google attributes to each.
  const byUri = new Map<string, { uri: string; title: string; segments: Set<string>; hits: number }>();
  for (const { g } of input.results) {
    g.chunks.forEach((c, idx) => {
      if (!c.uri) return;
      const e = byUri.get(c.uri) ?? { uri: c.uri, title: c.title, segments: new Set<string>(), hits: 0 };
      for (const s of g.supports) if (s.chunkIdx.includes(idx) && s.text) { e.segments.add(s.text); e.hits++; }
      byUri.set(c.uri, e);
    });
  }
  // 2. Resolve redirects to real article URLs.
  const resolved = await pool([...byUri.values()], 10, async (c) => ({ c, url: await resolveRedirect(c.uri) }));
  const byUrl = new Map<string, { url: string; title: string; segments: Set<string>; hits: number }>();
  for (const { c, url } of resolved) {
    if (!url) continue;
    const key = canonical(url);
    const e = byUrl.get(key) ?? { url: key, title: c.title, segments: new Set<string>(), hits: 0 };
    c.segments.forEach((s) => e.segments.add(s));
    e.hits += c.hits;
    byUrl.set(key, e);
  }
  const domains = [...new Set([...byUrl.values()].map((e) => domainOf(e.url)).filter(Boolean))];
  const firmDomain = guessFirmDomain(input.firm, domains);

  // 3. Prioritise (tier, then how often Google leaned on it) and fetch the pages.
  const ranked = [...byUrl.values()]
    .map((e) => ({ ...e, domain: domainOf(e.url), tier: tierOf(domainOf(e.url), firmDomain) }))
    .sort((a, b) => a.tier - b.tier || b.hits - a.hits)
    .slice(0, input.maxItems ?? 16);

  const now = new Date().toISOString();
  const fetched = await pool(ranked, 8, async (e) => {
    const page = await safeFetch(e.url, { timeoutMs: 7000 });
    let text = '';
    let publishedAt: string | null = null;
    let title = e.title;
    let full = false;
    if (page && page.html) {
      publishedAt = extractPublishedDate(page.html);
      title = extractTitle(page.html) ?? title;
      const body = htmlToText(page.html);
      const ex = relevantExcerpt(body, input.terms, 3200);
      if (ex.length > 200) { text = ex; full = true; }
    }
    if (!full) text = [...e.segments].join('\n'); // paywalled or blocked: only Google's attributed excerpt is available
    return { e, text, publishedAt, title, full, finalUrl: page?.url ?? e.url };
  });

  const evidence: Evidence[] = [];
  for (const f of fetched) {
    if (!f.text || f.text.length < 40) continue;
    evidence.push({
      id: '', url: f.finalUrl, domain: f.e.domain, title: f.title || f.e.domain, publishedAt: f.publishedAt,
      tier: f.e.tier, text: f.text, origin: 'grounding', fullFetch: f.full, fetchedAt: now,
    });
  }

  // 4. The firm's own site (portfolio / news pages), tier 1, best effort.
  if (firmDomain) {
    try {
      const home = await safeFetch(`https://${firmDomain}/`, { timeoutMs: 6000 });
      if (home?.html) {
        const links = [...home.html.matchAll(/href=["']([^"'#]+)["']/gi)]
          .map((m) => { try { return new URL(m[1], home.url); } catch { return null; } })
          .filter((u): u is URL => !!u && domainOf(u.toString()) === firmDomain && /(news|portfolio|blog|insights|updates|press|companies|stories)/i.test(u.pathname))
          .map((u) => canonical(u.toString()));
        const uniq = [...new Set(links)].filter((u) => !evidence.some((e) => canonical(e.url) === u)).slice(0, 2);
        const pages = await pool(uniq, 2, async (u) => ({ u, p: await safeFetch(u, { timeoutMs: 6000 }) }));
        for (const { u, p } of pages) {
          if (!p?.html) continue;
          const ex = relevantExcerpt(htmlToText(p.html), input.terms, 3200);
          if (ex.length > 200) {
            evidence.push({
              id: '', url: p.url || u, domain: firmDomain, title: extractTitle(p.html) ?? firmDomain, publishedAt: extractPublishedDate(p.html),
              tier: 1, text: ex, origin: 'site', fullFetch: true, fetchedAt: now,
            });
          }
        }
      } else notes.push(`Could not read the firm's website (${firmDomain}).`);
    } catch {
      notes.push(`Could not read the firm's website (${firmDomain}).`);
    }
  } else {
    notes.push("Could not identify the firm's own website from the sources found.");
  }

  // 5. Anything Priya pasted herself, labelled as hers.
  if (input.userContext?.trim()) {
    evidence.push({
      id: '', url: 'user-provided', domain: 'user-provided', title: 'Pasted by you', publishedAt: isoDay(new Date()), tier: 2,
      text: input.userContext.trim().slice(0, 6000), origin: 'user', fullFetch: true, fetchedAt: now,
    });
  }

  evidence.forEach((e, i) => (e.id = `E${i + 1}`));
  return { evidence, firmDomain, notes };
}
