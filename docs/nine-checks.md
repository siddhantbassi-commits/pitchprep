# Nine Checks: End Term, Problem 1 / Priya

## Kill Switches: any No = do not build

| # | Check | Evidence | Pass/Fail |
|---|-------|----------|-----------|
| 01 | **Problem Real**: documented, ongoing pain? | Three months of fundraising; three to four investor meetings a week; about 45 minutes of manual prep each, so roughly three hours a week (problem statement). | YES |
| 02 | **Workflow Repeated**: recurs regularly? | Every week, for the length of the raise. The steps (search, scan posts, check portfolio, read interviews, write notes) are the same for every investor. | YES |
| 03 | **Input Available**: do inputs exist now? | Two inputs only, both known when the meeting is booked: investor name and firm. The public web supplies the rest. **One part of the described workflow fails this check**: LinkedIn posts are not an input we are entitled to collect (see The Cut). | YES, except LinkedIn |

## Sizing: any No = build something smaller

| # | Check | Evidence | Pass/Fail |
|---|-------|----------|-----------|
| 04 | **Output Valuable**: would someone act on it? | A brief with three tailored talking points is used directly in the meeting. It gives back about three hours a week to product and team. | YES |
| 05 | **Impact Measurable**: trackable with a number? | Baseline 45 minutes of prep. Tracked on the dashboard: time to brief (target under 2 minutes), verification pass rate, sources per brief, cost per brief, and user "wrong / outdated" reports. | YES |
| 08 | **ROI Worth It**: benefit clearly outweighs cost? | About $0.20 per brief at list price (about $0.07 inside Google's 5,000 free searches a month) against 45 minutes of founder time. Hosting is Vercel plus Supabase. | YES |

## Boundary: any No = build the tool, human stays here

| # | Check | Evidence | Pass/Fail |
|---|-------|----------|-----------|
| 06 | **Failure Risk OK**: consequence if AI is wrong? | The real risk is Priya repeating a wrong fact to an investor. Mitigated: every claim must carry an exact quote found in the source text, deals must be dated inside 90 days, a second pass fact-checks, anything unverified is dropped and listed, and each claim links to its source so she can check in one click. Nothing is sent to anyone. | YES |
| 07 | **Judgment Protected**: human decides before anything consequential? | The system researches and drafts angles. It never contacts an investor, never predicts what they will do, and labels controversies as "reported by <outlet>" rather than judging them. Which angle to use, and whether to take the meeting, stays with Priya. | YES |
| 09 | **Owner Clear**: one person accountable? | Priya owns the use of every brief and every meeting decision. | YES |

## The Cut

**Check partly failed: 03, Input Available (the LinkedIn step).**

Priya's manual routine includes "scrolls through their LinkedIn posts". The tool does **not** do this. Scraping LinkedIn breaks its terms, is brittle, and would put a legal liability inside a founder's workflow. Instead:

- Stated views come from public interviews, podcasts, essays, the firm's own pages and press, found through Google Search grounding.
- If she wants a specific LinkedIn post included, she **pastes it herself** under "Add context". It is treated as a source she supplied and is labelled as hers, never presented as something we retrieved.

A related boundary (Check 07): "red flags" in the brief is not built as a verdict. The Watch-outs section reports sourced facts (executive departures, portfolio layoffs, a retreat from a sector) attributed to the outlet that reported them. Anything personal (family, health, home, personal social accounts) is excluded by rule.
