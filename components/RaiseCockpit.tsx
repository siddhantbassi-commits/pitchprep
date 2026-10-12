'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CSTATUSES, CSTATUS_LABEL, DEFAULT_PROB, UNIT, fmtMoney, fromBase, summarize, toBase, type Commitment, type Currency, type CStatus, type Plan } from '@/lib/raise';
import { STATUS_LABEL, fitLabel, fitScore, type Fit, type Status } from '@/lib/tracker';

interface PipeRow { key: string; name: string; firm: string; stage: Status; fit: Fit | null; briefId: string }
interface Row { key: string; name: string; firm: string; stage?: Status; fit?: Fit | null; briefId?: string; amount: string; status: CStatus; is_lead: boolean }

const keyOf = (name: string, firm: string) => `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${firm.trim().toLowerCase().replace(/\s+/g, ' ')}`;
const num = (s: string): number | null => { const v = parseFloat(s); return Number.isFinite(v) && v >= 0 ? v : null; };

export default function RaiseCockpit({ initialPlan, initialCommitments, pipeline, startup, raiseNote }: { initialPlan: Plan; initialCommitments: Commitment[]; pipeline: PipeRow[]; startup: string; raiseNote: string }) {
  const [cur, setCur] = useState<Currency>(initialPlan.currency);
  const u = UNIT[cur];
  const show = (v: number | null) => (v == null ? '' : String(Math.round(fromBase(cur, v) * 1000) / 1000));
  const [f, setF] = useState({ target: show(initialPlan.target || null), pre: show(initialPlan.pre_money), min: show(initialPlan.min_close), by: initialPlan.close_by ?? '', founder: initialPlan.founder_pct == null ? '' : String(initialPlan.founder_pct), burn: show(initialPlan.monthly_burn) });
  const [rows, setRows] = useState<Row[]>(() => {
    const cm = new Map(initialCommitments.map((c) => [c.investor_key, c]));
    const fromPipe: Row[] = pipeline.map((p) => { const c = cm.get(p.key); return { key: p.key, name: p.name, firm: p.firm, stage: p.stage, fit: p.fit, briefId: p.briefId, amount: c ? show(c.amount) : '', status: c?.status ?? 'interested', is_lead: c?.is_lead ?? false }; });
    const extra: Row[] = initialCommitments.filter((c) => !pipeline.some((p) => p.key === c.investor_key)).map((c) => ({ key: c.investor_key, name: c.investor_name, firm: c.firm, amount: show(c.amount), status: c.status, is_lead: c.is_lead }));
    return [...fromPipe, ...extra];
  });
  const [odds, setOdds] = useState<Record<string, number>>({ ...DEFAULT_PROB });
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newName, setNewName] = useState('');
  const [newFirm, setNewFirm] = useState('');
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { try { const s = localStorage.getItem('pp_odds'); if (s) setOdds({ ...DEFAULT_PROB, ...JSON.parse(s) }); } catch { /* optional */ } }, []);
  const setOdd = (k: string, v: number) => { const next = { ...odds, [k]: v }; setOdds(next); try { localStorage.setItem('pp_odds', JSON.stringify(next)); } catch { /* optional */ } };

  const plan: Plan = useMemo(() => ({
    currency: cur, target: toBase(cur, num(f.target) ?? 0), pre_money: num(f.pre) == null ? null : toBase(cur, num(f.pre)!), min_close: num(f.min) == null ? null : toBase(cur, num(f.min)!),
    close_by: /^\d{4}-\d{2}-\d{2}$/.test(f.by) ? f.by : null, founder_pct: num(f.founder) != null && num(f.founder)! <= 100 ? num(f.founder) : null, monthly_burn: num(f.burn) == null ? null : toBase(cur, num(f.burn)!),
  }), [cur, f]);
  const commitments: Commitment[] = useMemo(() => rows.map((r) => ({ investor_key: r.key, investor_name: r.name, firm: r.firm, amount: toBase(cur, num(r.amount) ?? 0), status: r.status, is_lead: r.is_lead })), [rows, cur]);
  const s = useMemo(() => summarize(plan, commitments, new Date(), odds as typeof DEFAULT_PROB), [plan, commitments, odds]);

  const savePlan = useCallback((p: Plan) => {
    if (planTimer.current) clearTimeout(planTimer.current);
    setSaving('saving');
    planTimer.current = setTimeout(async () => { const r = await fetch('/api/raise/plan', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) }); setSaving(r.ok ? 'saved' : 'error'); }, 600);
  }, []);
  useEffect(() => { savePlan(plan); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [plan]);

  function saveRow(r: Row, delay = 500) {
    if (rowTimers.current[r.key]) clearTimeout(rowTimers.current[r.key]);
    setSaving('saving');
    rowTimers.current[r.key] = setTimeout(async () => {
      const res = await fetch('/api/raise/commitments', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: r.name, firm: r.firm, amount: toBase(cur, num(r.amount) ?? 0), status: r.status, is_lead: r.is_lead }) });
      setSaving(res.ok ? 'saved' : 'error');
    }, delay);
  }
  function patchRow(key: string, patch: Partial<Row>) {
    setRows((all) => {
      const next = all.map((r) => (r.key === key ? { ...r, ...patch } : patch.is_lead ? { ...r, is_lead: false } : r));
      const changed = next.find((r) => r.key === key); if (changed) saveRow(changed);
      return next;
    });
  }
  function addRow(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim(); if (name.length < 2) return;
    const key = keyOf(name, newFirm);
    if (rows.some((r) => r.key === key)) return;
    const r: Row = { key, name, firm: newFirm.trim(), amount: '', status: 'interested', is_lead: false };
    setRows((a) => [...a, r]); saveRow(r, 0); setNewName(''); setNewFirm('');
  }
  async function removeRow(r: Row) {
    setRows((a) => a.filter((x) => x.key !== r.key));
    await fetch(`/api/raise/commitments?key=${encodeURIComponent(r.key)}`, { method: 'DELETE' });
  }

  const money = (v: number) => fmtMoney(cur, v);
  const barPct = (v: number) => (s.target > 0 ? Math.min(100, (v / s.target) * 100) : 0);
  const field = (label: string, id: string, value: string, set: (v: string) => void, hint?: string, type: 'number' | 'date' = 'number') => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} className="input mt-1" value={value} onChange={(e) => set(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  return (
    <div className="grid gap-6">
      <section className="card p-5 sm:p-6" aria-labelledby="round">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="round" className="text-xl font-semibold">The round: {startup}</h2>
          <span role="status" className="text-sm text-muted">{saving === 'saving' ? 'Saving…' : saving === 'saved' ? 'Saved' : saving === 'error' ? 'Could not save' : 'Saves as you type'}</span>
        </div>
        {raiseNote && <p className="mt-1 text-sm text-muted">From your profile: {raiseNote}</p>}
        <fieldset className="mt-3 flex items-center gap-4 text-sm"><legend className="sr-only">Currency</legend>
          {(['USD', 'INR'] as const).map((c) => <label key={c} className="flex items-center gap-1.5"><input type="radio" name="cur" checked={cur === c} onChange={() => setCur(c)} />{c === 'USD' ? 'US dollars ($M)' : 'Indian rupees (crore)'}</label>)}
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {field(`Target (${u.short})`, 'target', f.target, (v) => setF({ ...f, target: v }), 'What you are raising in total')}
          {field(`Pre-money valuation (${u.short})`, 'pre', f.pre, (v) => setF({ ...f, pre: v }), 'Needed to compute dilution')}
          {field(`Minimum close (${u.short})`, 'min', f.min, (v) => setF({ ...f, min: v }), 'The least you would close on')}
          {field('Close by', 'by', f.by, (v) => setF({ ...f, by: v }), undefined, 'date')}
          {field('Your ownership today (%)', 'founder', f.founder, (v) => setF({ ...f, founder: v }), 'Founders together, before this round')}
          {field(`Monthly burn (${u.short})`, 'burn', f.burn, (v) => setF({ ...f, burn: v }), 'To show runway the round buys')}
        </div>
        <p className="mt-3 text-xs text-muted">Switching currency changes the units shown; it does not convert exchange rates. Dilution assumes the valuation is pre-money and the whole round is new shares.</p>
      </section>

      {s.target > 0 && (
        <>
          <section className="card p-5 sm:p-6" aria-labelledby="progress">
            <h2 id="progress" className="text-xl font-semibold">How full is it?</h2>
            <div role="img" aria-label={`Committed ${s.pctCommitted} percent, plus soft-circled brings it to ${s.pctCommittedSoft} percent of target, pipeline in total ${s.pctPipeline} percent`} className="mt-4 h-5 w-full overflow-hidden rounded-full bg-line flex">
              <div className="bg-brand" style={{ width: `${barPct(s.committed)}%` }} />
              <div className="bg-blue" style={{ width: `${Math.min(barPct(s.soft), 100 - barPct(s.committed))}%` }} />
              <div className="bg-amber" style={{ width: `${Math.min(barPct(s.interested), Math.max(0, 100 - barPct(s.committed) - barPct(s.soft)))}%`, opacity: 0.55 }} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div><dt className="text-muted"><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-brand" />Committed</dt><dd className="text-2xl font-serif font-semibold">{money(s.committed)}</dd><dd className="text-muted">{s.pctCommitted}% of target</dd></div>
              <div><dt className="text-muted"><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue" />Soft-circled</dt><dd className="text-2xl font-serif font-semibold">{money(s.soft)}</dd><dd className="text-muted">{s.pctCommittedSoft}% with committed</dd></div>
              <div><dt className="text-muted"><span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber opacity-60" />Interested</dt><dd className="text-2xl font-serif font-semibold">{money(s.interested)}</dd><dd className="text-muted">Pipeline {s.coverage ?? 0}x target</dd></div>
              <div><dt className="text-muted">Still to find</dt><dd className="text-2xl font-serif font-semibold">{money(s.gap)}</dd><dd className="text-muted">{s.daysLeft == null ? 'No close-by date' : s.daysLeft >= 0 ? `${s.daysLeft} days left` : `${-s.daysLeft} days past`}</dd></div>
            </dl>
            <p className="mt-4 text-sm"><span className="font-medium">Expected raise on your assumed odds:</span> {money(s.expected)} <span className="text-muted">(committed {Math.round(odds.committed * 100)}%, soft-circled {Math.round(odds.soft_circled * 100)}%, interested {Math.round(odds.interested * 100)}%). An assumption, not a forecast.</span></p>
            <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted">Change the assumed odds</summary>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['interested', 'soft_circled', 'committed', 'term_sheet'] as const).map((k) => (
                  <label key={k} className="text-xs text-muted">{CSTATUS_LABEL[k]} (%)<input type="number" min={0} max={100} className="input mt-1" value={Math.round((odds[k] ?? 0) * 100)} onChange={(e) => setOdd(k, Math.min(1, Math.max(0, Number(e.target.value) / 100)))} /></label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">Saved in this browser only. Defaults are rough placeholders; replace them with your own read.</p>
            </details>
          </section>

          <section className="grid gap-4 sm:grid-cols-3" aria-label="What the round costs and buys">
            <div className="card p-5"><p className="label">Dilution at target</p><p className="mt-1 text-3xl font-serif font-semibold">{s.dilutionAtTarget == null ? 'n/a' : `${s.dilutionAtTarget}%`}</p><p className="mt-1 text-xs text-muted">{s.dilutionAtTarget == null ? 'Add a pre-money valuation.' : `If only committed + soft-circled closes: ${s.dilutionIfCommittedSoft}%. Committed alone: ${s.dilutionIfCommitted}%.`}</p></div>
            <div className="card p-5"><p className="label">Your stake after</p><p className="mt-1 text-3xl font-serif font-semibold">{s.founderAfterAtTarget == null ? 'n/a' : `${s.founderAfterAtTarget}%`}</p><p className="mt-1 text-xs text-muted">{s.founderAfterAtTarget == null ? 'Add your ownership and valuation.' : `From ${f.founder}% today, before any option pool.`}</p></div>
            <div className="card p-5"><p className="label">Runway the round buys</p><p className="mt-1 text-3xl font-serif font-semibold">{s.runwayMonthsAtTarget == null ? 'n/a' : `${s.runwayMonthsAtTarget} mo`}</p><p className="mt-1 text-xs text-muted">{s.runwayMonthsAtTarget == null ? 'Add your monthly burn.' : `On committed money alone: ${s.runwayMonthsCommitted} months.`}</p></div>
          </section>

          {s.warnings.length > 0 && (
            <section className="rounded-2xl border border-line bg-amber-soft p-5" aria-labelledby="warn">
              <h2 id="warn" className="text-lg font-semibold text-amber">What to fix</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber space-y-1">{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="who">
        <h2 id="who" className="text-xl font-semibold">Who is putting in what</h2>
        <p className="text-sm text-muted">Everyone from your <Link className="underline" href="/pipeline">pipeline</Link> appears here. Enter an amount and set their stage. Mark one as the lead.</p>
        <div className="card mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Investors and amounts, scrollable">
          <table className="w-full text-sm">
            <caption className="sr-only">Investors, amounts and stages</caption>
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-3">Investor</th><th className="p-3">Pipeline</th><th className="p-3">Amount ({u.short})</th><th className="p-3">Stage</th><th className="p-3">Lead</th><th className="p-3"><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td className="p-4 text-muted" colSpan={6}>No investors yet. <Link className="underline" href="/">Research one</Link>, or add someone below.</td></tr>}
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-line last:border-0 align-middle">
                  <td className="p-3 min-w-44"><p className="font-medium">{r.briefId ? <Link className="hover:underline" href={`/brief/${r.briefId}`}>{r.name}</Link> : r.name}</p><p className="text-muted">{r.firm}</p></td>
                  <td className="p-3 text-muted whitespace-nowrap">{r.stage ? STATUS_LABEL[r.stage] : 'Not in pipeline'}{r.fit && <span className="block text-xs">{fitLabel(fitScore(r.fit))}</span>}</td>
                  <td className="p-3"><label className="sr-only" htmlFor={`a-${r.key}`}>Amount for {r.name}</label><input id={`a-${r.key}`} type="number" inputMode="decimal" min={0} step="any" className="input !w-28" value={r.amount} onChange={(e) => patchRow(r.key, { amount: e.target.value })} /></td>
                  <td className="p-3"><label className="sr-only" htmlFor={`s-${r.key}`}>Stage for {r.name}</label><select id={`s-${r.key}`} className="input !w-auto" value={r.status} onChange={(e) => patchRow(r.key, { status: e.target.value as CStatus })}>{CSTATUSES.map((c) => <option key={c} value={c}>{CSTATUS_LABEL[c]}</option>)}</select></td>
                  <td className="p-3"><label className="flex items-center gap-1.5"><input type="checkbox" checked={r.is_lead} onChange={(e) => patchRow(r.key, { is_lead: e.target.checked })} />Lead<span className="sr-only"> for {r.name}</span></label></td>
                  <td className="p-3 text-right"><button className="text-muted hover:text-red underline" onClick={() => removeRow(r)} aria-label={`Remove ${r.name} from the raise`}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={addRow} className="mt-4 flex flex-wrap items-end gap-3">
          <div><label className="label" htmlFor="nn">Add someone not in your pipeline</label><input id="nn" className="input mt-1" placeholder="Name (e.g. an angel)" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} /></div>
          <div><label className="label sr-only" htmlFor="nf">Firm</label><input id="nf" className="input mt-1" placeholder="Firm (optional)" value={newFirm} onChange={(e) => setNewFirm(e.target.value)} maxLength={80} /></div>
          <button className="btn" disabled={newName.trim().length < 2}>Add</button>
        </form>
      </section>
    </div>
  );
}
