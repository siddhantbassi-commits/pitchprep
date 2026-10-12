// Run investor discovery from the command line: npm run discover -- "optional focus"
import { audit, discover } from '../lib/discover';
import { DEMO_PROFILE } from '../lib/demoProfile';

const r = await discover(DEMO_PROFILE, {
  focus: process.argv[2],
  onStage: (s) => console.log(s.map((x) => `${x.status === 'done' ? '✓' : x.status === 'running' ? '…' : x.status === 'failed' ? '✗' : '·'} ${x.key}${x.detail ? ` (${x.detail})` : ''}`).join('  ')),
});
console.log('\nSTATS', r.stats, '| cost $' + r.usage.costUsd.toFixed(4), '\nNOTES', r.notes);
for (const c of r.candidates) {
  console.log(`\n${c.label.toUpperCase()} ${c.score}  ${c.firm}${c.partner ? ` (${c.partner})` : ''}  ${c.reasons.join(' | ')}`);
  if (c.chequeNote) console.log(`   cheque: ${c.chequeNote} <- "${c.chequeQuote}"`);
  for (const d of c.deals) console.log(`   ${d.date} ${d.company} ${d.round ?? ''} ${d.amount ?? ''} [${d.domain}] sector:${d.sectorMatch} stage:${d.stageMatch}\n     "${d.quote}"`);
}

const problems = audit(r, new Date().toISOString().slice(0, 10));
console.log(problems.length ? `\nAUDIT FAILED:\n${problems.join('\n')}` : `\nAUDIT OK: ${r.stats.dealsKept} deals re-checked against their sources, 0 problems`);
if (problems.length) process.exit(1);
