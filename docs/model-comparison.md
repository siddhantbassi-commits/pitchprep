# Model comparison and what the checks caught

The exam fixes the model family: **Gemini Flash for every AI task, no Claude API**. So the useful comparisons here are about *how* Gemini Flash is used, and what happens when its output is trusted versus checked. Everything below was measured on this build.

## 1. Thinking level: `low` versus default

Same prompt (the "new investments in the last 90 days" research call for Rajan Anandan at Peak XV), same grounded search tool, run side by side:

| Setting | Time | Searches run | Thinking tokens |
|---|---|---|---|
| Default thinking | 48.4 s | 10 | 2,725 |
| `thinkingLevel: low` | 23.0 s | 7 | not reported |
| `minimal` | rejected by the model (HTTP 400) | | |

**Decision:** `low` everywhere. It roughly halves latency, which is what makes five parallel searches plus four more steps fit inside the two-minute requirement. The first full run before this change took 112 s and the deals search timed out; after it the same brief took 42 s.

## 2. One-shot grounded answer versus the verified pipeline

A single grounded Gemini Flash call can answer "give me a brief on this investor" and sounds convincing. Running the pipeline instead showed what that confidence hides. From the live evaluation (`docs/eval-report.md`), claims that the model produced and the checks removed or corrected:

Counts are for the six real investors, first evaluation run (before the judge fix) then the final run (after it); live search varies between runs, so the numbers differ slightly:

- **Quotes that were not in the source** were produced and removed by the gate: 3, then 1. The model "quoted" text the page did not contain.
- **Deals outside the 90-day window** were produced and removed: 5, then 8, e.g. a Chime IPO from June 2025 and a June 2026 round, presented next to current news.
- **Sources that were not about the investor** were removed: 3, then 0.
- **Deals with no date anywhere** were held back as "date unconfirmed" instead of being presented as recent: 3, then 5. One was a reported Oura stake sale by Forerunner, which may be real and current but could not be dated.
- **Claims the fact-check found unsupported** were dropped: 3 in the final run.
- **Mislabelled event type:** an IPO *filing* by a portfolio company was labelled an "exit". Fixed with a separate "milestone" category and an explicit rule.

### The independent spot-check, and the bug it found
After the first evaluation I checked 12 sampled claims against the live pages myself. Six could be opened by an ordinary fetch: four were fully right (including dates), and **two carried invented detail even though their quote was real**:

- "Seven Seven Six participated **as an existing backer** in Starcloud's round": the page lists 776 in the round but says nothing about prior investment.
- "Kalaari invested in JB Air **as a Seed round**": the page confirms the investment and the date but names no round.

The quote check alone cannot catch this, because the quote is genuine; the embellishment sits in the claim text. The fix, now in the pipeline: the fact-checking pass returns, for any claim it finds only partly supported, a **rewrite stating only what the quote says**, and that rewrite replaces the model's text (flagged "narrowed to the source" in the brief). The extractor is also told not to add round types, amounts, "led" or "existing investor" unless the quote says so. See [spot-check.md](spot-check.md) for the full table and an honest note on what the sample can and cannot show.

### Sentence for the examiner
Gemini Flash produced fluent, mostly right claims fast, but it also invented quotes, mixed in old deals and added unstated details; checking its output against the source text in code, narrowing partial claims to the quote, and dropping the rest is what makes the brief safe to say out loud to an investor.
