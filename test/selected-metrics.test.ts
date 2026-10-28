import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compareSelectedMetrics } from '../src/financial/selected-metrics.ts';
import { compareAnnualFinancials } from '../src/financial/comparison.ts';
import { parseMetricsRequest } from '../src/financial/metrics-contracts.ts';
import { retrieveCompanyFacts } from '../src/sec/companyfacts-retrieval.ts';
import { runCommand } from '../src/cli/commands.ts';

const request = {
  cik: '0000000123',
  periods: [
    { accession: '0000000123-23-000001', start: '2022-01-01', end: '2022-12-31' },
    { accession: '0000000123-24-000001', start: '2023-01-01', end: '2023-12-31' },
  ],
  metrics: ['operatingCashFlow'],
};

function snapshot(values: [number, number] = [300, 450]) {
  return {
    cik: 123,
    facts: {
      'us-gaap': {
        NetCashProvidedByUsedInOperatingActivities: {
          units: {
            USD: request.periods.map((period, index) => ({
              start: period.start,
              end: period.end,
              accn: period.accession,
              form: '10-K',
              filed: `${2023 + index}-02-01`,
              val: values[index],
            })),
          },
        },
      },
    },
  };
}

void test('cash flow selection preserves exact USD facts, citations and independent change arithmetic', () => {
  const result = compareSelectedMetrics(snapshot(), request);
  assert.equal(result.basis, 'as-filed-selected-metrics');
  assert.equal(result.metrics.length, 1);
  const metric = result.metrics[0];
  assert.equal(metric.metric, 'operatingCashFlow');
  assert.equal(metric.concept, 'NetCashProvidedByUsedInOperatingActivities');
  assert.deepEqual(metric.change, {
    differenceUsd: { status: 'available', value: '150' },
    percentChange: { status: 'available', value: '50.00' },
  });
  assert.deepEqual(metric.observations[0], {
    status: 'available',
    value: '300',
    citations: [
      {
        pointer: '/facts/us-gaap/NetCashProvidedByUsedInOperatingActivities/units/USD/0',
        filedAt: '2023-02-01',
        accession: request.periods[0].accession,
      },
    ],
  });
  assert.deepEqual(result.warnings, []);
});

void test('selection is explicit, ordered and does not add unrequested metrics', () => {
  const data: unknown = JSON.parse(
    readFileSync(new URL('../fixtures/metrics.synthetic.json', import.meta.url), 'utf8'),
  );
  const result = compareSelectedMetrics(data, {
    ...request,
    metrics: ['netIncome', 'operatingCashFlow', 'revenue'],
  });
  assert.deepEqual(
    result.metrics.map((m) => m.metric),
    ['netIncome', 'operatingCashFlow', 'revenue'],
  );
  assert.deepEqual(
    result.metrics.map((m) => m.change.differenceUsd),
    [
      { status: 'available', value: '150' },
      { status: 'available', value: '150' },
      { status: 'available', value: '500' },
    ],
  );
});

void test('negative operating cash flow is valid; nonpositive prior cash flow disables growth rate', () => {
  const result = compareSelectedMetrics(snapshot([-300, 450]), request).metrics[0];
  assert.deepEqual(result.change, {
    differenceUsd: { status: 'available', value: '750' },
    percentChange: { status: 'unavailable', reason: 'nonpositive_denominator' },
  });
  assert.deepEqual(
    compareSelectedMetrics(snapshot([300, -450]), request).metrics[0].change.percentChange,
    { status: 'available', value: '-250.00' },
  );
});

void test('missing concept is unavailable rather than zero or a free cash flow approximation', () => {
  const result = compareSelectedMetrics({ cik: 123, facts: {} }, request).metrics[0];
  assert.deepEqual(result.observations, [
    { status: 'missing', reason: 'concept_missing' },
    { status: 'missing', reason: 'concept_missing' },
  ]);
  assert.deepEqual(result.change.differenceUsd, { status: 'unavailable', reason: 'missing_fact' });
});

void test('unsupported units and alternate concepts are not silently substituted', () => {
  const source = snapshot();
  const rows = source.facts['us-gaap'].NetCashProvidedByUsedInOperatingActivities.units.USD;
  const eur = {
    cik: 123,
    facts: { 'us-gaap': { NetCashProvidedByUsedInOperatingActivities: { units: { EUR: rows } } } },
  };
  assert.deepEqual(compareSelectedMetrics(eur, request).metrics[0].observations[0], {
    status: 'missing',
    reason: 'usd_unit_missing',
  });
  const alternate = {
    cik: 123,
    facts: {
      'us-gaap': {
        NetCashProvidedByUsedInOperatingActivitiesContinuingOperations: { units: { USD: rows } },
      },
    },
  };
  assert.deepEqual(compareSelectedMetrics(alternate, request).metrics[0].observations[0], {
    status: 'missing',
    reason: 'concept_missing',
  });
});

void test('cash flow extraction rejects conflicting facts and ignores other filings and periods', () => {
  const data = snapshot();
  const rows = data.facts['us-gaap'].NetCashProvidedByUsedInOperatingActivities.units.USD;
  rows.push({ ...rows[0], accn: request.periods[1].accession, val: 999 });
  rows.push({ ...rows[0], form: '10-K/A', val: 888 });
  rows.push({ ...rows[0], start: '2022-10-01', val: 777 });
  assert.deepEqual(compareSelectedMetrics(data, request).metrics[0].change.differenceUsd, {
    status: 'available',
    value: '150',
  });
  rows.push({ ...rows[0], val: 301 });
  assert.throws(() => compareSelectedMetrics(data, request), /conflicting facts/);
});

