import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest, parseRequest, sha256, verifyBytes, filingUrl } from '../src/sec/contracts.ts';

// Synthetic metadata and bytes, never represented as downloaded SEC content.
export function syntheticManifest() {
  const blob = { downloadedAt: '2025-01-01T00:00:00.000Z', sha256: sha256(Buffer.from('abc')), byteLength: 3 };
  return { schemaVersion: 1, submissions: { ...blob, sourceUrl: 'https://data.sec.gov/submissions/CIK0000000001.json' },
    filings: [2023, 2024].map(year => ({ ...blob, cik: '0000000001', accession: `0000000001-${String(year).slice(2)}-000001`,
      form: '10-K', periodEnd: `${year}-06-30`, filedAt: `${year}-08-01`,
      sourceUrl: filingUrl('0000000001', `0000000001-${String(year).slice(2)}-000001`, 'annual.htm') })) };
}
test('manifest validates synthetic pair and SHA-256 against known vector', () => {
  const m = parseManifest(syntheticManifest());
  assert.equal(m.filings[0].sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  verifyBytes(m.filings[0], Buffer.from('abc'));
  assert.throws(() => verifyBytes(m.filings[0], Buffer.from('abd')), /integrity/);
  assert.throws(() => verifyBytes(m.filings[0], Buffer.from('abcd')), /integrity/);
});
for (const [label, patch] of Object.entries({
  'unknown field': { extra: 1 }, 'unpadded CIK': { cik: '1' }, 'zero CIK': { cik: '0000000000' },
  'bad accession': { accession: '../../escape' }, 'amendment': { form: '10-K/A' },
  'invalid day': { periodEnd: '2023-02-29' }, 'period after filing': { periodEnd: '2024-09-01' },
  'filing after download': { filedAt: '2025-02-01' }, 'invalid timestamp': { downloadedAt: '2025-02-30T00:00:00.000Z' },
  'bad hash': { sha256: 'abc' }, 'oversize': { byteLength: 25_000_001 },
  'foreign URL': { sourceUrl: 'https://evil.example/annual.htm' },
  'URL query': { sourceUrl: 'https://www.sec.gov/Archives/edgar/data/1/000000000123000001/annual.htm?x=1' }
})) test(`manifest rejects ${label}`, () => {
  const m = syntheticManifest(); Object.assign(m.filings[0], patch); assert.throws(() => parseManifest(m));
});
test('manifest rejects wrong pair, source, and schema', () => {
  for (const change of [(m: ReturnType<typeof syntheticManifest>) => { m.filings[1] = m.filings[0]; },
    (m: ReturnType<typeof syntheticManifest>) => { m.submissions.sourceUrl += '?x'; },
    (m: ReturnType<typeof syntheticManifest>) => { m.schemaVersion = 2; }]) {
    const m = syntheticManifest(); change(m); assert.throws(() => parseManifest(m));
  }
});
test('request requires two distinct pinned accessions', () => {
  const r = { cik: '0000000001', accessions: ['0000000001-23-000001', '0000000001-24-000001'] };
  assert.deepEqual(parseRequest(r), r);
  assert.throws(() => parseRequest({ ...r, accessions: [r.accessions[0], r.accessions[0]] }));
  assert.throws(() => parseRequest({ ...r, extra: true }));
});
