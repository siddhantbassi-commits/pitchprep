# End-Term Build Plan: Pre-Meeting Investor Brief

Section 1 Final Exam, MESA Cohort C4. Working name: **PitchPrep** (change freely).

## 1. What the exam actually demands

| Requirement (from the booklet) | How we satisfy it | How we prove it |
|---|---|---|
| Two inputs only: investor name + firm | Single form, nothing else required | Landing page IS the form |
| Structured brief in **under 2 minutes** | Parallel collectors, 120 s hard deadline, partial brief on timeout, streamed progress | Latency p50/p95 on ops dashboard + eval report |
| Recent portfolio activity, **last 90 days** (investments + exits) | Window enforced **in code** on sourced dates, never by the LLM | Unit tests + eval check "0 deals outside window" |
| Publicly stated thesis | Quotes with source + date | Every thesis line links to a source |
| Context: sectors moved away from, controversies, portfolio pivots | Separate "Watch-outs" section, severity-tagged, sourced, neutral tone | Adversarial tests |
| 3 talking points tailored to **her startup's stage and sector** | Saved Founder Profile feeds synthesis; each point cites the verified claims it builds on | Brief shows the chain: point -> claims -> sources |
| **Live external data** wherever possible; works with some data at submission | Gemini Google Search grounding + Google News RSS + firm site fetch (+ SEC EDGAR for US funds); seeded real briefs pre-generated | Source chips with fetch timestamps; seeded briefs in history |
| **All AI = Gemini Flash, no Claude API** | One model env var (`GEMINI_MODEL`), no Claude fallback (TripSync had one: remove it here) | grep for `anthropic` in repo = 0 hits |
| Deploy on Vercel; submit URL + GitHub + Components Map | Vercel (team `mesa-school-of-business`, region `bom1`), GitHub `siddhantbassi-commits`, one-page map PDF | Grader dry-run checklist (section 9) |

## 2. The Cut, and the human boundary (your signature move from Cases 1-3)

The brief describes Priya's manual routine as including "scrolls through their LinkedIn posts". **We do not scrape LinkedIn** (ToS violation, brittle, and a legal liability). Replacement: public web + news + firm site, plus an optional "paste a post or link" box whose content is treated as user-supplied evidence and labelled as such. This is the Cut.

Related guardrails, all defensible in one sentence each:
- **Public, professional information only.** Nothing about family, health, home, personal social accounts, or minors. Enforced in the prompt and by a post-filter.
- **Controversies are reported, not adjudicated.** Only if sourced from a credible outlet, always dated, neutral wording, labelled "reported".
- **Unverified = absent.** A claim with no supporting quote in fetched text is dropped, and the brief says what we could not verify.
- **AI never contacts investors and never predicts whether they will invest.** It researches, cites, drafts angles. Priya picks the angle.

## 3. Architecture

```
Priya -> Next.js (Vercel, bom1) -> POST /api/briefs -> job row (Supabase)
        poll/stream progress  <-  pipeline runs via after()/waitUntil, maxDuration set

S0 Resolve     Flash+grounding: who is this person at this firm? ambiguous -> ask Priya to pick
S1 Collect     (parallel, 35 s cap each)
                 a. deals last 90d      b. thesis/public statements
                 c. portfolio context   d. firm facts (fund, cheque, stage)
               sources: Gemini google_search grounding, Google News RSS, firm site fetch, SEC EDGAR (US)
S2 Normalise   CODE: dedupe, canonical URL, extract publish date, tier sources, apply 90-day window
S3 Extract     Flash, JSON schema, NO tools: claims from evidence pack only, each with evidence id + verbatim quote
S4 Verify      CODE: evidence id exists, quote is a substring of fetched text, date in window.
               Flash judge only for borderline semantic entailment. Failures dropped and counted.
S5 Synthesise  Flash: fit snapshot + exactly 3 talking points from VERIFIED claims + Founder Profile
S6 Persist     brief, evidence, claims, cost, latency -> Supabase; render; optional Telegram/email
```

Design rules carried over from your earlier work:
- **Code decides, LLM extracts** (Aangan `qualify.ts`). Window, dedupe, confidence, verification are code and unit-tested.
- **Deterministic fallback so it never blocks** (TripSync templates / in-memory store). If grounding fails: RSS + site fetch still produce a thinner, honestly labelled brief.
- **Idempotent writes and an events/audit table** (Aangan `webhook_receipts`, `events`).
- **Two-pass retrieval then structuring.** Whether grounding and JSON schema can share one request is not documented on the grounding page, and separating them is more auditable anyway (we hold the evidence text, so quotes are checkable).

Time budget: S0 5 s, S1 35 s (parallel), S2 1 s, S3 15 s, S4 10 s, S5 10 s = ~75 s expected, 120 s hard stop that returns whatever is verified so far.

Stack: Next.js App Router + TypeScript + Tailwind, `@google/genai`, `@supabase/supabase-js` + Supabase Auth, zod, `node:test` via tsx (as in Aangan). Model: `gemini-3.8-flash` per the current Gemini docs (the docs list it as the newest stable Flash; the old `gemini-2.0-flash` is shut down and 2.5 Flash is restricted to existing users). Confirmed in the spike, kept in one env var.

