# PitchPrep: scope and decisions

## The Cut
The workflow described includes reading the investor's LinkedIn posts. Not built. LinkedIn scraping breaks its terms and is brittle. Replacement: Google Search grounding over the public web, plus a "paste a post" box whose content is labelled as supplied by the user. See [nine-checks.md](nine-checks.md).

## Flow
Priya -> name + firm -> `POST /api/briefs` -> job row in Supabase -> background pipeline (`after()`):

1. **Collect**: five Gemini Flash calls in parallel with Google Search grounding (new investments, exits and milestones, thesis, context, firm facts).
2. **Sources**: resolve each citation redirect to the real URL, fetch the page (robots.txt respected, private addresses blocked), read publication date and text; add the firm's own site.
3. **Extract**: Gemini Flash with no tools turns the evidence into claims, each with a word-for-word quote.
4. **Verify**: code checks quote-in-source, source-about-investor, date window, duplicates; a Gemini fact-check pass judges the survivors.
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
| Unverified claims | Dropped and listed with a reason | Better a shorter brief than a wrong fact; the list shows the user exactly what was held back. |
| Access model | Signed-cookie private workspace, no login wall | A grader or a new user can run a brief immediately. Data is private per browser, with real deletion. Email sign-in can later attach to the same workspace. |
| Latency strategy | Parallel searches, per-stage time limits, 115 s hard deadline returning a partial brief | The exam's two-minute target must hold even when a stage is slow. |
| Cost reporting | Tokens at paid-tier list price plus grounded searches at list price | The dashboard reports what the tool costs to run. Google's first 5,000 searches a month are free, so actual spend is lower. |
| Hosting | Vercel (Mumbai `bom1`) and Supabase (Mumbai) | Same stack as the earlier cases; near the user. |

## Beyond the brief (built)
- Founder profile that tailors every talking point; editable.
- Citations, exact quotes and dates on every claim; per-section confidence computed from source count, tier and recency.
- "What we left out and why", and an honest "nothing found" state instead of filler.
- 6-hour cache for repeat investors; share link; copy as text; PDF export; refresh.
- Per-claim "Wrong? / Outdated?" feedback.
- Fit snapshot (stage, sector, cheque) calibrated to say "unknown" when the sources are silent.
- Ops dashboard: time to brief, share under two minutes, cost per brief, verification pass rate, what the gate dropped.
- Real "delete all my data" cascade.
- Prompt-injection and SSRF defences, rate limits, keep-alive endpoint.

## Not built, documented as roadmap
Calendar-triggered automatic briefs with a Telegram nudge before the meeting, "what changed since your last brief" deltas, email sign-in across devices, CRM sync (Affinity, Attio, HubSpot), warm-intro paths, multi-partner panel meetings, post-meeting follow-up drafts, WhatsApp delivery.

## Gemini facts used (ai.google.dev, checked 12 Oct 2026)
- `gemini-3.8-flash`: newest stable Flash. Paid-tier list price $0.75 / $3.75 per million input / output tokens through 31 Dec 2026.
- Grounding with Google Search: not available on the free tier; paid tier includes 5,000 free searches a month, then $14 per 1,000.
- Paid tier content is not used to improve Google products; free tier content may be. The demo uses a paid-tier key.
