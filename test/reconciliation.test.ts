import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retrieveCompanyFacts } from '../src/sec/companyfacts-retrieval.ts';
import { runCommand } from '../src/cli/commands.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { reconcileAnnualFinancials } from '../src/financial/reconciliation.ts';
import { parseReconciliationRequest } from '../src/financial/contracts.ts';

const request = {
  cik: '0000000123',
  period: { start: '2022-01-01', end: '2022-12-31' },
  filings: [
    { accession: '0000000123-23-000001', form: '10-K' },
    { accession: '0000000123-24-000001', form: '10-K' },
  ],
};

function observations(values: [number, number]) {
  return request.filings.map((filing, index) => ({
    accn: filing.accession,
    form: filing.form,
    ...request.period,
    filed: `${2023 + index}-02-01`,
    val: values[index],
    fy: 2023 + index,
    fp: 'FY',
  }));
}

function snapshot(revenue: [number, number] = [2000, 2100], income: [number, number] = [100, 90]) {
  return {
    cik: 123,
    facts: {
      'us-gaap': {
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          units: { USD: observations(revenue) },
        },
        NetIncomeLoss: { units: { USD: observations(income) } },
      },
    },
  };
}

void test('same-period reconciliation reports exact signed differences with both citations', () => {
  const result = reconcileAnnualFinancials(snapshot(), request);
  assert.equal(result.basis, 'same-period-explicit-filings');
  assert.equal(result.interpretation, 'numeric-disclosure-comparison-only');
  assert.equal(result.chronology, 'ordered-by-filing-date');
  assert.deepEqual(result.period, request.period);
  for (const [metric, expected] of [
    [result.metrics.revenue, '100'],
    [result.metrics.netIncome, '-10'],
  ] as const) {
    assert.equal(metric.status, 'changed');
    assert.ok('differenceUsd' in metric);
    assert.equal(metric.differenceUsd, expected);
    assert.equal(metric.original.status, 'available');
    assert.equal(metric.later.status, 'available');
    if (metric.original.status === 'available' && metric.later.status === 'available') {
      assert.equal(metric.original.citations[0].accession, request.filings[0].accession);
      assert.equal(metric.later.citations[0].accession, request.filings[1].accession);
      assert.match(metric.original.citations[0].pointer, /\/USD\/0$/);
      assert.match(metric.later.citations[0].pointer, /\/USD\/1$/);
    }
  }
});

void test('equal observations are unchanged; no formal-restatement assertion is produced', () => {
  const result = reconcileAnnualFinancials(snapshot([2000, 2000], [100, 100]), request);
  assert.equal(result.metrics.revenue.status, 'unchanged');
  assert.ok('differenceUsd' in result.metrics.revenue);
  assert.equal(result.metrics.revenue.differenceUsd, '0');
  assert.equal(result.metrics.netIncome.status, 'unchanged');
  assert.equal(Object.hasOwn(result, 'restated'), false);
});

void test('amended 10-K is considered only when explicitly requested', () => {
  const data = snapshot();
  data.facts['us-gaap'].NetIncomeLoss.units.USD[1].form = '10-K/A';
  const regular = reconcileAnnualFinancials(data, request);
  assert.equal(regular.metrics.netIncome.status, 'unavailable');
  const amended = structuredClone(request);
  amended.filings[1].form = '10-K/A';
  const result = reconcileAnnualFinancials(data, amended);
  assert.equal(result.filings[1].form, '10-K/A');
  assert.equal(result.metrics.netIncome.status, 'changed');
  assert.equal(result.metrics.revenue.status, 'unavailable');
});

void test('other periods and later accessions never replace requested disclosures', () => {
  const data = snapshot();
  const list = data.facts['us-gaap'].NetIncomeLoss.units.USD;
  list.push(
    { ...list[1], start: '2022-10-01', val: 999 },
    { ...list[1], start: '2023-01-01', end: '2023-12-31', val: 888 },
    { ...list[1], accn: '0000000123-25-000001', val: 777 },
  );
  const result = reconcileAnnualFinancials(data, request);
  assert.equal(result.metrics.netIncome.status, 'changed');
  assert.ok('differenceUsd' in result.metrics.netIncome);
  assert.equal(result.metrics.netIncome.differenceUsd, '-10');
});

void test('missing later facts do not mean unchanged or zero; surviving evidence is retained', () => {
  const data = snapshot();
  data.facts['us-gaap'].NetIncomeLoss.units.USD.pop();
  const result = reconcileAnnualFinancials(data, request);
  assert.equal(result.metrics.netIncome.status, 'unavailable');
  assert.equal(result.metrics.netIncome.original.status, 'available');
  assert.deepEqual(result.metrics.netIncome.later, {
    status: 'missing',
    reason: 'period_not_found',
  });
  assert.equal(Object.hasOwn(result.metrics.netIncome, 'differenceUsd'), false);
  assert.equal(result.chronology, 'ordered-by-filing-date');
});

void test('no facts means unknown chronology, not invented filing dates', () => {
  const result = reconcileAnnualFinancials({ cik: 123, facts: {} }, request);
  assert.equal(result.chronology, 'unavailable');
  assert.deepEqual(
    result.filings.map((f) => f.filedAt),
    [null, null],
  );
  assert.equal(result.metrics.revenue.status, 'unavailable');
});

void test('conflicting values and dates across selected facts fail closed', () => {
  const data = snapshot();
  const list = data.facts['us-gaap'].NetIncomeLoss.units.USD;
  list.push({ ...list[1], val: 91 });
  assert.throws(() => reconcileAnnualFinancials(data, request), /conflicting facts/);
  list.pop();
  list[1].filed = '2024-02-02';
  assert.throws(() => reconcileAnnualFinancials(data, request), /inconsistent filing dates/);
});

