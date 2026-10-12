export const metadata = { title: 'How it works: PitchPrep' };

const steps = [
  ['1. Search the live web', 'Five Gemini Flash research calls run in parallel with Google Search grounding (and, if Google's daily search quota is ever exhausted, the same Gemini model through OpenRouter's Google-grounded search): new investments, exits and milestones, stated thesis, portfolio context and firm facts.'],
  ['2. Open the sources', 'We resolve every citation to the real article, fetch it ourselves (respecting robots.txt, blocking private addresses), and read the publication date from the page.'],
  ['3. Extract claims with quotes', 'Gemini Flash, with no search tools, turns the evidence into short claims. Each must carry a word-for-word quote and the source it came from.'],
  ['4. Verify in code', 'The quote must appear in the source text, the source must be about this investor, deals must be dated inside the last 90 days, a stated view must name the investor or firm as the speaker, and duplicates are removed. A second Gemini pass fact-checks the survivors, and any claim it finds only partly supported is rewritten down to what the quote actually states.'],
  ['5. Write talking points and questions', 'Only verified claims reach this step, together with your startup profile. Each talking point must cite the claims it builds on, and you also get questions to ask the investor. A last fidelity check compares every opener with the claims it cites and rewrites anything that stretches them.'],
  ['6. After the meeting', 'Your notes, pipeline status and a follow-up email draft stay with you. Code checks every figure in a draft or a practice answer against your own startup profile, so a slip is caught before an investor hears it.'],
];

export default function Method() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold">How it works, and why you can rely on it</h1>
      <p className="mt-2 text-muted">A wrong fact about an investor is worse than no fact. So the design rule is simple: the AI proposes, code and sources decide.</p>
      <ol className="mt-6 grid gap-3">{steps.map(([t, d]) => <li key={t} className="card p-4"><h2 className="font-semibold">{t}</h2><p className="text-sm text-muted mt-1">{d}</p></li>)}</ol>

      <p className="mt-6 text-sm">Want proof rather than promises? <a className="underline font-medium" href="/evidence">See the evaluation results and the independent spot-check</a>.</p>

      <h2 className="mt-10 text-2xl font-semibold">What it deliberately does not do</h2>
      <ul className="mt-3 list-disc pl-5 space-y-2">
        <li><strong>It does not scrape LinkedIn.</strong> That breaks LinkedIn&apos;s terms and is brittle. Paste a post or bio yourself and it is used as a source labelled as yours.</li>
        <li><strong>It does not include personal-life information</strong>: family, health, home or personal social accounts.</li>
        <li><strong>It does not judge people.</strong> Controversies appear only when a credible outlet reported them, are attributed to that outlet, and are phrased as reported.</li>
        <li><strong>It does not predict.</strong> It never says what an investor will do. Which angle to use, and whether to take the meeting, is your call.</li>
        <li><strong>It does not guess.</strong> If a claim cannot be matched to a source quote, it is dropped, and the brief lists what was left out and why.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Limits you should know</h2>
      <ul className="mt-3 list-disc pl-5 space-y-2 text-muted">
        <li>It sees only what is publicly indexed. Private deals and unannounced rounds will not appear. &quot;Nothing found&quot; means nothing could be sourced, not that nothing happened.</li>
        <li>Paywalled articles may be read from Google&apos;s excerpt only; the brief marks these.</li>
        <li>Dates come from the article. When an article has no machine-readable date, deals from it are shown separately as unconfirmed rather than counted as recent.</li>
      </ul>

      <h2 className="mt-10 text-2xl font-semibold">Privacy</h2>
      <p className="mt-3 text-muted">Investor information is public and professional. Your startup profile is stored under a private, signed browser workspace, is sent to Gemini (paid tier, where content is not used to improve Google products) only to write your talking points, and can be erased completely from the My startup page.</p>
    </div>
  );
}
