import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scenarioFromQuotes } from '../src/adapters/quotes.ts';
import { calculateExpiryPayoff } from '../src/domain/payoff.ts';
import { object } from '../src/shared/validation.ts';
const csv = readFileSync(new URL('../fixtures/quotes.synthetic.csv', import.meta.url), 'utf8');
const request = () => {
  const input: unknown = JSON.parse(
    readFileSync(new URL('../fixtures/quote-request.json', import.meta.url), 'utf8'),
  );
  return object(input, 'quote request fixture');
};
void test('snapshot chooses ask for long and bid for short with explicit provenance', () => {
  const result = scenarioFromQuotes(csv, request());
  assert.deepEqual(
    result.scenario.legs.map((l) => l.premium),
    ['5.00', '3.00'],
  );
  assert.deepEqual(
    result.provenance.selections.map((q) => q.source),
    ['synthetic', 'synthetic'],
  );
  assert.equal(calculateExpiryPayoff(result.scenario).rows[3].netPnl, '297.40');
});
for (const [name, edit] of [
  ['crossed market', (s) => s.replace('4.80,5.00', '5.10,5.00')],
  ['duplicate contract', (s) => s + s.split('\n')[1] + '\n'],
  ['bad header', (s) => s.replace('quote_at', 'date')],
  ['extra column', (s) => s.replace('100,synthetic', '100,synthetic,extra')],
  ['future quote', (s) => s.replaceAll('14:30:00', '14:32:00')],
  ['stale quote', (s) => s.replaceAll('14:30:00', '14:29:59')],
  ['missing contract', (s) => s.split('\n').slice(0, 2).join('\n')],
  ['ambiguous quoted cell', (s) => s.replace('DEMO', '"DEMO"')],
  ['subcent quote', (s) => s.replace('4.80', '4.801')],
] as [string, (s: string) => string][]) {
  void test(`snapshot rejects ${name}`, () =>
    assert.throws(() => scenarioFromQuotes(edit(csv), request())));
}
void test('request rejects invalid asOf and negative age', () => {
  const r = request();
  r.asOf = '2026-02-30T14:31:00Z';
  assert.throws(() => scenarioFromQuotes(csv, r));
  const r2 = request();
  r2.maxQuoteAgeSeconds = -1;
  assert.throws(() => scenarioFromQuotes(csv, r2));
});
