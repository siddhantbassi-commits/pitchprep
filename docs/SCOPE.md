# PitchPrep: scope and decisions

## The Cut
The workflow described includes reading the investor's LinkedIn posts. Not built. LinkedIn scraping breaks its terms and is brittle. Replacement: Google Search grounding over the public web, plus a "paste a post" box whose content is labelled as supplied by the user. See [nine-checks.md](nine-checks.md).

## Flow
Priya -> name + firm -> `POST /api/briefs` -> job row in Supabase -> background pipeline (`after()`):

1. **Collect**: five Gemini Flash calls in parallel with Google Search grounding (new investments, exits and milestones, thesis, context, firm facts).
2. **Sources**: resolve each citation redirect to the real URL, fetch the page (robots.txt respected, private addresses blocked), read publication date and text; add the firm's own site.
3. **Extract**: Gemini Flash with no tools turns the evidence into claims, each with a word-for-word quote.
4. **Verify**: code checks quote-in-source, source-about-investor, date window, duplicates; a Gemini fact-check pass then judges the survivors, and any claim it finds only partly supported is **rewritten down to what the quote actually states** (or dropped).
5. **Synthesise**: Gemini Flash writes the skim, fit snapshot, exactly three talking points (each citing verified claims) and likely questions, using Priya's startup profile.
6. **Persist and render**: brief, claims, sources, cost and latency saved; the page polls progress every 1.5 seconds.

## Decisions
| Decision | Choice | Why |
|---|---|---|
| Who decides what is shown | Code, not the LLM | Same principle as Aangan's `qualify.ts`: the model proposes, deterministic code disposes. Auditable and unit-tested (25 tests). |
| Retrieval | Gemini Google Search grounding plus our own page fetch | Live data with no extra vendor or key; we still hold the page text, which lets us check quotes ourselves instead of trusting the model. |
| Two passes (grounded research, then extraction with no tools) | Separate calls | We need the evidence text in hand to verify quotes. Whether grounding and JSON schema output can share one request is not documented for this model, and separating them is more auditable anyway. |
| Thinking level | `low` | Measured on the same deals prompt: 23 s versus 48 s at default. `minimal` is rejected by this model. |
| Model | `gemini-3.8-flash` only | Exam rule (Gemini Flash, no Claude API). One env var. No Claude fallback anywhere in the repo, unlike TripSync. |
| 90-day window | Enforced in code on the event date, else the article's own date | A model asked to "only include the last 90 days" cannot be trusted with date arithmetic. Deals with no date anywhere are shown separately as "date unconfirmed", never counted as recent. |
| Attribution | Statements must name their speaker; openers attribute exactly as the claim does; vague wording is dropped in code | A second review of the output found a talking point turning an unnamed "speaker" into "you have noted". Prompt rules fix it at source; a code check ("a speaker", "the quote", a bare pronoun) is the backstop and is also an evaluation metric. |
| Partly supported claims | Rewritten to the quote, flagged "narrowed to the source" | An independent spot-check found two claims with real quotes but invented detail ("existing backer", "Seed round"). The quote check cannot see that; the judge's rewrite can. See [model-comparison.md](model-comparison.md). |
| Unverified claims | Dropped and listed with a reason | Better a shorter brief than a wrong fact; the list shows the user exactly what was held back. |
| Access model | Signed-cookie private workspace, no login wall | A grader or a new user can run a brief immediately. Data is private per browser, with real deletion. Email sign-in can later attach to the same workspace. |
| Latency strategy | Parallel searches, per-stage time limits, 115 s hard deadline returning a partial brief | The exam's two-minute target must hold even when a stage is slow. |
| Cost reporting | Tokens at paid-tier list price plus grounded searches at list price | The dashboard reports what the tool costs to run. Google's first 5,000 searches a month are free, so actual spend is lower. |
| Hosting | Vercel (Mumbai `bom1`, Hobby plan, 300 s function limit with Fluid compute) and Supabase (Mumbai) | Same stack as the earlier cases. Background work runs with `after()` and the page polls progress. Verified on the deployed site: a brief finishes in about 50 s. |
| Database | New tables in an existing Supabase project, not a new project | The access token could not create a project (HTTP 403). The existing project's tables are untouched; PitchPrep's table grants are scoped to its own eight tables. |
| Rehearsal numbers | Checked in code against her profile | A language model cannot be trusted to notice that 40% contradicts the 34% on record; a set comparison can. |
| Calendar | Secret iCal link, no OAuth | Google OAuth for calendar scopes needs app verification. A read-only secret link needs nothing from the user's Google account and works with any calendar. Only titles, times, attendee names and email domains reach Gemini. |
| Follow-up emails | Drafted, never sent | The system has no code path that emails anyone. The draft opens in her own email app, which keeps the decision and the sender identity with her (Check 07). |
| Handoff channel | Web (history, share link, PDF) now; Telegram nudge is roadmap | Same reasoning as Case 3: a phone message minutes before the meeting is the right channel, but it needs a bot token, so it is left out rather than faked. |

