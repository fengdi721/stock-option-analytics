import { acquireLock, hasManifest, writeArtifact } from './artifact-store.ts';
import { companyFactsUrl } from './contracts.ts';
import { createDownloader } from './http.ts';
import type { DownloadOptions } from './http.ts';
import {
  parseCompanyCik,
  parseCompanyFactsManifest,
  validateCompanyFactsSnapshot,
} from './companyfacts-contracts.ts';
import type { CompanyFactsManifest } from './companyfacts-contracts.ts';
import {
  companyFactsCacheDirectory,
  publishCompanyFactsManifest,
  readCompanyFactsCache,
} from './companyfacts-cache.ts';

type RetrievalResult = {
  cacheHit: boolean;
  directory: string;
  manifest: CompanyFactsManifest;
};

async function readCached(directory: string, cik: string): Promise<RetrievalResult | undefined> {
  if (!(await hasManifest(directory))) {
    return undefined;
  }
  const { manifest } = await readCompanyFactsCache(directory);
  if (manifest.cik !== cik) {
    throw new Error('cached companyfacts request mismatch');
  }
  return { cacheHit: true, directory, manifest };
}

export async function retrieveCompanyFacts(
  input: unknown,
  root: string,
  options: DownloadOptions = {},
): Promise<RetrievalResult> {
  const cik = parseCompanyCik(input);
  const directory = companyFactsCacheDirectory(root, cik);
  const cached = await readCached(directory, cik);
  if (cached) {
    return cached;
  }
  const download = createDownloader(options);
  const releaseLock = await acquireLock(directory);
  try {
    const published = await readCached(directory, cik);
    if (published) {
      return published;
    }
    const artifact = await download(companyFactsUrl(cik), 'json');
    validateCompanyFactsSnapshot(artifact.bytes, cik);
    const manifest = parseCompanyFactsManifest({
      schemaVersion: 1,
      kind: 'sec-companyfacts',
      cik,
      artifact: artifact.meta,
    });
    await writeArtifact(directory, artifact.meta, artifact.bytes);
    await publishCompanyFactsManifest(directory, manifest);
    return { cacheHit: false, directory, manifest };
  } finally {
    await releaseLock();
  }
}
