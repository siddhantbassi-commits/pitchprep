// Practice progress across mock rounds. Pure: sessions in, plain-language insight out. No model involved.

export type DimKey = 'directness' | 'evidence' | 'candour' | 'brevity';
export const DIM_LABEL: Record<DimKey, string> = { directness: 'Directness', evidence: 'Evidence', candour: 'Candour', brevity: 'Brevity' };

export interface SessionLite {
  id: string; created_at: string; difficulty: string; overall: number | null; investor_name: string; firm: string;
  score: { dimensions?: { key: DimKey; score: number }[]; flags?: string[] } | null;
}

export interface Progress {
  rounds: number;
  points: { id: string; at: string; overall: number; investor: string; difficulty: string }[];
  dims: { key: DimKey; label: string; average: number; first: number; last: number; low: number }[];
  weak: DimKey[]; // dimensions scoring 2 or lower in at least half of the rounds
  roundsWithFigureFlags: number;
  change: number | null; // last overall minus first overall
  insights: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Oldest first; ignores sessions that were never scored. */
export function progress(sessions: SessionLite[]): Progress {
  const s = [...sessions].filter((x) => x.overall != null && x.score?.dimensions?.length).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const points = s.map((x) => ({ id: x.id, at: x.created_at, overall: x.overall as number, investor: x.investor_name, difficulty: x.difficulty }));
  const keys: DimKey[] = ['directness', 'evidence', 'candour', 'brevity'];
  const dims = keys.map((key) => {
    const vals = s.map((x) => x.score!.dimensions!.find((d) => d.key === key)?.score).filter((v): v is number => typeof v === 'number');
    return { key, label: DIM_LABEL[key], average: vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : 0, first: vals[0] ?? 0, last: vals[vals.length - 1] ?? 0, low: vals.filter((v) => v <= 2).length };
  });
  const weak = dims.filter((d) => s.length > 0 && d.low * 2 >= s.length).map((d) => d.key);
  const roundsWithFigureFlags = s.filter((x) => (x.score?.flags ?? []).length > 0).length;
  const change = points.length >= 2 ? points[points.length - 1].overall - points[0].overall : null;

  const insights: string[] = [];
  if (points.length === 0) return { rounds: 0, points, dims, weak, roundsWithFigureFlags, change, insights: ['Run your first mock meeting to start tracking progress.'] };
  if (points.length === 1) insights.push(`One round so far, scoring ${points[0].overall}/100. A second round shows whether practice is working.`);
  else insights.push(change! > 0 ? `Up ${change} points since your first round (${points[0].overall} to ${points[points.length - 1].overall}).` : change! < 0 ? `Down ${Math.abs(change!)} points since your first round (${points[0].overall} to ${points[points.length - 1].overall}). Tough investors and new topics can do that; check which dimension moved.` : `Level at ${points[0].overall}/100 since your first round.`);
  for (const k of weak) {
    const d = dims.find((x) => x.key === k)!;
    insights.push(`${d.label} scored 2 or lower in ${d.low} of ${s.length} rounds. ${k === 'candour' ? 'Practise naming the weak spot first, then your plan for it.' : k === 'directness' ? 'Practise answering in the first sentence, then adding the detail.' : k === 'evidence' ? 'Practise attaching one real number or customer to every claim.' : 'Practise stopping after the point is made.'}`);
  }
  const best = [...dims].sort((a, b) => b.average - a.average)[0];
  if (s.length >= 2 && best.average >= 4) insights.push(`${best.label} is your strength, averaging ${best.average}/5.`);
  if (roundsWithFigureFlags > 0) insights.push(`A figure that did not match your profile came up in ${roundsWithFigureFlags} of ${s.length} rounds. Update My startup if the profile is out of date, or learn the real number.`);
  return { rounds: s.length, points, dims, weak, roundsWithFigureFlags, change, insights };
}
