import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { MAX_ARTIFACT_BYTES, parseManifest, parseRequest } from './contracts.ts';
import type { Artifact, FilingRequest, Manifest } from './contracts.ts';
import { verifyBytes } from './integrity.ts';
import { validateFilingHtml } from './content.ts';
import { selectFilings } from './submissions.ts';

const MAX_MANIFEST_BYTES = 100_000;

export function cacheDirectory(root: string, input: unknown): string {
  const request = parseRequest(input);
  return join(root, request.cik, [...request.accessions].sort().join('_'));
}

export async function hasManifest(directory: string): Promise<boolean> {
  try {
    await stat(join(directory, 'manifest.json'));
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function readBounded(path: string, limit = MAX_ARTIFACT_BYTES): Promise<Uint8Array> {
  if ((await stat(path)).size > limit) {
    throw new Error('cache file exceeds size limit');
  }
  const bytes = await readFile(path);
  if (bytes.length > limit) {
    throw new Error('cache file exceeds size limit');
  }
  return bytes;
}

async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeArtifact(
  directory: string,
  meta: Artifact,
  bytes: Uint8Array,
): Promise<void> {
  verifyBytes(meta, bytes);
  await atomicWrite(join(directory, `${meta.sha256}.blob`), bytes);
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

export async function acquireLock(directory: string): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, '.lock');
  await mkdir(lock);
  return () => rm(lock, { recursive: true, force: true });
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
