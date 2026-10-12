// Pure text helpers. No network, fully unit-tested.

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\p{L}\p{N}$%₹€£.,'"\- ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^(www|m|amp)\./, '');
  } catch {
    return '';
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Parses an ISO-ish date defensively (real pages emit things like 2026-09-29T24:39:07+05:30). */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const [, y, mo, da] = m;
  const iso = `${y}-${mo}-${da}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/** Publication date from JSON-LD or meta tags. */
export function extractPublishedDate(html: string): string | null {
  const pats = [
    /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
    /name=["'](?:date|pubdate|publish[-_]date|dc\.date)["'][^>]*content=["']([^"']+)["']/i,
    /<time[^>]*datetime=["']([^"']+)["']/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    const d = parseDate(m?.[1]);
    if (d) return d;
  }
  return null;
}

export function extractTitle(html: string): string | null {
  const og = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const t = og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return t ? htmlToText(t).slice(0, 200) : null;
}

/** Keeps paragraphs that mention any of the terms (plus neighbours), capped, so prompts stay small and focused. */
export function relevantExcerpt(text: string, terms: string[], maxChars = 3500): string {
  const paras = text.split('\n').map((p) => p.trim()).filter((p) => p.length > 30);
  const lc = terms.map((t) => t.toLowerCase()).filter(Boolean);
  const hit = new Set<number>();
  paras.forEach((p, i) => {
    const l = p.toLowerCase();
    if (lc.some((t) => l.includes(t))) {
      hit.add(i);
      if (i > 0) hit.add(i - 1);
      if (i + 1 < paras.length) hit.add(i + 1);
    }
  });
  const picked = (hit.size ? [...hit].sort((a, b) => a - b).map((i) => paras[i]) : paras.slice(0, 12)).join('\n');
  return picked.length > maxChars ? picked.slice(0, maxChars) : picked;
}

/** Is `quote` present in `haystack` once whitespace, case and punctuation variants are normalised? */
export function quoteInText(quote: string, haystack: string): boolean {
  const q = normalize(quote);
  if (q.length < 12) return false;
  const h = normalize(haystack);
  if (h.includes(q)) return true;
  // Tolerate an ellipsis or an elided middle: every fragment must appear, in order.
  const frags = quote.split(/…|\.\.\./).map(normalize).filter((f) => f.length >= 12);
  if (frags.length > 1) {
    let from = 0;
    for (const f of frags) {
      const i = h.indexOf(f, from);
      if (i < 0) return false;
      from = i + f.length;
    }
    return true;
  }
  return false;
}

export function daysBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86_400_000);
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
