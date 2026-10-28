import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retrieveCompanyFacts } from '../src/sec/companyfacts-retrieval.ts';
import {
  companyFactsCacheDirectory,
  readCompanyFactsCache,
} from '../src/sec/companyfacts-cache.ts';
import { parseCompanyFactsManifest } from '../src/sec/companyfacts-contracts.ts';
import { acquireLock } from '../src/sec/artifact-store.ts';
import { companyFactsUrl } from '../src/sec/contracts.ts';
import { createDownloader } from '../src/sec/http.ts';
import { runCommand } from '../src/cli/commands.ts';

const cik = '0000000123';
const snapshot = JSON.stringify({ cik: 123, entityName: 'SYNTHETIC ONLY', facts: {} });

async function workspace(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'companyfacts-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function network(body = snapshot, status = 200) {
  let calls = 0;

  const fetcher: typeof fetch = (url, init) => {
    calls++;
    assert.equal(url, companyFactsUrl(cik));
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    return Promise.resolve(
      new Response(body, { status, headers: { 'content-type': 'application/json' } }),
    );
  };

  return {
    calls: () => calls,
    options: {
      userAgent: 'Tests contact@example.invalid',
      fetch: fetcher,
      sleep: () => Promise.resolve(),
      now: () => new Date('2026-10-28T00:00:00.000Z'),
    },
  };
}

void test('first fetch publishes independent provenance; identity-free cache hit makes zero requests', async (t) => {
  const root = await workspace(t);
  const mock = network();
  const first = await retrieveCompanyFacts(cik, root, mock.options);
  assert.equal(first.cacheHit, false);
  assert.equal(mock.calls(), 1);
  assert.equal(first.directory, join(root, 'companyfacts', cik));
  assert.equal(first.manifest.kind, 'sec-companyfacts');
  assert.equal(first.manifest.artifact.sourceUrl, companyFactsUrl(cik));
  assert.equal(first.manifest.artifact.downloadedAt, '2026-10-28T00:00:00.000Z');
  const cached = await readCompanyFactsCache(first.directory);
  assert.equal(new TextDecoder().decode(cached.bytes), snapshot);
  assert.deepEqual(cached.manifest, first.manifest);
  const second = await retrieveCompanyFacts(cik, root, {
    fetch: () => {
      throw new Error('offline');
    },
  });
  assert.equal(second.cacheHit, true);
  assert.deepEqual(second.manifest, first.manifest);
  assert.equal(mock.calls(), 1);
  assert.doesNotMatch(await readFile(join(first.directory, 'manifest.json'), 'utf8'), /contact@/);
});

void test('corruption fails closed without network or silent repair', async (t) => {
  const root = await workspace(t);
  const mock = network();
  const first = await retrieveCompanyFacts(cik, root, mock.options);
  const path = join(first.directory, `${first.manifest.artifact.sha256}.blob`);
  await writeFile(path, snapshot.replace('123', '124'));
  await assert.rejects(retrieveCompanyFacts(cik, root, mock.options), /integrity mismatch/);
  assert.equal(mock.calls(), 1);
  await rm(path);
  await assert.rejects(readCompanyFactsCache(first.directory), /ENOENT/);
});

for (const body of [
  '{broken',
  JSON.stringify({ cik: 124, facts: {} }),
  JSON.stringify({ cik: 123, facts: [] }),
]) {
  void test(`invalid companyfacts response is never published: ${body}`, async (t) => {
    const root = await workspace(t);
    await assert.rejects(retrieveCompanyFacts(cik, root, network(body).options));
    const directory = companyFactsCacheDirectory(root, cik);
    await assert.rejects(stat(join(directory, 'manifest.json')), /ENOENT/);
    await assert.rejects(stat(join(directory, '.lock')), /ENOENT/);
    const retry = await retrieveCompanyFacts(cik, root, network().options);
    assert.equal(retry.cacheHit, false);
  });
}

void test('403 is not retried and a competing writer keeps its lock', async (t) => {
  const root = await workspace(t);
  const forbidden = network('denied', 403);
  await assert.rejects(retrieveCompanyFacts(cik, root, forbidden.options), /HTTP 403/);
  assert.equal(forbidden.calls(), 1);
  const directory = companyFactsCacheDirectory(root, cik);
  const release = await acquireLock(directory);
  try {
    const mock = network();
    await assert.rejects(retrieveCompanyFacts(cik, root, mock.options), /EEXIST/);
    assert.equal(mock.calls(), 0);
    assert.equal((await stat(join(directory, '.lock'))).isDirectory(), true);
  } finally {
    await release();
  }
});

void test('identity required only on cache miss; invalid CIK rejected before network', async (t) => {
  const root = await workspace(t);
  await assert.rejects(retrieveCompanyFacts(cik, root), /SEC_USER_AGENT/);
  for (const input of [null, 123, '123', '0000000000', '../123']) {
    const mock = network();
    await assert.rejects(retrieveCompanyFacts(input, root, mock.options), /CIK/);
    assert.equal(mock.calls(), 0);
  }
});

