// Run the full pipeline from the command line: npm run run -- "Name" "Firm"
import { runPipeline } from '../lib/pipeline';
import { DEMO_PROFILE } from '../lib/demoProfile';

const [name, firm] = [process.argv[2], process.argv[3]];
if (!name || !firm) { console.error('usage: run "Name" "Firm"'); process.exit(1); }
const r = await runPipeline({ name, firm, profile: DEMO_PROFILE }, {
  onStages: (s) => console.log(s.map((x) => `${x.status === 'done' ? '✓' : x.status === 'running' ? '…' : x.status === 'failed' ? '✗' : '·'} ${x.key}${x.detail ? ` (${x.detail})` : ''}`).join('  ')),
});
console.log('\nSTATUS', r.status, '| latency', (r.stats.latencyMs / 1000).toFixed(1) + 's', '| cost $' + r.usage.costUsd.toFixed(4), '| calls', r.usage.calls);
console.log('STATS', r.stats, '\nCONFIDENCE', r.sectionConfidence, '\nNOTES', r.notes);
for (const c of r.claims) console.log(`${c.verified ? 'OK ' : 'DROP'} [${c.section}/${c.kind}] ${c.eventDate ?? '----------'} ${c.text}${c.verified ? '' : '  <- ' + c.dropReason}`);
console.log('\nSYNTHESIS', JSON.stringify(r.synthesis, null, 2));
if (process.argv[4]) (await import('node:fs')).writeFileSync(process.argv[4], JSON.stringify(r, null, 2));
