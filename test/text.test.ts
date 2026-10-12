import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, extractPublishedDate, htmlToText, normalize, parseDate, quoteInText, relevantExcerpt } from '../lib/text';

test('normalize unifies quotes, dashes, case and whitespace', () => {
  assert.equal(normalize('  Peak XV’s   “Surge” — 12 '), `peak xv's "surge" - 12`);
});

test('parseDate accepts real-world sloppiness and rejects impossible dates', () => {
  assert.equal(parseDate('2026-09-29T24:39:07+05:30'), '2026-09-29'); // seen on a real Economic Times page
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate('garbage'), null);
});

test('extractPublishedDate reads meta, JSON-LD and time tags', () => {
  assert.equal(extractPublishedDate('<meta property="article:published_time" content="2026-09-29T11:48:48+05:30">'), '2026-09-29');
  assert.equal(extractPublishedDate('<script type="application/ld+json">{"datePublished":"2026-07-30T09:00:00Z"}</script>'), '2026-07-30');
  assert.equal(extractPublishedDate('<time datetime="2026-08-12">12 Aug</time>'), '2026-08-12');
  assert.equal(extractPublishedDate('<p>no date here</p>'), null);
});

test('quoteInText demands a real, verbatim span', () => {
  const src = 'Peak XV today announced Surge 12, its twelfth cohort of 18 startups, and raised its seed cheque ceiling to $5 million.';
  assert.ok(quoteInText('announced Surge 12, its twelfth cohort of 18 startups', src));
  assert.ok(quoteInText('ANNOUNCED  surge 12', src)); // case and spacing tolerant
  assert.ok(quoteInText('Peak XV today announced … seed cheque ceiling to $5 million', src)); // elided middle, in order
  assert.equal(quoteInText('raised a $500 million fund', src), false); // invented
  assert.equal(quoteInText('seed cheque ceiling … Peak XV today announced', src), false); // wrong order
  assert.equal(quoteInText('short', src), false); // too short to prove anything
});

test('htmlToText strips scripts, styles and tags', () => {
  const t = htmlToText('<style>.a{}</style><script>evil()</script><p>Hello &amp; <b>welcome</b></p>');
  assert.equal(t, 'Hello & welcome');
});

test('relevantExcerpt keeps paragraphs that mention the subject', () => {
  const body = ['Unrelated paragraph about something else entirely here.', 'Rajan Anandan led the round for the startup this week.', 'Another unrelated paragraph that is long enough to count.'].join('\n');
  assert.ok(relevantExcerpt(body, ['Anandan'], 500).includes('Rajan Anandan led'));
});

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-10-12', -90), '2026-07-14');
});
