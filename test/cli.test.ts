import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, openSync, ftruncateSync, closeSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const run = (...args: string[]) =>
  spawnSync(process.execPath, ['src/cli.ts', ...args], { cwd, encoding: 'utf8' });
function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
void test('CLI runs both offline examples and emits parseable JSON', () => {
  for (const args of [
    ['payoff', 'fixtures/call-spread.json'],
    ['quote-payoff', 'fixtures/quotes.synthetic.csv', 'fixtures/quote-request.json'],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    const data = record(JSON.parse(result.stdout) as unknown);
    assert.ok(Array.isArray(data.rows));
    const rows: unknown[] = data.rows;
    assert.equal(record(rows[0]).netPnl, '-202.60');
    assert.equal(record(rows[4]).netPnl, '297.40');
    if (args[0] === 'quote-payoff') {
      const hash = record(data.provenance).snapshotSha256;
      assert.equal(typeof hash, 'string');
      assert.match(String(hash), /^[a-f0-9]{64}$/);
    }
  }
});
void test('CLI errors return nonzero and JSON on stderr without partial result', () => {
  for (const args of [
    [],
    ['payoff', 'missing.json'],
    ['payoff', 'fixtures/quotes.synthetic.csv'],
    ['payoff', 'fixtures/call-spread.json', 'extra'],
    ['sec-fetch', 'missing.json', 'outputs/sec'],
    ['sec-validate', 'missing-cache'],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(typeof record(JSON.parse(result.stderr) as unknown).error, 'string');
  }
});
void test('CLI help succeeds', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

void test('financial CLI emits deterministic exact calculations and snapshot provenance offline', () => {
  const args = [
    'financial-compare',
    'fixtures/companyfacts.synthetic.json',
    'fixtures/financial-request.json',
  ];
  const first = run(...args);
  const second = run(...args);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  const result = record(JSON.parse(first.stdout) as unknown);
  const changes = record(result.changes);
  assert.deepEqual(record(changes.revenue).differenceUsd, { status: 'available', value: '500' });
  assert.equal(record(result.provenance).verification, 'local-content-hash-only');
  const bytes = readFileSync(new URL('../fixtures/companyfacts.synthetic.json', import.meta.url));
  assert.equal(
    record(result.provenance).snapshotSha256,
    createHash('sha256').update(bytes).digest('hex'),
  );
  assert.equal(record(result.provenance).byteLength, bytes.length);
  assert.equal(
    record(result.provenance).expectedSourceUrl,
    'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000123.json',
  );
});

void test('financial CLI rejects missing files, malformed input, wrong company and wrong arity', () => {
  for (const args of [
    ['financial-compare'],
    ['financial-compare', 'missing.json', 'fixtures/financial-request.json'],
    ['financial-compare', 'fixtures/quotes.synthetic.csv', 'fixtures/financial-request.json'],
    [
      'financial-compare',
      'fixtures/companyfacts.synthetic.json',
      'examples/financial-apple-annual.json',
    ],
    [
      'financial-compare',
      'fixtures/companyfacts.synthetic.json',
      'fixtures/financial-request.json',
      'extra',
    ],
  ]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(typeof record(JSON.parse(result.stderr) as unknown).error, 'string');
  }
});

void test('financial CLI bounds snapshot input before parsing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'financial-cli-'));
  try {
    const path = join(directory, 'oversized.json');
    const fd = openSync(path, 'w');
    try {
      ftruncateSync(fd, 25_000_001);
    } finally {
      closeSync(fd);
    }
    const result = run('financial-compare', path, 'fixtures/financial-request.json');
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(String(record(JSON.parse(result.stderr) as unknown).error), /25000000 byte limit/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
