import {
  acquireLock,
  cacheDirectory,
  hasManifest,
  publishManifest,
  validateCache,
  writeArtifact,
} from './cache.ts';
import { parseManifest, parseRequest, submissionsUrl } from './contracts.ts';
import type { FilingRequest, Manifest } from './contracts.ts';
import { createDownloader } from './http.ts';
import type { DownloadOptions } from './http.ts';
import { selectFilings } from './submissions.ts';

// Existing callers retain the same entry points while responsibilities live in separate modules.
export { cacheDirectory, validateCache } from './cache.ts';
export { selectFilings } from './submissions.ts';

export type RetrievalResult = { cacheHit: boolean; directory: string; manifest: Manifest };

async function readCached(
  directory: string,
  request: FilingRequest,
): Promise<RetrievalResult | undefined> {
  if (!(await hasManifest(directory))) {
    return undefined;
  }
  const manifest = await validateCache(directory);
  if (
    manifest.filings[0].cik !== request.cik ||
    manifest.filings.some((filing) => !request.accessions.includes(filing.accession))
  ) {
    throw new Error('cached request mismatch');
  }
  return { cacheHit: true, directory, manifest };
}

export async function retrieveFilings(
  input: unknown,
  root: string,
  options: DownloadOptions = {},
): Promise<RetrievalResult> {
  const request = parseRequest(input);
  const directory = cacheDirectory(root, request);
  const cached = await readCached(directory, request);
  if (cached) {
    return cached;
  }
  const download = createDownloader(options);
  // One writer per pair. A stale lock after process termination requires explicit removal.
  const releaseLock = await acquireLock(directory);
  try {
    // Another process may have published between the first check and our lock acquisition.
    const published = await readCached(directory, request);
    if (published) {
      return published;
    }
    const submissions = await download(submissionsUrl(request.cik), 'json');
    const selected = selectFilings(submissions.bytes, request);
    // Validate all metadata before any document downloads.
    parseManifest({
      schemaVersion: 1,
      submissions: submissions.meta,
      filings: selected.map((filing) => ({ ...submissions.meta, ...filing })),
    });
    const filings = [];
    for (const filing of selected) {
      const downloaded = await download(filing.sourceUrl, 'html');
      await writeArtifact(directory, downloaded.meta, downloaded.bytes);
      filings.push({ ...filing, ...downloaded.meta });
    }
    const manifest = parseManifest({ schemaVersion: 1, submissions: submissions.meta, filings });
    await writeArtifact(directory, submissions.meta, submissions.bytes);
    await publishManifest(directory, manifest);
    return { cacheHit: false, directory, manifest };
  } finally {
    await releaseLock();
  }
}
