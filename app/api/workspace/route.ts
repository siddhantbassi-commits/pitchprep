import { NextResponse } from 'next/server';
import { currentWorkspace, deleteWorkspace } from '@/lib/store';

// Real deletion for the user's own data: profile, every brief, claims, sources and feedback cascade away.
export async function DELETE() {
  const ws = await currentWorkspace();
  await deleteWorkspace(ws);
  return NextResponse.json({ ok: true });
}
