import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareAnnualFinancials } from '../src/financial/comparison.ts';
import { extractAnnualFacts } from '../src/financial/companyfacts.ts';
import { parseComparisonRequest } from '../src/financial/contracts.ts';

const request = {
  cik: '0000000123',
  periods: [
    { accession: '0000000123-23-000001', start: '2022-01-01', end: '2022-12-31' },
    { accession: '0000000123-24-000001', start: '2023-01-01', end: '2023-12-31' },
  ],
};
function facts(values: [number, number]) {
  return request.periods.map((period, index) => ({
    accn: period.accession,
    start: period.start,
    end: period.end,
    form: '10-K',
    filed: `${index === 0 ? '2023' : '2024'}-02-01`,
    val: values[index],
  }));
}
function snapshot(revenue: [number, number] = [2000, 2500], income: [number, number] = [100, 250]) {
  return {
    cik: 123,
    entityName: 'SYNTHETIC EXAMPLE ONLY',
    facts: {
      'us-gaap': {
        RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: facts(revenue) } },
        NetIncomeLoss: { units: { USD: facts(income) } },
      },
    },
  };
}
const available = (value: string) => ({ status: 'available', value });
const unavailable = (reason: string) => ({ status: 'unavailable', reason });

void test('annual comparison matches independent arithmetic and exact source pointers', () => {
  const result = compareAnnualFinancials(snapshot(), request);
  assert.deepEqual(result.changes, {
    revenue: { differenceUsd: available('500'), percentChange: available('25.00') },
    netIncome: { differenceUsd: available('150'), percentChange: available('150.00') },
  });
  assert.deepEqual(
    result.periods.map((p) => p.netMarginPercent),
    [available('5.00'), available('10.00')],
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.periods[0].netIncome, {
    status: 'available',
    value: '100',
    citations: [
      {
        pointer: '/facts/us-gaap/NetIncomeLoss/units/USD/0',
        filedAt: '2023-02-01',
        accession: request.periods[0].accession,
      },
    ],
  });
});

void test('later restatements, quarterly values and amendments never replace exact as-filed values', () => {
  const data = snapshot();
  const list = data.facts['us-gaap'].NetIncomeLoss.units.USD;
  list.push(
    { ...list[0], accn: request.periods[1].accession, val: 999 },
    { ...list[0], start: '2022-10-01', val: 888 },
    { ...list[0], form: '10-K/A', val: 777 },
  );
  const result = compareAnnualFinancials(data, request);
  assert.deepEqual(result.changes.netIncome.differenceUsd, available('150'));
  list.shift();
  assert.deepEqual(
    compareAnnualFinancials(data, request).changes.netIncome.differenceUsd,
    unavailable('missing_fact'),
  );
});

void test('identical duplicate facts retain all citations; conflicting duplicates fail', () => {
  const data = snapshot();
  const list = data.facts['us-gaap'].NetIncomeLoss.units.USD;
  list.push({ ...list[0] });
  const result = extractAnnualFacts(data, request).periods[0].netIncome;
  assert.equal(result.status, 'available');
  if (result.status === 'available') {
    assert.equal(result.citations.length, 2);
  }
  list[2].val = 101;
  assert.throws(() => extractAnnualFacts(data, request), /conflicting facts/);
});

void test('conflicting filing dates fail rather than creating ambiguous citations', () => {
  const data = snapshot();
  const list = data.facts['us-gaap'].NetIncomeLoss.units.USD;
  list.push({ ...list[0], filed: '2023-02-02' });
  assert.throws(() => extractAnnualFacts(data, request), /conflicting facts/);
});

void test('missing concepts and unsupported currencies stay missing, never zero', () => {
  const empty = compareAnnualFinancials({ cik: 123, facts: {} }, request);
  assert.deepEqual(empty.periods[0].revenue, { status: 'missing', reason: 'concept_missing' });
  assert.deepEqual(empty.periods[0].netMarginPercent, unavailable('missing_fact'));
  const data = {
    cik: 123,
    facts: { 'us-gaap': { NetIncomeLoss: { units: { EUR: facts([100, 250]) } } } },
  };
  assert.deepEqual(extractAnnualFacts(data, request).periods[0].netIncome, {
    status: 'missing',
    reason: 'usd_unit_missing',
  });
});