void test('reversed filing dates are rejected; equal dates cannot establish intraday order', () => {
  const data = snapshot();
  for (const concept of Object.values(data.facts['us-gaap'])) {
    concept.units.USD[1].filed = '2023-01-01';
  }
  assert.throws(() => reconcileAnnualFinancials(data, request), /precedes original/);
  for (const concept of Object.values(data.facts['us-gaap'])) {
    concept.units.USD[1].filed = '2023-02-01';
  }
  assert.equal(reconcileAnnualFinancials(data, request).chronology, 'same-day-order-unverified');
});

void test('differences remain exact beyond Number safe range; unsafe observations fail', () => {
  const result = reconcileAnnualFinancials(
    snapshot([2000, 2100], [-9007199254740991, 9007199254740991]),
    request,
  );
  assert.ok('differenceUsd' in result.metrics.netIncome);
  assert.equal(result.metrics.netIncome.differenceUsd, '18014398509481982');
  assert.throws(
    () =>
      reconcileAnnualFinancials(
        snapshot([2000, 2100], [100, Number.MAX_SAFE_INTEGER + 1]),
        request,
      ),
    /must be an integer/,
  );
});

void test('new request strictly validates fields, identifiers, forms and annual duration', () => {
  for (const invalid of [
    null,
    { ...request, extra: true },
    { ...request, cik: '123' },
    { ...request, filings: [request.filings[0]] },
    { ...request, filings: [request.filings[0], request.filings[0]] },
    { ...request, filings: [{ ...request.filings[0], form: '10-K/A' }, request.filings[1]] },
    { ...request, filings: [request.filings[0], { ...request.filings[1], form: '10-Q' }] },
    { ...request, filings: [request.filings[0], { ...request.filings[1], extra: true }] },
    { ...request, period: { ...request.period, start: '2022-02-30' } },
    { ...request, period: { ...request.period, start: '2022-10-01' } },
    { ...request, period: { ...request.period, unit: 'USD' } },
  ]) {
    assert.throws(() => parseReconciliationRequest(invalid));
  }
  assert.throws(
    () => reconcileAnnualFinancials({ cik: 124, facts: {} }, request),
    /CIK does not match/,
  );
});

void test('parsed reconciliation request and output are detached from caller objects', () => {
  const input = structuredClone(request);
  const parsed = parseReconciliationRequest(input);
  const result = reconcileAnnualFinancials(snapshot(), input);
  input.period.start = '2020-01-01';
  input.filings[1].accession = '0000000123-25-000001';
  assert.equal(parsed.period.start, '2022-01-01');
  assert.equal(result.period.start, '2022-01-01');
  assert.equal(result.filings[1].accession, request.filings[1].accession);
});

const cwd = fileURLToPath(new URL('../', import.meta.url));

void test('reconciliation CLI emits numeric results with a reproducible raw snapshot hash', () => {
  const result = spawnSync(
    process.execPath,
    [
      'src/cli.ts',
      'financial-reconcile',
      'fixtures/reconciliation.synthetic.json',
      'fixtures/reconciliation-request.json',
    ],
    { cwd, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const output: unknown = JSON.parse(result.stdout);
  assert.ok(output && typeof output === 'object' && 'provenance' in output);
  const bytes = readFileSync(new URL('../fixtures/reconciliation.synthetic.json', import.meta.url));
  assert.deepEqual(output.provenance, {
    expectedSourceUrl: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000123.json',
    snapshotSha256: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.length,
    verification: 'local-content-hash-only',
  });
  assert.ok('metrics' in output);
  assert.deepEqual(
    output.metrics,
    reconcileAnnualFinancials(JSON.parse(bytes.toString()) as unknown, request).metrics,
  );
});

void test('reconciliation CLI failures preserve stderr JSON and no partial stdout', () => {
  for (const args of [
    ['financial-reconcile'],
    [
      'financial-reconcile',
      'fixtures/reconciliation.synthetic.json',
      'fixtures/financial-request.json',
    ],
    ['financial-reconcile-cached', 'missing', 'fixtures/reconciliation-request.json'],
  ]) {
    const result = spawnSync(process.execPath, ['src/cli.ts', ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    const output: unknown = JSON.parse(result.stderr);
    assert.ok(output && typeof output === 'object' && 'error' in output);
    assert.equal(typeof output.error, 'string');
  }
});

void test('cached reconciliation carries verified provenance and refuses corrupt bytes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'reconciliation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const body = readFileSync(
    new URL('../fixtures/reconciliation.synthetic.json', import.meta.url),
    'utf8',
  );
  const cached = await retrieveCompanyFacts('0000000123', root, {
    userAgent: 'Tests contact@example.invalid',
    sleep: () => Promise.resolve(),
    fetch: () =>
      Promise.resolve(new Response(body, { headers: { 'content-type': 'application/json' } })),
  });
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('offline');
  });
  const result = await runCommand(
    ['financial-reconcile-cached', cached.directory, 'fixtures/reconciliation-request.json'],
    {},
  );
  assert.ok(result && typeof result === 'object' && 'provenance' in result && 'metrics' in result);
  assert.deepEqual(result.provenance, {
    ...cached.manifest.artifact,
    verification: 'cache-integrity-and-identity',
  });
  assert.deepEqual(
    result.metrics,
    reconcileAnnualFinancials(JSON.parse(body) as unknown, request).metrics,
  );
  await writeFile(join(cached.directory, `${cached.manifest.artifact.sha256}.blob`), 'corrupt');
  await assert.rejects(
    runCommand(
      ['financial-reconcile-cached', cached.directory, 'fixtures/reconciliation-request.json'],
      {},
    ),
    /integrity mismatch/,
  );
});
