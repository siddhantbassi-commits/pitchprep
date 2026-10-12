# Three-minute tour (plus a two-minute email walkthrough)

Live app: https://pitchprep-three.vercel.app. No login. Everything below is real: nothing is mocked and no data is hard-coded.

| # | Do this | What you should see |
|---|---|---|
| 1 | Open **Home** and click an example chip (or type any investor and firm), then **Generate brief** | A live progress screen (search, read sources, extract, verify, write), then the brief in about a minute. The first line of the page says the founder is a **sample** (Priya, Sattva Kitchen) and how to use your own |
| 2 | In the brief, open **exact quote** under any claim and click its source | The verbatim sentence the claim was checked against, and the real article. Claims are dated; undated deals are held back or flagged |
| 3 | Click **Meeting card** | A large-type phone view: openers, key facts, watch-outs, questions to expect and to ask. Esc closes it |
| 4 | Scroll to **Questions to prepare for** and click **Practise this answer**; answer with a wrong number (say 40% repeat rate) | Coaching, plus a code-generated warning that 40 does not match the profile (34%) |
| 5 | On an example brief click **Add to my pipeline**, then use **After the meeting**: set a status, write notes, **Draft email** | Autosaved notes; an email drafted only from the notes and verified facts, with placeholders flagged. Nothing is sent |
| 6 | Open **Pipeline** | Every investor, ranked by fit, with status, next step and overdue flags; search, filters, notes |
| 7 | Open **Meetings** and click **Try with a sample calendar** | Five fictional meetings: two or three investors are detected, the customer and job candidate are not. **Prepare brief** creates a brief for that meeting |
| 7b | Scroll down on **Meetings** to **Email nudges** and follow the [email walkthrough](#email-nudges-walkthrough) below | Confirm-first email nudges: a preview of every email, a real test email, and one-tap links that open your brief on your phone |
| 8 | Type a made-up investor (for example *Zorblax Venmoor, Quantum Hearth Capital*) | The system refuses to invent a brief: "We could not verify this brief" |
| 9 | Open **Dashboard** and **Evidence** (footer) | Live latency, cost per brief, what the gate dropped; the stored evaluation results and the independent spot-check |
| 10 | Open **My startup** | Edit the founder profile (it feeds every talking point); **Delete all my data** really deletes |

Also try: **Listen** on a brief to hear it read aloud, the **Double-check before you say these** list near the top of a brief, **Find patterns in my notes** on the Pipeline page, **Draft an intro message** under a brief, press `⌘K` / `Ctrl+K` to jump anywhere, press `/` on Home to start typing, switch your device to dark mode, print or **Save as PDF** a brief, and resize to a phone width.

## Email nudges walkthrough

Where: **Meetings** page, under "Connect your calendar". Emails come from `pitchprep.nudges@gmail.com` (a dedicated sender), so check spam the first time.

| # | Do this | What you should see |
|---|---|---|
| E1 | Click **Preview** beside **Brief ready**, **Before the meeting**, **Follow-up reminder**, **Overdue next steps** and **Today's meetings** (no address needed to try this) | Each email exactly as it will arrive, built from your latest brief (or an example). Nothing is sent. The pre-meeting email shows "What's new since your last brief", or says plainly that nothing is |
| E2 | Type **your own email address** and click **Send confirmation** | A message saying a confirmation was sent. Only one confirmation email goes out, and a repeat request within the hour is politely refused |
| E3 | Open the email "Confirm your email for PitchPrep nudges" and click **Confirm my email** | You land back on Meetings with "Your email is confirmed. Nudges are on." Until you click, nothing else is ever sent to that address |
| E4 | Switch individual nudges on or off, and choose how long before a meeting the pre-meeting email arrives (1 to 4 hours) | Changes save instantly. Turning "Send me nudges" off stops everything without removing your address |
| E5 | Click **Send a test email** | A real email arrives within seconds, with a button that opens PitchPrep |
| E6 | Click **Email me a link to open on my phone**, then open that email on your phone | One tap and you are signed in there, with your briefs, pipeline and notes. The link works for 7 days |
| E7 | Click **Unsubscribe** at the bottom of any email (or Gmail's own Unsubscribe button next to the sender) | A page confirming you will stop receiving emails immediately. You can switch them back on from Meetings |
| E8 | Click **Remove my address** (or **Delete all my data** on My startup) | Your address is deleted. "Download my data" on My startup includes your email settings |

**What real nudges look like.** Connect your own calendar (Meetings, "Connect your calendar") with automatic preparation on. Every 30 minutes the server then: prepares briefs for investor meetings in the next 24 hours and emails "Your brief is ready"; about 3 hours before a meeting it re-researches a stale brief and, at your chosen lead time, emails the refreshed brief with what is new; the morning after a meeting it reminds you to follow up if you have not; and each morning it lists any overdue next steps and today's meetings. Each email is sent once, never twice. The sample calendar never auto-prepares, so use E1 and E5 to see the emails without waiting.

**Safeguards a reviewer may probe.**
- Confirm-first: no nudge is ever sent to an address that has not clicked its confirmation link.
- Caps: one confirmation per address per hour, a daily limit per person, and a daily limit across the whole site, so the sending account cannot be abused.
- Every email carries an unsubscribe link and the one-click `List-Unsubscribe` header.
- Email links are signed, expire, and can only redirect within PitchPrep. Do not forward a nudge: the one-tap link signs in whoever opens it.
- PitchPrep only drafts and researches. It never emails an investor on your behalf.
