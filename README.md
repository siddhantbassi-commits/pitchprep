# PitchPrep: pre-meeting investor briefs

MESA Cohort C4, AI and its Applications, Section 1 Final Examination, Problem 1 (Pre-Meeting Investor Brief).

Enter an investor's name and firm. Get a structured, sourced, fact-checked brief in about a minute: recent portfolio activity (last 90 days), publicly stated thesis, watch-outs, three talking points tailored to your startup, and a verification trail. All AI is Gemini Flash.

- **Live app:** https://pitchprep-three.vercel.app
- **Repository:** https://github.com/siddhantbassi-commits/pitchprep
- **Components Map:** [docs/Components-Map.pdf](docs/Components-Map.pdf)
- **Scope and decisions:** [docs/SCOPE.md](docs/SCOPE.md) · **Automation brief:** [docs/automation-brief.md](docs/automation-brief.md) · **Nine checks and the Cut:** [docs/nine-checks.md](docs/nine-checks.md)
- **Evidence:** [docs/eval-report.md](docs/eval-report.md) (live evaluation) · [docs/model-comparison.md](docs/model-comparison.md)

## How it works
Five parallel Gemini Flash searches (Google Search grounding) -> open and date every source -> extract claims with exact quotes (no tools) -> verify in code (quote in source, about this investor, dated inside 90 days, no duplicates) plus a fact-check pass -> write talking points from verified claims only. Code, not the model, decides what is shown. Details in [docs/SCOPE.md](docs/SCOPE.md).

## Run locally
```bash
npm install
cp .env.example .env.local      # fill in GEMINI_API_KEY and the Supabase values
npm run db:setup -- --create    # optional: creates the Supabase project and applies supabase/schema.sql
npm run dev
```
Or apply `supabase/schema.sql` yourself in the Supabase SQL editor.

| Command | What it does |
|---|---|
| `npm test` | 31 unit tests (verification gate, dates, quotes, SSRF guard, robots, tiers, delta, calendar parser) |
| `npm run seed` | Generate the example briefs shown on the home page (live data) |
| `npm run cal-test -- file.ics` | Test investor-meeting detection on a calendar file |
| `npm run run -- "Name" "Firm"` | Run the whole pipeline in the terminal, no database needed |
| `npm run eval` | Golden-set evaluation (writes docs/eval-report.md) |
| `npm run typecheck` | TypeScript check |

## Environment
`GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.8-flash`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. The service key is used only on the server; browsers never talk to the database.

## Beyond the brief
Founder profile for tailored talking points · every claim cited with exact quote and date · "what we left out and why" · 6-hour cache and "what changed since last time" · share link, copy text, PDF · **calendar link that finds investor meetings and prepares briefs automatically** · ops dashboard with cost per brief · per-claim feedback · real data deletion · prompt-injection, SSRF and rate-limit protections · keep-alive and health checks.

## What it deliberately does not do
No LinkedIn scraping, nothing personal about anyone, no predictions, no contacting investors, no claim without a quote from its source.
