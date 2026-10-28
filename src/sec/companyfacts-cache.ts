import { join } from 'node:path';
import { atomicWrite, readBounded } from './artifact-store.ts';
import { verifyBytes } from './integrity.ts';
import {
  parseCompanyCik,
  parseCompanyFactsManifest,
  validateCompanyFactsSnapshot,
} from './companyfacts-contracts.ts';
import type { CompanyFactsManifest } from './companyfacts-contracts.ts';

export function companyFactsCacheDirectory(root: string, cik: unknown): string {
  return join(root, 'companyfacts', parseCompanyCik(cik));
}

async function readSnapshot(
  directory: string,
  manifest: CompanyFactsManifest,
): Promise<Uint8Array> {
  const bytes = await readBounded(join(directory, `${manifest.artifact.sha256}.blob`));
  verifyBytes(manifest.artifact, bytes);
  validateCompanyFactsSnapshot(bytes, manifest.cik);
  return bytes;
}

export async function publishCompanyFactsManifest(
  directory: string,
  input: CompanyFactsManifest,
): Promise<void> {
  const manifest = parseCompanyFactsManifest(input);
  await readSnapshot(directory, manifest);
  await atomicWrite(
    join(directory, 'manifest.json'),
    new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n'),
  );
}

/** Return the same verified bytes callers will analyze, avoiding a second unverified read. */
export async function readCompanyFactsCache(directory: string) {
  const bytes = await readBounded(join(directory, 'manifest.json'), 100_000);
  const manifest = parseCompanyFactsManifest(
    JSON.parse(new TextDecoder().decode(bytes)) as unknown,
  );
  return { manifest, bytes: await readSnapshot(directory, manifest) };
}
