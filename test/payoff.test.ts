import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateExpiryPayoff, parseScenario } from '../src/domain/payoff.ts';
import { cents, money } from '../src/domain/money.ts';
const fixture = () => {
  const input: unknown = JSON.parse(readFileSync(new URL('../fixtures/call-spread.json', import.meta.url), 'utf8'));
  return parseScenario(input);
};
type InvalidScenario = { currency: unknown; legs: Record<string, unknown>[]; prices: unknown; extra?: unknown };
function invalidFixture(): InvalidScenario {
  const value = fixture();
  return { ...value, legs: value.legs.map(leg => ({ ...leg })) };
}
void test('call debit spread matches independent hand calculations at and around strikes', () => {
  assert.deepEqual(calculateExpiryPayoff(fixture()).rows.map(r => r.netPnl), ['-202.60','-202.60','-2.60','297.40','297.40']);
});
void test('long and short puts, quantity, fees and explicit multiplier', () => {
  const s = fixture(); s.legs = [s.legs[0]]; s.legs[0] = {...s.legs[0],type:'put',quantity:2,multiplier:10,premium:'3',feesPerContract:'0.50'}; s.prices=['90','100','110'];
  assert.deepEqual(calculateExpiryPayoff(s).rows.map(r=>r.netPnl), ['139.00','-61.00','-61.00']);
  s.legs[0].side='short';
  assert.deepEqual(calculateExpiryPayoff(s).rows.map(r=>r.netPnl), ['-141.00','59.00','59.00']);
});
void test('decimal arithmetic is exact including a zero scenario price', () => {
  assert.equal(money(cents('0.10')+cents('0.20')), '0.30');
  const s=fixture(); s.legs=[{...s.legs[0],premium:'0.10',strike:'0.20',multiplier:1,feesPerContract:'0'}];s.prices=['0','0.50'];
  assert.deepEqual(calculateExpiryPayoff(s).rows.map(r=>r.netPnl), ['-0.10','0.20']);
});
void test('opposite identical legs cancel before fees', () => {
  const s=fixture();s.legs=[s.legs[0],{...s.legs[0],side:'short'}];
  assert.ok(calculateExpiryPayoff(s).rows.every(r=>r.netPnl==='-2.60'));
});
const invalidCases: [string, (scenario: InvalidScenario) => void][] = [
  ['zero quantity',s=>s.legs[0].quantity=0], ['fraction quantity',s=>s.legs[0].quantity=1.5],
  ['negative premium',s=>s.legs[0].premium='-1'], ['numeric premium',s=>s.legs[0].premium=1],
  ['subcent price',s=>s.prices=['1.001']], ['nan price',s=>s.prices=['NaN']],
  ['mixed symbol',s=>s.legs[1].symbol='OTHER'], ['mixed expiry',s=>s.legs[1].expiration='2027-02-01'],
  ['invalid calendar date',s=>s.legs[0].expiration='2027-02-30'], ['invalid side',s=>s.legs[0].side='buy'],
  ['empty legs',s=>s.legs=[]], ['unknown field',s=>s.extra=true], ['invalid currency',s=>s.currency='EUR']
];
for (const [label, change] of invalidCases) {
  void test(`rejects ${label}`,()=>{ const s=invalidFixture();change(s);assert.throws(()=>calculateExpiryPayoff(s)); });
}

void test('large aggregates remain exact beyond the input amount range', () => {
  const s=fixture();s.legs=[{...s.legs[0],premium:'1',quantity:100000,multiplier:100000,feesPerContract:'0'}];s.prices=['100'];
  assert.equal(calculateExpiryPayoff(s).rows[0].netPnl, '-10000000000.00');
});

void test('scenario requires own fields and rejects sparse programmatic arrays', () => {
  const inherited = { legs: fixture().legs, prices: ['100'] };
  Object.setPrototypeOf(inherited, { currency: 'USD' });
  assert.throws(() => parseScenario(inherited), /exactly/);
  assert.throws(() => parseScenario({ ...fixture(), legs: new Array<unknown>(1) }));
  assert.throws(() => parseScenario({ ...fixture(), prices: new Array<unknown>(1) }));
});
