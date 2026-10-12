// Generates docs/Components-Map.html and .pdf (Trigger > Input > Context > Processing > AI > Output swimlane map).
// Run: node scripts/make-map.mjs   (needs Google Chrome for the PDF step)
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const W = 1280, H = 790;
const X0 = 28, ACTOR_W = 150, COL_W = (W - 2 * X0 - ACTOR_W) / 6;
const HEAD_Y = 54, HEAD_H = 34, ROW_H = 60, BOX_H = 47, BOX_W = COL_W - 22;
const COLS = ['Trigger', 'Input', 'Context', 'Processing', 'AI', 'Output'];
const COLOR = {
  Trigger: ['#f1edfb', '#7a5fd0'], Input: ['#eaf5fd', '#5b9bd5'], Context: ['#e9f7ef', '#4aa974'],
  Processing: ['#fcf1d6', '#e0a93b'], AI: ['#fbeaf3', '#d45f9b'], Output: ['#fdeeea', '#d9645b'],
};
const rows = [
  ['Priya', 'Founder · human', '#fffdf7'],
  ['PitchPrep app', 'Next.js on Vercel', '#fff8ea'],
  ['Live data layer', 'Google Search + page fetch', '#f3f9f4'],
  ['AI model', 'Gemini Flash', '#fbf3f8'],
  ['Verification gate', 'Code, not the LLM', '#f7f4fb'],
  ['Database', 'Supabase', '#f3f6fc'],
  ['Delivery', 'Web · PDF · meeting card', '#f6f6f1'],
  ['After the meeting', 'Notes · follow-up · practice', '#fff6ee'],
  ['Raise tools', 'Discover · Raise · Deck · Practice', '#f4f9f7'],
  ['Dashboard', 'Vercel', '#fdf2f4'],
];
// [id, row, col, text]
const boxes = [
  ['p_trig', 0, 'Trigger', 'Investor meeting booked: she enters name + firm, or her calendar surfaces it'],
  ['s_trig', 1, 'Trigger', 'Every 30 min: calendar scan, brief preparation, and any due email nudges'],
  ['p_in', 0, 'Input', 'Name + firm. Optional: meeting time, a post she pastes'],
  ['p_ctx', 0, 'Context', 'Saved startup profile: stage, sector, raise, traction'],
  ['p_out', 0, 'Output', 'Brief in about a minute: deals, thesis, watch-outs, 3 talking points'],
  ['s_ctx', 1, 'Context', 'Checks 6-hour cache and rate limits, loads profile, opens a job'],
  ['s_proc', 1, 'Processing', 'Runs 5 searches in parallel under a 2-minute deadline; streams progress'],
  ['l_ctx', 2, 'Context', 'Rules: robots.txt, no private addresses, no LinkedIn scraping. Also feeds investor search'],
  ['l_proc', 2, 'Processing', 'Resolves each citation, opens the article, reads its date and text'],
  ['a_ai', 3, 'AI', 'Searches, extracts, fact-checks, writes talking points then re-checks them; spots investor meetings; finds investors'],
  ['g_proc', 4, 'Processing', 'Quote in source; deal dated in window (90 days; 200 for investor search); speaker named; dedupe'],
  ['g_out', 4, 'Output', 'Unverified claims dropped and listed as "left out and why"'],
  ['d_ctx', 5, 'Context', 'Briefs, claims, sources, notes, raise plan, mock rounds, searches; private per workspace'],
  ['d_proc', 5, 'Processing', 'Logs status, time, tokens and cost for every brief'],
  ['v_proc', 6, 'Processing', 'Formats for reading, PDF, phone meeting card; sends nudges to her from a Gmail sender'],
  ['v_out', 6, 'Output', 'Email to her (confirmed address only): brief ready, refreshed brief, follow-up, gentle bump, Monday summary'],
  ['f_trig', 7, 'Trigger', 'Meeting done: she adds notes, or practises an answer'],
  ['f_in', 7, 'Input', 'Her notes, and the answer she typed or dictated'],
  ['f_ctx', 7, 'Context', 'Her startup profile and the verified claims only'],
  ['f_proc', 7, 'Processing', 'Code checks every figure against her profile; flags placeholders'],
  ['f_ai', 7, 'AI', 'Drafts the follow-up; coaches the answer'],
  ['f_out', 7, 'Output', 'A draft she edits and sends herself; status and next step saved'],
  ['r_trig', 8, 'Trigger', 'She asks "Who should I pitch?", opens her round, or starts a mock meeting'],
  ['r_in', 8, 'Input', 'Her profile and focus; her pitch deck (PDF or text); her own contacts file, kept in the browser'],
  ['r_ctx', 8, 'Context', 'Live search of recent rounds, peers and funds; her pipeline; a verified brief'],
  ['r_proc', 8, 'Processing', 'Code verifies each deal, checks deck figures against her profile, matches contacts, does the round maths'],
  ['r_ai', 8, 'AI', 'Finds investors, reads the deck, plays the investor from verified facts, writes the pre-mortem, scores answers'],
  ['r_out', 8, 'Output', 'Investors by round; deck report; warm paths; pre-mortem; round progress; scorecard and trend'],
  ['k_proc', 9, 'Processing', 'Aggregates KPIs from Supabase'],
  ['k_out', 9, 'Output', 'Live dashboard: time to brief, verification rate, cost per brief'],
];
const pos = {};
boxes.forEach(([id, r, c]) => {
  const ci = COLS.indexOf(c);
  pos[id] = { x: X0 + ACTOR_W + ci * COL_W + 11, y: HEAD_Y + HEAD_H + r * ROW_H + (ROW_H - BOX_H) / 2, w: BOX_W, h: BOX_H };
});
const R = (id) => pos[id], cx = (b) => b.x + b.w / 2, cy = (b) => b.y + b.h / 2;
// Edges as polylines, drawn behind boxes.
const edges = [
  ['p_trig', 'p_in', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['p_in', 's_ctx', (a, b) => [[a.x + a.w - 14, a.y + a.h], [a.x + a.w - 14, cy(b)], [b.x + b.w, cy(b)]]],
  ['s_trig', 's_ctx', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['p_ctx', 's_ctx', (a, b) => [[cx(a), a.y + a.h], [cx(b), b.y]]],
  ['s_ctx', 's_proc', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['s_proc', 'l_proc', (a, b) => [[cx(a), a.y + a.h], [cx(b), b.y]]],
  ['l_ctx', 'l_proc', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['l_proc', 'a_ai', (a, b) => [[a.x + a.w, cy(a)], [a.x + a.w + 11, cy(a)], [a.x + a.w + 11, cy(b)], [b.x, cy(b)]]],
  ['a_ai', 'g_proc', (a, b) => [[a.x + 40, a.y + a.h], [a.x + 40, cy(b) - 8], [b.x + b.w, cy(b) - 8]]],
  ['g_proc', 'g_out', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['g_proc', 'd_proc', (a, b) => [[cx(a), a.y + a.h], [cx(b), b.y]]],
  ['d_ctx', 'd_proc', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['d_proc', 'v_proc', (a, b) => [[cx(a), a.y + a.h], [cx(b), b.y]]],
  ['v_proc', 'p_out', (a, b) => [[a.x + a.w, cy(a)], [W - X0 - 5, cy(a)], [W - X0 - 5, cy(b) + 6], [b.x + b.w, cy(b) + 6]]],
  ['d_proc', 'k_proc', (a, b) => [[a.x + 22, a.y + a.h], [a.x + 22, b.y]]],
  ['v_proc', 'v_out', (a, b) => [[a.x + a.w, cy(a) + 12], [b.x, cy(b) + 12]]],
  ['f_trig', 'f_in', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['f_in', 'f_ctx', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['f_ctx', 'f_proc', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['f_proc', 'f_ai', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['f_ai', 'f_out', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['r_trig', 'r_in', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['r_in', 'r_ctx', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['r_ctx', 'r_proc', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['r_proc', 'r_ai', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['r_ai', 'r_out', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
  ['k_proc', 'k_out', (a, b) => [[a.x + a.w, cy(a)], [b.x, cy(b)]]],
];
const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
const svgEdges = edges.map(([a, b, f]) => `<path d="${path(f(R(a), R(b)))}" fill="none" stroke="#6b7280" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#ah)"/>`).join('\n');
const tableBottom = HEAD_Y + HEAD_H + rows.length * ROW_H;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>PitchPrep: Components Map</title>
<style>
@page { size: ${W}px ${H}px; margin: 0 }
* { box-sizing: border-box }
body { margin: 0; width: ${W}px; height: ${H}px; position: relative; font-family: Helvetica, Arial, sans-serif; background: #fff; overflow: hidden }
.title { position: absolute; top: 12px; left: 0; width: 100%; text-align: center; font-size: 25px; font-weight: 700; color: #20365c }
.sub { position: absolute; top: 40px; left: 0; width: 100%; text-align: center; font-size: 11px; color: #5b6475 }
.h { position: absolute; top: ${HEAD_Y}px; height: ${HEAD_H}px; background: #20365c; color: #fff; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; border-left: 1px solid #d9d46a }
.row { position: absolute; left: ${X0}px; width: ${W - 2 * X0}px; height: ${ROW_H}px; border-bottom: 1px solid #e3e6ec }
.actor { position: absolute; left: ${X0}px; width: ${ACTOR_W}px; height: ${ROW_H}px; background: #20365c; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-bottom: 1px solid #3a5083 }
.actor b { font-size: 13px } .actor span { font-size: 10px; opacity: .85; margin-top: 3px }
.vline { position: absolute; top: ${HEAD_Y + HEAD_H}px; height: ${rows.length * ROW_H}px; width: 1px; background: #e3e6ec }
.box { position: absolute; border: 1.6px solid; border-radius: 9px; padding: 4px 7px; font-size: 9.2px; line-height: 1.25; display: flex; align-items: center; justify-content: center; text-align: center; color: #1b2230 }
.bound { position: absolute; left: ${X0 + 8}px; width: ${W - 2 * X0 - 16}px; top: ${tableBottom + 6}px; height: 52px; border: 1.6px solid #d9645b; border-radius: 9px; background: #fdf7f6; display: flex; align-items: center; padding: 0 18px; gap: 26px }
.bound b { color: #c9524a; font-size: 12px; letter-spacing: .02em; white-space: nowrap }
.bound p { margin: 0; font-size: 11.5px; line-height: 1.4; color: #3d4556 }
.foot { position: absolute; right: ${X0}px; bottom: 6px; font-size: 8.5px; color: #6b7280 }
svg { position: absolute; left: 0; top: 0 }
</style></head><body>
<div class="title">End Term · PitchPrep, Pre-Meeting Investor Brief: Components Map</div>
<div class="sub">Name + firm in, a sourced and verified brief out; then notes, follow-up, practice, investor discovery and a round tracker. All AI is Gemini Flash. Code, not the model, decides what is shown.</div>
<div class="h" style="left:${X0}px;width:${ACTOR_W}px;border-left:0;border-radius:12px 0 0 0">Actor</div>
${COLS.map((c, i) => `<div class="h" style="left:${X0 + ACTOR_W + i * COL_W}px;width:${COL_W}px;${i === 5 ? 'border-radius:0 12px 0 0' : ''}">${c}</div>`).join('\n')}
${rows.map((r, i) => `<div class="row" style="top:${HEAD_Y + HEAD_H + i * ROW_H}px;background:${r[2]}"></div><div class="actor" style="top:${HEAD_Y + HEAD_H + i * ROW_H}px"><b>${r[0]}</b><span>(${r[1]})</span></div>`).join('\n')}
${COLS.map((_, i) => `<div class="vline" style="left:${X0 + ACTOR_W + i * COL_W}px"></div>`).join('\n')}
<svg width="${W}" height="${H}"><defs><marker id="ah" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M1,1 L8,4.5 L1,8" fill="none" stroke="#6b7280" stroke-width="1.4"/></marker></defs>
${svgEdges}</svg>
${boxes.map(([id, , c, t]) => { const p = pos[id]; const [bg, bd] = COLOR[c]; return `<div class="box" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;background:${bg};border-color:${bd}">${t}</div>`; }).join('\n')}
<div class="bound"><b>HUMAN BOUNDARY</b><p>AI can research, cite, summarise and draft angles. It does not contact investors, send anything on her behalf to anyone but herself, state anything it cannot quote from a source, scrape LinkedIn, judge people or predict funding decisions.<br>Which angle to use, whether to take the meeting, and what to send afterwards, stays with Priya.</p></div>
<div class="foot">Built from MESA End Term Problem Statement 1 and the Case 03 component-map style reference</div>
</body></html>`;
writeFileSync('docs/Components-Map.html', html);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=docs/Components-Map.pdf', `file://${process.cwd()}/docs/Components-Map.html`], { stdio: 'ignore' });
console.log('wrote docs/Components-Map.html and docs/Components-Map.pdf');
