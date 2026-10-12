// Server-side fetcher for untrusted URLs: SSRF guard, redirect re-checking, size and time caps, robots.txt.

import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'PitchPrepBot/1.0 (+pre-meeting research; respects robots.txt)';
const MAX_BYTES = 700_000;

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb');
  }
  return true;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('blocked: protocol');
  if (u.username || u.password) throw new Error('blocked: credentials in URL');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('blocked: local host');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('blocked: private address');
    return u;
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('blocked: resolves to private address');
  return u;
}

const robotsCache = new Map<string, { disallow: string[]; at: number }>();

async function robotsAllows(u: URL): Promise<boolean> {
  const key = u.origin;
  let entry = robotsCache.get(key);
  if (!entry || Date.now() - entry.at > 3_600_000) {
    let disallow: string[] = [];
    try {
      const r = await fetch(`${u.origin}/robots.txt`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(3000), redirect: 'follow' });
      if (r.ok) disallow = parseRobots(await r.text());
    } catch {
      /* fail open: an unreachable robots.txt is not a prohibition */
    }
    entry = { disallow, at: Date.now() };
    robotsCache.set(key, entry);
  }
  return !entry.disallow.some((p) => p && (u.pathname + u.search).startsWith(p));
}

export function parseRobots(txt: string): string[] {
  const out: string[] = [];
  let applies = false;
  for (const raw of txt.split('\n')) {
    const line = raw.split('#')[0].trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, k, v] = m;
    if (/^user-agent$/i.test(k)) applies = v === '*' || /pitchprep/i.test(v);
    else if (applies && /^disallow$/i.test(k) && v) out.push(v);
  }
  return out;
}

export interface Fetched {
  url: string; // final URL after redirects
  status: number;
  html: string;
}

/** Follows redirects manually so every hop is re-validated. Returns null on any failure; never throws. */
export async function safeFetch(rawUrl: string, opts: { timeoutMs?: number; checkRobots?: boolean } = {}): Promise<Fetched | null> {
  const timeoutMs = opts.timeoutMs ?? 7000;
  const deadline = Date.now() + timeoutMs;
  try {
    let current = rawUrl;
    for (let hop = 0; hop < 5; hop++) {
      const u = await assertPublicUrl(current);
      if (opts.checkRobots !== false && !(await robotsAllows(u))) return null;
      const left = deadline - Date.now();
      if (left <= 0) return null;
      const res = await fetch(u, {
        redirect: 'manual',
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(left),
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        current = new URL(loc, u).toString();
        continue;
      }
      if (!res.ok) return { url: u.toString(), status: res.status, html: '' };
      const ct = res.headers.get('content-type') ?? '';
      if (!/text\/html|application\/xhtml|text\/plain/i.test(ct)) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      reader.cancel().catch(() => {});
      return { url: u.toString(), status: res.status, html: Buffer.concat(chunks).toString('utf8') };
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolves a Google grounding redirect to the real article URL without downloading the page. */
export async function resolveRedirect(uri: string): Promise<string | null> {
  try {
    const u = new URL(uri);
    if (!/(^|\.)vertexaisearch\.cloud\.google\.com$|(^|\.)google\.com$/.test(u.hostname)) return uri; // already a real URL
    const res = await fetch(uri, { redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) });
    const loc = res.headers.get('location');
    if (!loc) return null;
    return new URL(loc, uri).toString();
  } catch {
    return null;
  }
}
