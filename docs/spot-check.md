# Independent spot-check of claims against live sources

Done by hand on 12 Oct 2026, after the first evaluation run and before the fix described below. I sampled 12 verified deal claims (two per example brief) and, for each, opened the cited page and asked whether it supports the claim and its date. This is separate from the pipeline's own checks, which can only compare text with text.

| # | Investor | Claim (as first shown) | Result |
|---|---|---|---|
| 1 | Kirsten Green | Forerunner and Tactile led a $60M Series D in Fora at $1B (finsmes.com) | Could not check: page blocks automated fetching (HTTP 403) |
| 2 | Kirsten Green | Forerunner led a $30M Series A in Natural, 20 Jul 2026 (valueaddvc.com) | **Correct**, including the date |
| 3 | Rajan Anandan | Peak XV joined a $280M round for Wispr Flow at $2B (economictimes) | Could not check: fetch blocked |
| 4 | Rajan Anandan | Peak XV-backed C2i Semiconductors acquired by Infineon (economictimes) | Not checked (time) |
| 5 | Garry Tan | Garry Tan angel investment in Horowitz Andreessen Academy (pitchbook) | Could not check: page blocks fetching (HTTP 403) |
| 6 | Garry Tan | Y Combinator the most active backer of US startups by deal count in Aug 2026, 18+ rounds of $5M+ (Crunchbase News) | **Correct**; published 14 Sep 2026 |
| 7 | Kunal Bahl | Titan Capital invested in xStep | Not checked (time) |
| 8 | Kunal Bahl | Bruno Milano raised INR 7.5 crore with Titan Capital | Not checked (time) |
| 9 | Alexis Ohanian | Seven Seven Six participated "as an existing backer" in Starcloud's $250M round at $2.3B (recentfunding.com) | **Partly wrong.** The round, amount, valuation and date are right and 776 is listed as a participant, but the page does not say "existing backer"; earlier rounds on the page do not list 776 |
| 10 | Alexis Ohanian | General Intuition $220M round | Not checked (time) |
| 11 | Vani Kola | Kalaari participated in byteXL's $9M Series B led by Elevar (kalaari.com) | **Correct** (page dated 8 Oct; claim date 7 Oct came from page metadata, off by one day) |
| 12 | Vani Kola | Kalaari invested in JB Air "as a Seed round", 4 Aug 2026 (kalaari.com) | **Partly wrong.** Investment and date are right, but the page names no round type |

**Result:** of the 6 claims I could open, 4 were fully correct and 2 were embellished with a detail the source does not state. The other 6 were blocked or not checked; this is a small sample and is reported as such.

## What changed because of it
The two errors had genuine quotes, so the quote-in-source check could not see them. The detail was added in the claim wording. Fix:
1. The fact-check pass now returns, for any partly supported claim, a rewrite stating only what the quote says, and that rewrite replaces the model's wording (shown as "narrowed to the source").
2. The extraction prompt forbids adding round types, amounts, "led" or "existing investor" unless the quote contains them.

After the fix the evaluation was re-run in full (see [eval-report.md](eval-report.md)) and the example briefs were regenerated. In a re-run of Alexis Ohanian none of the displayed deal claims carried an unstated qualifier. The Starcloud round did not come up in that run, so this is an observation, not proof that the fix works; the fix is judged by its design (the displayed text can only be what the quote supports) and the full re-run.

## What this does not establish
Six checked claims cannot show an error rate. The point of the exercise was to find a failure mode the automated checks missed, and it did. Every claim in the product links to its source so that the user can do this check in one click.
