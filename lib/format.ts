import type { Claim, Confidence } from './types';

export const KIND_LABEL: Record<string, string> = {
  investment: 'New investment', exit: 'Exit', milestone: 'Portfolio milestone', statement: 'Said', retreat: 'Pulling back', pivot: 'Pivot',
  controversy: 'Reported controversy', portfolio_trouble: 'Portfolio trouble', fund: 'Fund', firm_fact: 'Firm fact',
};

export const DROP_LABEL: Record<string, string> = {
  outside_90_day_window: 'Older than 90 days',
  deal_without_date: 'No date found, so we cannot confirm it is recent',
  quote_not_found_in_source: 'Quote could not be matched to the source text',
  stale_over_24_months: 'Older than 24 months',
  judge_unsupported: 'Fact-check found the source did not support it',
  duplicate: 'Duplicate',
  source_not_about_subject: 'Source is not about this investor',
  no_valid_evidence: 'No valid source',
  no_quote: 'No supporting quote',
  date_in_future: 'Date is in the future',
};

export const CONF_LABEL: Record<Confidence, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence', none: 'Nothing found' };

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'Date not stated';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Always India time, so the server render and the browser render agree (no hydration mismatch) and the label is explicit.
export function fmtDateTime(iso: string): string {
  return `${new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`;
}

export function fmtSecs(ms: number | null | undefined): string {
  if (!ms && ms !== 0) return '-';
  return ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${(ms / 1000).toFixed(0)}s`;
}

export function claimDate(c: Claim): string {
  return c.eventDate ? `${fmtDate(c.eventDate)}${c.dateSource === 'article' ? ' (article date)' : ''}` : 'Date not stated';
}
