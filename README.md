# PitchPrep: pre-meeting investor briefs

MESA Cohort C4, AI and its Applications, Section 1 Final Examination, Problem 1 (Pre-Meeting Investor Brief).

Enter an investor's name and firm. Get a structured, sourced, fact-checked brief in about a minute: recent portfolio activity (last 90 days), publicly stated thesis, watch-outs, three talking points tailored to your startup, and a verification trail. All AI is Gemini Flash.

- **Live app:** https://pitchprep-three.vercel.app
- **Repository:** https://github.com/siddhantbassi-commits/pitchprep
- **Components Map:** [docs/Components-Map.pdf](docs/Components-Map.pdf)
- **Scope and decisions:** [docs/SCOPE.md](docs/SCOPE.md) · **Automation brief:** [docs/automation-brief.md](docs/automation-brief.md) · **Nine checks and the Cut:** [docs/nine-checks.md](docs/nine-checks.md)
- **Evidence:** [docs/eval-report.md](docs/eval-report.md) (live evaluation) · [docs/model-comparison.md](docs/model-comparison.md)

## See it

<p align="center"><img src="docs/screenshots/brief.png" alt="A finished brief: 20-second summary, fit with the founder's startup, and three talking points, each built on cited claims" width="760"></p>

| Home | Evidence (live evaluation) | Dashboard |
|---|---|---|
| <img src="docs/screenshots/home.png" alt="Home page with the investor form" width="280"> | <img src="docs/screenshots/evidence.png" alt="Evidence page with evaluation results" width="280"> | <img src="docs/screenshots/dashboard.png" alt="Dashboard with time to brief and cost per brief" width="280"> |

**Components Map** ([PDF](docs/Components-Map.pdf)):

<img src="docs/Components-Map.png" alt="Components Map: Trigger, Input, Context, Processing, AI and Output for every actor" width="900">

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
| `npm test` | 69 unit tests (verification gate, dates, quotes, SSRF guard, robots, tiers, delta, calendar parser, number checker, email layout, encryption, nudge scheduling, signed links, email templates) |
| `npm run seed` | Generate the example briefs shown on the home page (live data; a thin run is retried up to twice, unlike the evaluation, which is never filtered) |
| `npm run cal-test -- file.ics` | Test investor-meeting detection on a calendar file |
| `npm run run -- "Name" "Firm"` | Run the whole pipeline in the terminal, no database needed |
| `npm run eval` | Golden-set evaluation (writes docs/eval-report.md) |
| `npm run typecheck` | TypeScript check |

## Environment
`GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.8-flash`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. The service key is used only on the server; browsers never talk to the database.

## Beyond the brief
Not just a brief: the whole fundraising workflow around it.
- **Before:** founder profile, cited and quoted claims, fit snapshot, questions to ask *them*, phone-friendly **meeting card**, **calendar link** that finds investor meetings and prepares briefs automatically (try it with a sample calendar), compared-with-last-time panel.
- **After:** investor **pipeline** ranked by fit with status, next step and notes; **follow-up email draft** from her notes; **answer rehearsal** where code checks every figure against her profile.
- **Nudges:** confirm-first **email nudges** (brief ready, a refreshed brief with what is new before the meeting, follow-up and overdue reminders) with one-tap links that sign you in on your phone; **double-check list**, **listen mode**, **patterns across your notes**, **intro-message drafts**, **⌘K palette**.
- **Trust:** per-claim feedback, ops dashboard with cost per brief, in-product [Evidence page](https://pitchprep-three.vercel.app/evidence), real data deletion, injection / SSRF / rate-limit protections, accessibility, dark mode, installable on a phone.

New here? Follow the [three-minute tour](docs/tour.md).

## What it deliberately does not do
No LinkedIn scraping, nothing personal about anyone, no predictions, no contacting investors, no claim without a quote from its source.