## 4. Data model (Supabase, Mumbai region)

`founder_profiles` (user_id, startup, one_liner, sector, stage, raise_target, geography, traction, differentiators) ·
`investors` (name, firm, firm_domain, resolved_identity jsonb, aliases) ·
`meetings` (investor_id, starts_at, status, outcome, notes) ·
`briefs` (user_id, investor_id, status, stage_progress, brief jsonb, version, parent_brief_id, model, tokens_in/out, grounded_queries, cost_usd, latency_ms, confidence) ·
`evidence` (brief_id, url, domain, title, published_at, tier, text_hash, snippet, fetched_at, origin: web|rss|site|edgar|user) ·
`claims` (brief_id, section, text, evidence_ids, quote, event_date, verified, drop_reason) ·
`feedback` (brief_id, claim_id, verdict, comment) ·
`events` (source, type, payload) and `rate_limits`.

Upgrade over Aangan: that project was service-role-only because it had one user. This one is multi-user, so **RLS with `user_id = auth.uid()`** on every table; the pipeline uses the service key server-side only.

## 5. Beyond the brief (what makes it usable in real life)

**Tier 1, ships for sure (graded core)**
1. Founder Profile, set once, reused in every brief (talking points are meaningless without it).
2. Citations on every claim, source tier, fetch time, per-section confidence (computed from source count, tier, recency).
3. "What we couldn't verify / no recent activity found" instead of filler.
4. Live progress UI, history, search, copy-as-text, PDF export, mobile-friendly (briefs get read in a cab five minutes before the meeting).
5. Ops dashboard: briefs run, p50/p95 latency, % under 2 min, cost per brief, citation coverage, claims dropped, cache hit rate (Aangan's "cost of the tool doing it" idea).
6. Evaluation harness with a golden set (section 7).
7. Seeded real briefs so the site has data at submission.

**Tier 2, ships if time allows (differentiators)**
8. Delta brief: "what changed since your last brief on this investor", plus 24 h cache so repeat runs are instant and cheap.
9. Auto-brief: paste your Google Calendar secret iCal link (no OAuth review needed), a GitHub Actions cron (the Aangan watchdog pattern, since Vercel Hobby crons are daily-only) detects external investor meetings, resolves the investor from attendee email domain, generates the brief 2 hours before and sends a Telegram nudge (email as fallback). Telegram over email because the brief is read on a phone minutes before the meeting, and it is the same choice you already defended in Case 3.
10. Investor-fit snapshot: stage / sector / cheque-size match against their stated thesis, rule-based, so Priya can tell whether this meeting is worth a warm pitch.
11. "This is wrong" button per claim, feeding the eval set.
12. Read-only share link (for a co-founder), and a "paste a post/link" box.

**Tier 3, documented as roadmap, not built:** CRM sync (Affinity/Attio/HubSpot), warm-intro graph, panel meetings (multiple partners), post-meeting follow-up draft, WhatsApp delivery, team workspaces.

## 6. Security, privacy, compliance (the "defend it" section)

- Fetched web pages are **untrusted data**: wrapped in delimiters, model told to ignore instructions inside them, no side-effect tools exposed, output schema-constrained. Tested with a planted injection page.
- **SSRF guard** on any URL fetcher (block private/loopback ranges, cap size and redirects), since users can paste URLs. Respect robots.txt.
- Gemini free tier vs billing-enabled API differ in whether prompts may be used to improve Google's products (the same privacy question from your Case 2 block). Founder Profile is mildly confidential, so: demo runs on the free key with fictional profile data; real use requires a billing-enabled key. Documented.
- India DPDP: only public professional data about investors; user can delete their profile and all briefs (real button, real cascade delete).
- Rate limits per user/IP (Gemini quota protection and abuse control); guest "try it" mode limited to a few runs so graders hit no login wall.
- `.env.local` gitignored, no keys in client bundle, service key server-side only.

## 7. Evaluation (this is what separates "works" from "defensible")

Golden set of ~12 cases, hand-verified before we trust the output: 4 prominent Indian VC partners, 3 global, 2 lesser-known angels, 1 investor with no activity in 90 days, 1 name-collision case, 1 **fake person** (must answer "could not verify this person", not invent).
Metrics and targets: citation coverage 100% · fabricated claims 0 · deals outside 90 days 0 · verified-claim rate reported · p95 latency < 120 s · cost per brief reported.
Adversarial: injected page, "tell me about their divorce" (must refuse), investor with a real controversy (neutral, sourced), firm/name mismatch.
Unit tests: window logic, quote-substring verifier, SSRF guard, confidence scoring, dedupe.

## 8. Build phases (each ends with a checkpoint, like your B-1/B-2/B-3 sessions)

| # | Phase | Done when | Needs your sign-in |
|---|---|---|---|
| 0 | Accounts and repo | New GitHub repo, Supabase project (Mumbai), Vercel project linked, Gemini key in `.env.local` | GitHub, Supabase, Vercel, AI Studio |
| 1 | **De-risk spike (go/no-go)** | 5 real investors run end to end in a script: latency, grounding quality, citation yield, JSON reliability measured. Pipeline shape finalised on evidence | none |
| 2 | Core pipeline + schema + tests | CLI run produces a verified brief JSON; unit tests green | none |
| 3 | UI + streaming + brief page | Form -> live progress -> full brief on the deployed URL | none |
| 4 | Verification gate + eval harness | Golden set runs, eval report generated | none |
| 5 | Auth, RLS, Founder Profile, history, cache/delta, export, share | Two test users cannot see each other's data (tested) | Supabase Auth config |
| 6 | Tier 2: iCal auto-brief, Telegram nudge, feedback | Calendar meeting triggers a brief and a Telegram message | Telegram bot (BotFather) |
| 7 | Ops dashboard | KPIs and cost live from Supabase | none |
| 8 | Hardening | Rate limits, injection/SSRF tests, error and empty states, mobile and accessibility pass, keep-alive cron | none |
| 9 | Docs + Components Map + submission pack | See section 10 | none |
| 10 | Grader dry-run + monitoring | Clean-browser run (section 9), daily health check as you did for TripSync | none |

Lessons already learned from your repos, built in from day one: Supabase free projects auto-pause (keep-alive + health check), explicit `service_role` grants when auto-expose is off, functions pinned to `bom1`, Vercel runtime layout gotchas (the Aangan CommonJS fix is why we use Next.js here), real values in env with `.env.example` committed.

## 9. Grader experience checklist (the thing that actually gets marked)

Open the public URL in a private window and verify: loads fast, no login wall for the first run, type "name + firm", a brief appears in under 2 minutes with progress shown, every claim has a clickable source, 3 talking points reference the startup profile, seeded briefs are visible, a deliberately bad input (fake name) fails gracefully, mobile layout works, README setup works from scratch.

## 10. Deliverables

1. Public Vercel URL. 2. GitHub repo with README (setup, env vars, architecture). 3. **Components Map** (one page, same Trigger -> Input -> Context -> Processing -> AI -> Output grid and "HUMAN BOUNDARY" footer as `Aangan_Studio_Component_Map.pdf`). 4. `docs/` in your Case 1-3 style: Automation Brief (pain/user/outcome/journey today), Nine Checks + the Cut, SCOPE.md (decisions table, "Beyond the brief"), Eval report, Cost and model note, Data-privacy answers.

### Components Map, draft rows

| Actor | Trigger | Input | Context | Processing | AI | Output |
|---|---|---|---|---|---|---|
| **Priya** (Founder, human) | Investor meeting booked, or auto-detected from calendar | Investor name + firm (+ optional pasted context) | Her saved startup profile: stage, sector, raise | none | none | Live progress, then the brief |
| **PitchPrep app** (Next.js on Vercel) | Brief requested / scheduled calendar scan | Name, firm | Cached prior briefs, founder profile, source allowlist | Resolve identity, run collectors under a 120 s deadline, enforce 90-day window | none | Job id, streamed stages |
| **Live data layer** (Google Search grounding, Google News RSS, firm site, SEC EDGAR) | Collector fan-out | Queries built from name + firm | Robots/allowlist, SSRF guard | Fetch, extract date and text, dedupe, tier sources | Gemini grounded search | Evidence pack with URLs, dates, text |
| **Gemini Flash** | Evidence pack ready | Evidence only (+ founder profile for step 3) | JSON schemas, "evidence is untrusted data" rules | none | Extract claims with quotes, judge borderline entailment, draft fit + 3 talking points | Structured claims and talking points |
| **Verification gate** (code) | Claims returned | Claims + evidence | Window, quote text | Drop anything unsupported, compute confidence | none | Verified claims + "could not verify" list |
| **Supabase** | Every stage | Brief, evidence, claims, cost, latency | RLS per user | Persist, cache, rate-limit | none | History, delta baseline, audit trail |
| **Delivery** (web, PDF, Telegram/email) | Brief complete / 2 h before meeting | Verified brief | User channel prefs | Format for skim reading | none | Brief where she will actually read it |
| **Dashboard** (Vercel) | Priya/admin opens it | Supabase aggregates | none | KPIs | none | Latency, citation coverage, cost per brief |

**HUMAN BOUNDARY:** AI can research, cite, summarise and draft angles. It does not contact investors, assert unsourced facts, scrape LinkedIn, judge people, or predict funding. Which angle to use, and whether to take the meeting, stays with Priya.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Latency over 2 min | Parallel collectors, per-stage caps, partial brief at deadline, cache |
| Hallucinated investor facts | Quote-substring verification, drop unsupported, eval set with fake person |
| Gemini free-tier rate limits (key shared with other projects) | Dedicated key/project, backoff, user rate limits, cache |
| Vercel duration limits | Set `maxDuration`, run via `after()`, confirm plan limits in the spike |
| Supabase free tier: 2 active projects, auto-pause | Check slot now (you already have several projects), keep-alive cron |
| Thin results for obscure angels | Honest empty states, confidence labels, paste-in context |
| Name collisions | S0 disambiguation step with firm domain check |
| Grader tries something unexpected | Seeded data, graceful errors, guest mode, grader checklist |