for (const val of [
  1.5,
  Number.MAX_SAFE_INTEGER + 1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  '100',
  null,
]) {
  void test(`selected financial value must be a safe integer: ${String(val)}`, () => {
    const data = snapshot();
    const list = data.facts['us-gaap'].NetIncomeLoss.units.USD;
    const invalid = {
      ...data,
      facts: { 'us-gaap': { NetIncomeLoss: { units: { USD: [{ ...list[0], val }] } } } },
    };
    assert.throws(() => extractAnnualFacts(invalid, request), /must be an integer/);
  });
}

void test('difference remains exact beyond the safe JSON number range', () => {
  const result = compareAnnualFinancials(
    snapshot([100, 100], [-9007199254740991, 9007199254740991]),
    request,
  );
  assert.deepEqual(result.changes.netIncome.differenceUsd, available('18014398509481982'));
  assert.deepEqual(result.changes.netIncome.percentChange, unavailable('nonpositive_denominator'));
});

void test('negative profit and half-cent percentage ties round away from zero', () => {
  const result = compareAnnualFinancials(snapshot([32, 32], [1, -1]), request);
  assert.deepEqual(
    result.periods.map((p) => p.netMarginPercent),
    [available('3.13'), available('-3.13')],
  );
  assert.deepEqual(result.changes.netIncome.percentChange, available('-200.00'));
});

void test('zero and negative denominators do not generate misleading percentages', () => {
  const result = compareAnnualFinancials(snapshot([0, -1], [0, -1]), request);
  assert.deepEqual(result.changes.netIncome.percentChange, unavailable('nonpositive_denominator'));
  assert.deepEqual(
    result.periods.map((p) => p.netMarginPercent),
    [unavailable('nonpositive_denominator'), unavailable('nonpositive_denominator')],
  );
});

void test('tiny negative ratios round to unsigned zero', () => {
  const result = compareAnnualFinancials(snapshot([100000, 100000], [-1, -1]), request);
  assert.deepEqual(result.periods[0].netMarginPercent, available('0.00'));
});

void test('52/53-week comparison explicitly reports unequal durations', () => {
  const input = {
    cik: request.cik,
    periods: [
      { ...request.periods[0], start: '2022-09-25', end: '2023-09-30' },
      { ...request.periods[1], start: '2023-10-01', end: '2024-09-28' },
    ],
  };
  const result = compareAnnualFinancials({ cik: 123, facts: {} }, input);
  assert.deepEqual(
    result.periods.map((p) => p.durationDays),
    [371, 364],
  );
  assert.deepEqual(result.warnings, ['unequal_period_lengths']);
});

for (const input of [
  { ...request, extra: true },
  { ...request, cik: '123' },
  { ...request, periods: [request.periods[0]] },
  { ...request, periods: [...request.periods].reverse() },
  { ...request, periods: [request.periods[0], request.periods[0]] },
  { ...request, periods: [{ ...request.periods[0], start: '2022-02-30' }, request.periods[1]] },
  { ...request, periods: [{ ...request.periods[0], start: '2022-10-01' }, request.periods[1]] },
  { ...request, periods: [request.periods[0], { ...request.periods[1], start: '2023-01-02' }] },
  { ...request, periods: [request.periods[0], { ...request.periods[1], extra: true }] },
]) {
  void test(`invalid comparison request rejected: ${JSON.stringify(input)}`, () => {
    assert.throws(() => parseComparisonRequest(input));
  });
}

void test('invalid source structure, wrong company and invalid filing chronology fail', () => {
  for (const data of [
    null,
    { cik: 124, facts: {} },
    { cik: 123, facts: [] },
    { cik: 123, facts: { 'us-gaap': null } },
  ]) {
    assert.throws(() => extractAnnualFacts(data, request));
  }
  const data = snapshot();
  const fact = data.facts['us-gaap'].NetIncomeLoss.units.USD[0];
  fact.filed = '2023-02-30';
  assert.throws(() => extractAnnualFacts(data, request), /calendar date/);
  fact.filed = '2021-01-01';
  assert.throws(() => extractAnnualFacts(data, request), /precedes/);
});

void test('extracted facts and parsed requests are detached from mutable inputs', () => {
  const input = structuredClone(request);
  const data = snapshot();
  const result = extractAnnualFacts(data, input);
  input.periods[0].start = '2022-10-01';
  data.facts['us-gaap'].NetIncomeLoss.units.USD[0].val = 999;
  assert.equal(result.periods[0].period.start, '2022-01-01');
  assert.equal(result.periods[0].netIncome.status, 'available');
  if (result.periods[0].netIncome.status === 'available') {
    assert.equal(result.periods[0].netIncome.value, '100');
  }
});
