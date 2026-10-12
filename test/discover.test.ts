import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, groupByDeal } from '../lib/discoverView';
import { audit, collectorPrompts, rank, verifyDiscovery, type Candidate } from '../lib/discover';
import { DEMO_PROFILE } from '../lib/demoProfile';
import type { Evidence } from '../lib/types';

const TODAY = '2026-10-12';
const ev = (id: string, text: string, o: Partial<Evidence> = {}): Evidence => ({ id, url: `https://news.test/${id}`, domain: 'news.test', title: id, publishedAt: '2026-09-20', tier: 2, text, origin: 'grounding', fullFetch: true, fetchedAt: TODAY, ...o });
const deal = (o: Record<string, unknown> = {}) => ({ company: 'Millet Co', round: 'Seed', amount: '$3 million', date: '2026-09-20', quote: 'Fireside Ventures led a $3 million seed round in Millet Co', evidenceId: 'E1', sectorMatch: true, stageMatch: true, ...o });
const cand = (o: Record<string, unknown> = {}) => ({ firm: 'Fireside Ventures', partner: 'Kanwaljit Singh', deals: [deal()], chequeNote: null, chequeQuote: null, chequeEvidenceId: null, ...o });
const E = [ev('E1', 'Bengaluru: Fireside Ventures led a $3 million seed round in Millet Co, a ready-to-cook brand, on 20 September.')];
const run = (candidates: unknown[], evidence = E) => verifyDiscovery({ candidates } as never, evidence, TODAY);

test('a verified, dated, quoted deal makes it through and ranks', () => {
  const r = run([cand()]);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].deals[0].url, 'https://news.test/E1');
  assert.equal(r.dealsKept, 1);
});

test('a quote that is not in the source is dropped, and a firm with no surviving deal disappears', () => {
  const r = run([cand({ deals: [deal({ quote: 'Fireside Ventures led a $30 million Series B in Millet Co' })] })]);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.dropped.quote_not_in_source, 1);
});

test('the quote must name the firm, so an unrelated sentence cannot be attributed to it', () => {
  const ev2 = [ev('E1', 'Totally Different Capital led a $3 million seed round in Millet Co on 20 September.')];
  const r = run([cand({ deals: [deal({ quote: 'led a $3 million seed round in Millet Co on 20 September' })] })], ev2);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.dropped.quote_does_not_name_the_firm, 1);
});

test('a quote that only names a partner, not the firm, is not enough', () => {
  const ev2 = [ev('E1', 'Kanwaljit Singh said the $3 million seed round in Millet Co closed on 20 September.')];
  const r = run([cand({ deals: [deal({ quote: 'Kanwaljit Singh said the $3 million seed round in Millet Co closed on 20 September' })] })], ev2);
  assert.equal(r.candidates.length, 0);
});

test('a deal the article only mentions in passing is not dated by the article, and the company must exist in the source', () => {
  const ev2 = [ev('E1', 'Earlier this year, Millet Co secured $3 million in a seed round led by Fireside Ventures.')];
  assert.equal(run([cand({ deals: [deal({ date: null, quote: 'Earlier this year, Millet Co secured $3 million in a seed round led by Fireside Ventures' })] })], ev2).dropped.date_unclear, 1);
  assert.equal(run([cand({ deals: [deal({ company: 'Invented Foods' })] })]).dropped.company_not_in_source, 1);
  assert.equal(run([cand({ deals: [deal({ date: null })] })]).candidates[0].deals[0].dateSource, 'article');
});

test('deals older than the window or in the future are dropped; a missing date falls back to the article date', () => {
  assert.equal(run([cand({ deals: [deal({ date: '2026-01-02' })] })]).dropped.older_than_window, 1);
  assert.equal(run([cand({ deals: [deal({ date: '2026-12-01' })] })]).dropped.date_in_future, 1);
  const undated = run([cand({ deals: [deal({ date: null })] })]);
  assert.equal(undated.candidates[0].deals[0].date, '2026-09-20');
  assert.equal(run([cand({ deals: [deal({ date: null })] })], [ev('E1', E[0].text, { publishedAt: null })]).dropped.no_date, 1);
});

test('an unsupported cheque note is removed but the firm stays', () => {
  const r = run([cand({ chequeNote: 'Writes $1M to $5M cheques', chequeQuote: 'writes cheques of $1 million to $5 million', chequeEvidenceId: 'E1' })]);
  assert.equal(r.candidates[0].chequeNote, null);
  assert.equal(r.dropped.cheque_note_unsupported, 1);
});

test('the same firm listed twice is merged, and the same company is not counted twice', () => {
  const second = ev('E2', 'Fireside Ventures also backed Ragi Labs in a $1 million pre-seed round on 2 October.', { publishedAt: '2026-10-02' });
  const r = run([cand(), cand({ deals: [deal(), deal({ company: 'Ragi Labs', quote: 'Fireside Ventures also backed Ragi Labs in a $1 million pre-seed round', evidenceId: 'E2', date: '2026-10-02' })] })], [...E, second]);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].deals.length, 2);
});

