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