## Beyond the brief (built)
Priya will take 40 or more meetings over a raise, so the brief is the start of the workflow, not the whole of it.

**Before the meeting**
- Founder profile that tailors every talking point (editable; a sample founder is clearly labelled so nothing looks like a dummy).
- Citations, exact quotes and dates on every claim; per-section confidence computed from source count, tier and recency.
- Fit snapshot (stage, sector, cheque) calibrated to say "unknown" when sources are silent, and to call a weak match a bridge, not a thesis match.
- **Questions to ask them**: fundraising is diligence in both directions (follow-on reserves, decision process, value-add), anchored to verified facts.
- "What we left out and why", and an honest "nothing found" state instead of filler.
- **Meeting card**: a large-type, phone-friendly view (openers, key facts, watch-outs, expected questions) for the minute before walking in; the app installs to the home screen.
- **Meetings**: connect a calendar link (or try a generated sample calendar); investor meetings are detected, and briefs are prepared automatically about 24 hours before (GitHub Actions every 30 minutes) or on one click.
- Refresh with a "compared with your last brief" panel (genuinely new events separated from facts that merely surfaced this time).
- Copy as text, share link, PDF export, 6-hour cache.

**After the meeting**
- **Pipeline**: every investor researched, ranked by fit, with status (researching, booked, met, follow-up sent, in talks, passed), next step with date and overdue flag, notes, search and filters.
- **Follow-up email draft**: written only from her notes, her profile and the verified facts; commitments stay exactly as she made them; placeholders such as [attach deck] are flagged; code flags any figure not found in her profile or notes. She edits and sends it herself.
- **Rehearsal**: type or dictate an answer to a likely question and get coaching; **code** checks every figure she quotes against her own profile, so "40%" when the record says 34% is caught before an investor hears it.

**Trust and operations**
- Per-claim "Wrong? / Outdated?" feedback; ops dashboard (time to brief, share under two minutes, cost per brief, verification rate, what the gate dropped); in-product **Evidence** page with the live evaluation results.
- Evaluation harness (`npm run eval`): real, fake, mismatched and adversarial inputs; independent spot-check ([spot-check.md](spot-check.md)).
- **Privacy rights**: "Download my data" (portability) and "Delete all my data" (erasure) as real endpoints, plus per-brief delete; the private calendar link is **encrypted at rest** (AES-256-GCM) because it is a credential; private signed-cookie workspaces; prompt-injection, SSRF and rate-limit protections, security headers (no framing, no sniffing, strict transport, microphone for same origin only), robots.txt (8 briefs per hour per browser, 15 per IP, 150 a day overall, to cap spend on a public demo); keep-alive and health checks.
- Accessible by design: skip link, labelled controls, keyboard shortcut (`/` to start typing), dark mode, reduced-motion support, print stylesheet for PDF.

## Not built, documented as roadmap
Telegram or email nudge before the meeting (needs a bot token or a verified sending domain), recurring-event expansion in the calendar reader, email sign-in across devices, CRM sync (Affinity, Attio, HubSpot), warm-intro paths, multi-partner panel meetings, post-meeting follow-up drafts, WhatsApp delivery.

## Gemini facts used (ai.google.dev, checked 12 Oct 2026)
- `gemini-3.8-flash`: newest stable Flash. Paid-tier list price $0.75 / $3.75 per million input / output tokens through 31 Dec 2026.
- Grounding with Google Search: not available on the free tier; paid tier includes 5,000 free searches a month, then $14 per 1,000.
- Paid tier content is not used to improve Google products; free tier content may be. The demo uses a paid-tier key.
