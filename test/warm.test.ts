import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMatch, firmCore, matchFirm, parseConnections, parseCsv, SAMPLE_CONTACTS, type Contact } from '../lib/warm';

const EXPORT = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Anil,Rao,https://www.linkedin.com/in/anilrao,anil@private.example,Fireside Ventures,Partner,03 Mar 2024
Meera,"Iyer, Jr.",https://www.linkedin.com/in/meera,,Peak XV,"Vice President, Consumer",19 Jan 2025
Sam,Lee,,sam@private.example,"Acme ""Labs"" Inc",Engineer,01 Jan 2020
,,,,,,
Priya,Nobody,,,,,05 May 2021
`;

test('csv reader handles quotes, commas and newlines inside quoted fields', () => {
  const r = parseCsv('a,"b, c","d ""e"""\n"line\nbreak",x,y\n');
  assert.deepEqual(r, [['a', 'b, c', 'd "e"'], ['line\nbreak', 'x', 'y']]);
});

test('a LinkedIn export is read past its notes, and email addresses are never kept', () => {
  const { contacts, skipped } = parseConnections(EXPORT);
  assert.equal(contacts.length, 3); assert.equal(skipped, 1); // the one with no company
  assert.equal(contacts[1].name, 'Meera Iyer, Jr.'); assert.equal(contacts[1].position, 'Vice President, Consumer');
  assert.ok(!JSON.stringify(contacts).includes('private.example'), 'email leaked');
  assert.equal(parseConnections('not a csv at all').contacts.length, 0);
});

test('firm names compare on their distinctive words', () => {
  assert.equal(firmCore('Peak XV Partners'), 'peak xv'); assert.equal(firmCore('Peak XV'), 'peak xv');
  assert.equal(firmCore('Titan Capital'), 'titan'); assert.equal(firmCore('Y Combinator'), 'y combinator');
});

const cs: Contact[] = [
  { name: 'Aditi Rao', company: 'Titan Capital', position: 'Associate', url: '', connectedOn: '' },
  { name: 'Karan Mehta', company: 'Titan Capital Winners Fund', position: 'Managing Partner', url: '', connectedOn: '' },
  { name: 'Kunal Bahl', company: 'Other Co', position: 'Founder', url: '', connectedOn: '' },
  { name: 'Zed', company: 'Titanic Shipping', position: 'Partner', url: '', connectedOn: '' },
  { name: 'Q', company: 'AB', position: 'Partner', url: '', connectedOn: '' },
];

test('matches by firm, strongest role first; look-alike names and very short names do not match', () => {
  const m = matchFirm(cs, 'Titan Capital');
  assert.deepEqual(m.map((x) => x.contact.name), ['Karan Mehta', 'Aditi Rao']);
  assert.equal(matchFirm(cs, 'AB Ventures').length, 0); // a 2-letter core is too weak to trust
});

test('being connected to the named investor beats everything', () => {
  const m = matchFirm(cs, 'Titan Capital', 'Kunal Bahl');
  assert.equal(m[0].contact.name, 'Kunal Bahl'); assert.equal(m[0].kind, 'person');
  assert.match(describeMatch(m[0], 'Titan Capital'), /already connected with Kunal Bahl/);
  assert.match(describeMatch(m[1], 'Titan Capital'), /Managing Partner, Titan Capital Winners Fund/);
});

test('sample contacts are unmistakably labelled and cover the example investors', () => {
  assert.ok(SAMPLE_CONTACTS.every((c) => /\(sample\)/.test(c.name)));
  for (const f of ['Forerunner Ventures', 'Peak XV Partners', 'Titan Capital', 'Fireside Ventures', 'Blume Ventures']) assert.ok(matchFirm(SAMPLE_CONTACTS, f).length >= 1, f);
  assert.equal(matchFirm(SAMPLE_CONTACTS, 'Y Combinator').length, 0);
});