test('ranking favours recent, in-sector, in-stage deals and is fully deterministic', () => {
  const mk = (o: Partial<Candidate['deals'][number]>): Candidate => ({ firm: 'F', partner: null, score: 0, label: 'possible', chequeNote: null, chequeQuote: null, reasons: [], deals: [{ company: 'C', round: null, amount: null, date: '2026-10-01', quote: 'q', evidenceId: 'E1', url: 'u', domain: 'd', title: 't', sectorMatch: true, stageMatch: true, dateSource: 'stated', ...o }] });
  const great = rank(mk({}), TODAY).score;
  const old = rank(mk({ date: '2026-05-01' }), TODAY).score;
  const offSector = rank(mk({ sectorMatch: false }), TODAY).score;
  assert.ok(great > old && great > offSector);
  assert.equal(rank(mk({}), TODAY).score, great);
  assert.equal(rank(mk({}), TODAY).label, 'possible'); // one perfect recent deal = 1.0: a single data point is not a pattern
  const three = mk({}); three.deals = [three.deals[0], { ...three.deals[0], company: 'C2' }, { ...three.deals[0], company: 'C3' }];
  assert.equal(rank(three, TODAY).label, 'strong');
  assert.equal(rank({ ...three, deals: three.deals.slice(0, 2) }, TODAY).label, 'good');
});

test('search prompts carry the profile, the window and the founder focus, and demand sources', () => {
  const p = collectorPrompts(DEMO_PROFILE, TODAY, 'D2C food in India');
  assert.equal(p.length, 3);
  for (const x of p) { assert.match(x.prompt, /Sattva|millet/i); assert.match(x.prompt, /2026-10-12/); assert.match(x.prompt, /D2C food in India/); assert.match(x.prompt, /at most 5 searches/); }
});

test('the independent audit passes a verified result and catches a tampered one', () => {
  const r = run([cand()]);
  const res = { candidates: r.candidates, evidence: E } as never;
  assert.deepEqual(audit(res, TODAY), []);
  const tampered = { candidates: [{ ...r.candidates[0], deals: [{ ...r.candidates[0].deals[0], quote: 'Fireside Ventures led a $90 million round in Millet Co' }] }], evidence: E } as never;
  assert.ok(audit(tampered, TODAY).some((p) => p.includes('quote not in source')));
});

const mkC = (firm: string, deals: Partial<Candidate['deals'][number]>[], partner: string | null = null): Candidate => ({ firm, partner, score: 1, label: 'possible', chequeNote: null, chequeQuote: null, reasons: [], deals: deals.map((d, i) => ({ company: `C${i}`, round: 'Seed', amount: null, date: '2026-09-20', quote: `${firm} backed C${i}`, evidenceId: 'E1', url: 'https://x.test/a', domain: 'x.test', title: 't', sectorMatch: true, stageMatch: true, dateSource: 'stated' as const, ...d })) });

test('labels differ by what the deals show, and the sentence names the deal, when and why', () => {
  const active = describe(mkC('A', [{ company: 'Anmasa', date: '2026-09-20' }, { company: 'Phab', date: '2026-08-01' }]), TODAY);
  assert.equal(active.label, 'Active in your space'); assert.match(active.why, /2 deals in your category since Aug 2026/); assert.match(active.why, /Anmasa/);
  const closest = describe(mkC('B', [{ company: 'Anmasa (Hyperlocal staples)' }], 'Kanwaljit Singh'), TODAY);
  assert.equal(closest.label, 'Closest match'); assert.match(closest.why, /Backed Anmasa \(Seed\) 3 weeks ago: your category, your stage\./); assert.match(closest.next, /Kanwaljit Singh/);
  assert.equal(describe(mkC('C', [{ date: '2026-05-01' }]), TODAY).label, 'Right category');
  assert.equal(describe(mkC('D', [{ sectorMatch: false }]), TODAY).label, 'Right stage');
  const adj = describe(mkC('E', [{ sectorMatch: false, stageMatch: false }]), TODAY);
  assert.equal(adj.label, 'Adjacent'); assert.match(adj.next, /Find out who led/);
});

test('one round with several investors becomes one card, closest matches first', () => {
  const gs = groupByDeal([
    mkC('Blume Ventures', [{ company: 'Anmasa', amount: null }]), mkC('Fireside Ventures', [{ company: 'Anmasa (hyperlocal)', amount: '$3.15 million' }, { company: 'Phab', sectorMatch: false, date: '2026-10-01' }]),
    mkC('OTP Ventures', [{ company: 'Phab', sectorMatch: false, date: '2026-10-01' }]),
  ], TODAY);
  assert.equal(gs.length, 2);
  assert.equal(gs[0].company, 'Anmasa'); assert.equal(gs[0].investors.length, 2); assert.equal(gs[0].amount, '$3.15 million');
  assert.deepEqual(gs[1].investors.map((i) => i.firm).sort(), ['Fireside Ventures', 'OTP Ventures']);
});

test('a stated date beats an article date when firms disagree', () => {
  const g = groupByDeal([mkC('A', [{ company: 'Z', date: '2026-10-05', dateSource: 'article' }]), mkC('B', [{ company: 'Z', date: '2026-09-01', dateSource: 'stated' }])], TODAY)[0];
  assert.equal(g.date, '2026-09-01'); assert.equal(g.dateSource, 'stated');
});
