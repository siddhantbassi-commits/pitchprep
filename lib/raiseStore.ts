import { db, must } from './db';
import type { Commitment, Currency, CStatus, Plan } from './raise';
import { investorKey } from './store';

export const EMPTY_PLAN: Plan = { currency: 'USD', target: 0, pre_money: null, min_close: null, close_by: null, founder_pct: null, monthly_burn: null };

export async function getPlan(ws: string): Promise<Plan> {
  const r = (await db().from('raise_plans').select('currency,target,pre_money,min_close,close_by,founder_pct,monthly_burn').eq('workspace_id', ws).maybeSingle()).data;
  if (!r) return EMPTY_PLAN;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return { currency: r.currency as Currency, target: Number(r.target), pre_money: n(r.pre_money), min_close: n(r.min_close), close_by: (r.close_by as string | null) ?? null, founder_pct: n(r.founder_pct), monthly_burn: n(r.monthly_burn) };
}

export async function savePlan(ws: string, p: Plan) {
  must(await db().from('raise_plans').upsert({ workspace_id: ws, ...p, updated_at: new Date().toISOString() }), 'savePlan');
}

export async function listCommitments(ws: string): Promise<Commitment[]> {
  const rows = (await db().from('raise_commitments').select('investor_key,investor_name,firm,amount,status,is_lead').eq('workspace_id', ws)).data ?? [];
  return rows.map((r) => ({ investor_key: r.investor_key as string, investor_name: r.investor_name as string, firm: (r.firm as string) ?? '', amount: Number(r.amount), status: r.status as CStatus, is_lead: !!r.is_lead }));
}

export async function upsertCommitment(ws: string, c: { name: string; firm: string; amount: number; status: CStatus; is_lead: boolean }) {
  const key = investorKey(c.name, c.firm);
  if (c.is_lead) await db().from('raise_commitments').update({ is_lead: false }).eq('workspace_id', ws).neq('investor_key', key); // one lead at a time
  must(await db().from('raise_commitments').upsert({ workspace_id: ws, investor_key: key, investor_name: c.name, firm: c.firm, amount: c.amount, status: c.status, is_lead: c.is_lead, updated_at: new Date().toISOString() }), 'upsertCommitment');
}

export async function deleteCommitment(ws: string, key: string) {
  await db().from('raise_commitments').delete().eq('workspace_id', ws).eq('investor_key', key);
}
