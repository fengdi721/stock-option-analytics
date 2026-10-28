import { join } from 'node:path';
import { parseManifest, parseRequest } from './contracts.ts';
import type { Artifact, FilingRequest, Manifest } from './contracts.ts';
import { verifyBytes } from './integrity.ts';
import { validateFilingHtml } from './content.ts';
import { selectFilings } from './submissions.ts';
import { readBounded, atomicWrite } from './artifact-store.ts';

export { acquireLock, hasManifest, writeArtifact } from './artifact-store.ts';

const MAX_MANIFEST_BYTES = 100_000;

export function cacheDirectory(root: string, input: unknown): string {
  const request = parseRequest(input);
  return join(root, request.cik, [...request.accessions].sort().join('_'));
}

/** Publish only after all blobs exist and agree with the selected metadata. */
export async function publishManifest(directory: string, manifest: Manifest): Promise<void> {
  parseManifest(manifest);
  await verifyArtifacts(directory, manifest);
  await atomicWrite(
    join(directory, 'manifest.json'),
    new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n'),
  );
}

async function verifyArtifacts(directory: string, manifest: Manifest): Promise<void> {
  const readArtifact = async (meta: Artifact): Promise<Uint8Array> => {
    const bytes = await readBounded(join(directory, `${meta.sha256}.blob`));
    verifyBytes(meta, bytes);
    return bytes;
  };
  const submissions = await readArtifact(manifest.submissions);
  const request: FilingRequest = {
    cik: manifest.filings[0].cik,
    accessions: [manifest.filings[0].accession, manifest.filings[1].accession],
  };
  const selected = selectFilings(submissions, request);
  for (const [index, filing] of manifest.filings.entries()) {
    const expected = selected[index];
    if (
      filing.cik !== expected.cik ||
      filing.accession !== expected.accession ||
      filing.form !== expected.form ||
      filing.periodEnd !== expected.periodEnd ||
      filing.filedAt !== expected.filedAt ||
      filing.sourceUrl !== expected.sourceUrl
    ) {
      throw new Error('manifest disagrees with submissions evidence');
    }
    validateFilingHtml(await readArtifact(filing));
  }
}

export async function validateCache(directory: string): Promise<Manifest> {
  const bytes = await readBounded(join(directory, 'manifest.json'), MAX_MANIFEST_BYTES);
  const manifest = parseManifest(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  await verifyArtifacts(directory, manifest);
  return manifest;
}
