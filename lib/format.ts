import type { Claim, Confidence } from './types';

export const KIND_LABEL: Record<string, string> = {
  investment: 'New investment', exit: 'Exit', milestone: 'Portfolio milestone', statement: 'Said', retreat: 'Pulling back', pivot: 'Pivot',
  controversy: 'Reported controversy', portfolio_trouble: 'Portfolio trouble', people_change: 'Team change', fund: 'Fund', firm_fact: 'Firm fact',
};

export const DROP_LABEL: Record<string, string> = {
  outside_90_day_window: 'Older than 90 days',
  deal_without_date: 'No date found, so we cannot confirm it is recent',
  quote_not_found_in_source: 'Quote could not be matched to the source text',
  stale_over_24_months: 'Older than 24 months',
  judge_unsupported: 'Fact-check found the source did not support it',
  vague_wording: 'Wording too vague to stand on its own',
  duplicate: 'Duplicate',
  source_not_about_subject: 'Source is not about this investor',
  no_valid_evidence: 'No valid source',
  no_quote: 'No supporting quote',
  date_in_future: 'Date is in the future',
};

export const CONF_LABEL: Record<Confidence, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence', none: 'Nothing found' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

// Dates are formatted by hand, not with Intl: server and browser ICU data differ ("Sep" vs "Sept"), which breaks hydration.
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'Date not stated';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'Date not stated';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Always India time (UTC+5:30) with an explicit label, so everyone sees the same thing.
export function fmtDateTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
}

export function fmtDayTime(iso: string): string {
  const d = new Date(Date.parse(iso) + 5.5 * 3600_000);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
}

export function fmtSecs(ms: number | null | undefined): string {
  if (!ms && ms !== 0) return '-';
  return ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${(ms / 1000).toFixed(0)}s`;
}

export function claimDate(c: Claim): string {
  return c.eventDate ? `${fmtDate(c.eventDate)}${c.dateSource === 'article' ? ' (article date)' : ''}` : 'Date not stated';
}