void test('manifest identity, URL, schema and hash fields are strictly validated', async (t) => {
  const root = await workspace(t);
  const { manifest } = await retrieveCompanyFacts(cik, root, network().options);
  for (const input of [
    { ...manifest, schemaVersion: 2 },
    { ...manifest, kind: 'sec-filings' },
    { ...manifest, extra: true },
    { ...manifest, cik: '0000000124' },
    { ...manifest, artifact: { ...manifest.artifact, sourceUrl: 'https://evil.invalid/facts' } },
    { ...manifest, artifact: { ...manifest.artifact, sha256: '../file' } },
    { ...manifest, artifact: { ...manifest.artifact, downloadedAt: '2026-02-30T00:00:00.000Z' } },
  ]) {
    assert.throws(() => parseCompanyFactsManifest(input));
  }
});

void test('valid cache for another company cannot satisfy a request', async (t) => {
  const root = await workspace(t);
  const result = await retrieveCompanyFacts(cik, root, network().options);
  const { sha256 } = await import('../src/sec/integrity.ts');
  const bytes = new TextEncoder().encode(JSON.stringify({ cik: 124, facts: {} }));
  const manifest = {
    ...result.manifest,
    cik: '0000000124',
    artifact: {
      ...result.manifest.artifact,
      sourceUrl: companyFactsUrl('0000000124'),
      sha256: sha256(bytes),
      byteLength: bytes.length,
    },
  };
  await writeFile(join(result.directory, `${manifest.artifact.sha256}.blob`), bytes);
  await writeFile(join(result.directory, 'manifest.json'), JSON.stringify(manifest));
  const mock = network();
  await assert.rejects(retrieveCompanyFacts(cik, root, mock.options), /request mismatch/);
  assert.equal(mock.calls(), 0);
});

void test('HTTP allowlist refuses noncanonical Company Facts URLs before fetch', async () => {
  const mock = network();
  const download = createDownloader(mock.options);
  for (const url of [
    `${companyFactsUrl(cik)}?latest=true`,
    `${companyFactsUrl(cik)}#fragment`,
    companyFactsUrl(cik).replace('data.sec.gov', 'data.sec.gov.evil.invalid'),
    companyFactsUrl(cik).replace('CIK0000000123', 'CIK123'),
    companyFactsUrl(cik).replace('https://', 'https://user:pass@'),
  ]) {
    await assert.rejects(download(url, 'json'), /noncanonical/);
  }
  await assert.rejects(download(companyFactsUrl(cik), 'html'), /noncanonical/);
  assert.equal(mock.calls(), 0);
});

void test('truncated or oversized manifests fail without touching network', async (t) => {
  const root = await workspace(t);
  const result = await retrieveCompanyFacts(cik, root, network().options);
  const path = join(result.directory, 'manifest.json');
  const mock = network();
  await writeFile(path, '{}');
  await assert.rejects(retrieveCompanyFacts(cik, root, mock.options), /must contain exactly/);
  await writeFile(path, ' '.repeat(100_001));
  await assert.rejects(retrieveCompanyFacts(cik, root, mock.options), /size limit/);
  assert.equal(mock.calls(), 0);
});

void test('cache validation and cached financial comparison use verified bytes offline', async (t) => {
  const root = await workspace(t);
  const bytes = await readFile(
    new URL('../fixtures/companyfacts.synthetic.json', import.meta.url),
    'utf8',
  );
  const result = await retrieveCompanyFacts(cik, root, network(bytes).options);
  const validated = await runCommand(['companyfacts-validate', result.directory], {});
  assert.deepEqual(validated, { valid: true, manifest: result.manifest });
  const compared = await runCommand(
    ['financial-compare-cached', result.directory, 'fixtures/financial-request.json'],
    {},
  );
  assert.ok(compared && typeof compared === 'object' && 'provenance' in compared);
  assert.deepEqual(compared.provenance, {
    ...result.manifest.artifact,
    verification: 'cache-integrity-and-identity',
  });
  assert.ok('changes' in compared && compared.changes && typeof compared.changes === 'object');
  assert.ok('revenue' in compared.changes);
  assert.deepEqual(compared.changes.revenue, {
    differenceUsd: { status: 'available', value: '500' },
    percentChange: { status: 'available', value: '25.00' },
  });
  await assert.rejects(
    runCommand(
      ['financial-compare-cached', result.directory, 'examples/financial-apple-annual.json'],
      {},
    ),
    /CIK does not match/,
  );
  await writeFile(join(result.directory, `${result.manifest.artifact.sha256}.blob`), 'broken');
  await assert.rejects(
    runCommand(
      ['financial-compare-cached', result.directory, 'fixtures/financial-request.json'],
      {},
    ),
    /integrity mismatch/,
  );
});

void test('companyfacts-fetch command passes local identity to the downloader on a miss', async (t) => {
  const root = await workspace(t);
  const mock = network();
  t.mock.method(globalThis, 'fetch', mock.options.fetch);
  const result = await runCommand(['companyfacts-fetch', cik, root], {
    SEC_USER_AGENT: mock.options.userAgent,
  });
  assert.ok(result && typeof result === 'object' && 'cacheHit' in result);
  assert.equal(result.cacheHit, false);
  assert.equal(mock.calls(), 1);
  for (const args of [
    ['companyfacts-fetch', cik],
    ['companyfacts-validate'],
    ['financial-compare-cached', root],
  ]) {
    await assert.rejects(runCommand(args, {}), /Usage:/);
  }
});