void test('cash flow still requires safe integer USD inputs and computes large differences exactly', () => {
  const result = compareSelectedMetrics(snapshot([-9007199254740991, 9007199254740991]), request);
  assert.deepEqual(result.metrics[0].change.differenceUsd, {
    status: 'available',
    value: '18014398509481982',
  });
  for (const invalid of [0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => compareSelectedMetrics(snapshot([invalid, 450]), request),
      /must be an integer/,
    );
  }
});

void test('metric requests reject missing, unknown, duplicate, excessive and sparse selections', () => {
  const { metrics, ...withoutMetrics } = request;
  assert.equal(metrics.length, 1);
  for (const input of [
    withoutMetrics,
    { ...request, metrics: [] },
    { ...request, metrics: ['freeCashFlow'] },
    { ...request, metrics: ['constructor'] },
    { ...request, metrics: ['__proto__'] },
    { ...request, metrics: ['revenue', 'revenue'] },
    { ...request, metrics: ['revenue', 'netIncome', 'operatingCashFlow', 'revenue'] },
    { ...request, metrics: Array.from({ length: 1 }) },
    { ...request, metrics: new Array<unknown>(1) },
    { ...request, metrics: 'operatingCashFlow' },
    { ...request, extra: true },
    { ...request, periods: [...request.periods].reverse() },
  ]) {
    assert.throws(() => parseMetricsRequest(input));
  }
});

void test('metric requests and selected observations are isolated from mutable caller inputs', () => {
  const input = structuredClone(request);
  const data = snapshot();
  const parsed = parseMetricsRequest(input);
  const result = compareSelectedMetrics(data, input);
  input.metrics[0] = 'revenue';
  input.periods[0].start = '2020-01-01';
  data.facts['us-gaap'].NetCashProvidedByUsedInOperatingActivities.units.USD[0].val = 999;
  assert.deepEqual(parsed.metrics, ['operatingCashFlow']);
  assert.equal(result.metrics[0].metric, 'operatingCashFlow');
  assert.equal(result.periods[0].start, '2022-01-01');
  assert.deepEqual(result.metrics[0].change.differenceUsd, { status: 'available', value: '150' });
});

void test('legacy annual comparison retains its default output and refuses the new request shape', () => {
  const data: unknown = JSON.parse(
    readFileSync(new URL('../fixtures/metrics.synthetic.json', import.meta.url), 'utf8'),
  );
  const oldRequest = { cik: request.cik, periods: request.periods };
  const result = compareAnnualFinancials(data, oldRequest);
  assert.deepEqual(Object.keys(result.changes), ['revenue', 'netIncome']);
  assert.deepEqual(Object.keys(result.periods[0]), [
    'period',
    'revenue',
    'netIncome',
    'durationDays',
    'netMarginPercent',
  ]);
  assert.deepEqual(result.periods[0].netMarginPercent, { status: 'available', value: '5.00' });
  assert.throws(() => compareAnnualFinancials(data, request), /must contain exactly/);
});

void test('raw and cached metric commands preserve source integrity and refuse invalid commands', async (t) => {
  const raw = readFileSync(new URL('../fixtures/metrics.synthetic.json', import.meta.url), 'utf8');
  const result = await runCommand(
    ['financial-metrics', 'fixtures/metrics.synthetic.json', 'fixtures/metrics-request.json'],
    {},
  );
  assert.ok(result && typeof result === 'object' && 'provenance' in result && 'metrics' in result);
  assert.deepEqual(result.provenance, {
    expectedSourceUrl: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000123.json',
    snapshotSha256: createHash('sha256').update(raw).digest('hex'),
    byteLength: Buffer.byteLength(raw),
    verification: 'local-content-hash-only',
  });
  const root = await mkdtemp(join(tmpdir(), 'cash-flow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cached = await retrieveCompanyFacts('0000000123', root, {
    userAgent: 'Tests contact@example.invalid',
    sleep: () => Promise.resolve(),
    fetch: () =>
      Promise.resolve(new Response(raw, { headers: { 'content-type': 'application/json' } })),
  });
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('offline');
  });
  const second = await runCommand(
    ['financial-metrics-cached', cached.directory, 'fixtures/metrics-request.json'],
    {},
  );
  assert.ok(second && typeof second === 'object' && 'provenance' in second && 'metrics' in second);
  assert.deepEqual(second.metrics, result.metrics);
  assert.deepEqual(second.provenance, {
    ...cached.manifest.artifact,
    verification: 'cache-integrity-and-identity',
  });
  await writeFile(join(cached.directory, `${cached.manifest.artifact.sha256}.blob`), 'corrupt');
  await assert.rejects(
    runCommand(['financial-metrics-cached', cached.directory, 'fixtures/metrics-request.json'], {}),
    /integrity mismatch/,
  );
  await assert.rejects(
    runCommand(['financial-metrics', 'fixtures/metrics.synthetic.json'], {}),
    /Usage:/,
  );
  await assert.rejects(
    runCommand(
      ['financial-metrics', 'fixtures/metrics.synthetic.json', 'fixtures/financial-request.json'],
      {},
    ),
    /must contain exactly/,
  );
});
