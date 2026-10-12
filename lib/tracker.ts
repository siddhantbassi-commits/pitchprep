// Pipeline vocabulary and the fit score. Pure, unit-tested.

export const STATUSES = ['researching', 'booked', 'met', 'followed_up', 'in_talks', 'passed'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  researching: 'Researching',
  booked: 'Meeting booked',
  met: 'Met',
  followed_up: 'Follow-up sent',
  in_talks: 'In talks',
  passed: 'Passed',
};

export type FitLevel = 'strong' | 'possible' | 'weak' | 'unknown';
export interface Fit { stage: FitLevel; sector: FitLevel; cheque: FitLevel; rationale?: string }

const POINTS: Record<FitLevel, number> = { strong: 2, possible: 1, unknown: 0, weak: -1 };

/** -3 to +6. A weak dimension drags the score down; unknown is neutral because the sources were silent, not negative. */
export function fitScore(f: Fit | null | undefined): number | null {
  if (!f) return null;
  return POINTS[f.stage] + POINTS[f.sector] + POINTS[f.cheque];
}

export function fitLabel(score: number | null): string {
  if (score == null) return 'No fit read yet';
  if (score >= 4) return 'Strong fit';
  if (score >= 2) return 'Promising';
  if (score >= 0) return 'Unclear';
  return 'Weak fit';
}
