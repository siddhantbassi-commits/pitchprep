import type { BriefResult } from './types';

/** The brief as a short spoken script: who, what to open with, what to know, what to watch for, what to ask. Pure and tested. */
export function briefToSpeech(r: BriefResult): string[] {
  const out: string[] = [];
  const who = [r.investor.name, r.investor.role, r.investor.firm].filter(Boolean).join(', ');
  out.push(`Briefing for your meeting with ${who}.`);
  const s = r.synthesis;
  if (s) {
    out.push('In twenty seconds.');
    s.skim.forEach((x) => out.push(x));
    out.push('Three ways to open.');
    s.talkingPoints.forEach((t, i) => out.push(`Number ${i + 1}. ${t.title}. You could say: ${t.opener}`));
  }
  const watch = r.claims.filter((c) => c.verified && c.section === 'context' && (c.severity === 'high' || c.severity === 'watch')).slice(0, 2);
  out.push(watch.length ? 'Be careful.' : 'No reported controversies were found in public sources.');
  watch.forEach((c) => out.push(c.text));
  if (s?.questionsToAsk?.length) {
    out.push('Questions to ask them.');
    s.questionsToAsk.slice(0, 3).forEach((q) => out.push(q.question));
  }
  if (s?.likelyQuestions?.length) {
    out.push('Expect them to ask.');
    s.likelyQuestions.slice(0, 3).forEach((q) => out.push(q.question));
  }
  out.push('That is your briefing. Good luck.');
  return out.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
