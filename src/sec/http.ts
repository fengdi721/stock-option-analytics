import { setTimeout as delay } from 'node:timers/promises';
import { filingUrl, submissionsUrl } from './contracts.ts';
import type { Artifact } from './contracts.ts';
import { sha256 } from './integrity.ts';
import { validateFilingHtml } from './content.ts';

export const MAX_ARTIFACT_BYTES = 25_000_000;
const MAX_ATTEMPTS = 3;
const REQUEST_INTERVAL_MS = 250;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRY_DELAY_MS = 60_000;

export type DownloadOptions = {
  userAgent?: string;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
};
export type DownloadedArtifact = { meta: Artifact; bytes: Uint8Array };
type ContentKind = 'json' | 'html';

/** Validate the complete URL before any network operation; redirects remain disabled. */
function validateSourceUrl(url: string, kind: ContentKind): void {
  if (kind === 'json') {
    const match = /^https:\/\/data\.sec\.gov\/submissions\/CIK(\d{10})\.json$/.exec(url);
    if (match && submissionsUrl(match[1]) === url) {
      return;
    }
  } else {
    const match =
      /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(\d+)\/(\d{10})(\d{2})(\d{6})\/([A-Za-z0-9_-]+\.html?)$/.exec(
        url,
      );
    if (
      match &&
      filingUrl(match[1].padStart(10, '0'), `${match[2]}-${match[3]}-${match[4]}`, match[5]) === url
    ) {
      return;
    }
  }
  throw new Error('noncanonical SEC download URL');
}

function retryDelay(header: string | null, attempt: number, now: Date): number {
  const requested =
    header === null
      ? 0
      : /^\d+$/.test(header)
        ? Number(header) * 1000
        : Date.parse(header) - now.getTime();
  if (!Number.isFinite(requested) || requested > MAX_RETRY_DELAY_MS) {
    throw new Error('SEC Retry-After requires a later manual retry');
  }
  return Math.max(1000 * 2 ** attempt, requested);
}

async function readResponse(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > MAX_ARTIFACT_BYTES) {
    await response.body?.cancel();
    throw new Error('SEC response exceeds 25 MB');
  }
  if (!response.body) {
    throw new Error('empty SEC response');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > MAX_ARTIFACT_BYTES) {
        await reader.cancel();
        throw new Error('SEC response exceeds 25 MB');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (length === 0) {
    throw new Error('empty SEC response');
  }
  return Buffer.concat(chunks);
}

export function createDownloader(options: DownloadOptions) {
  const userAgent = options.userAgent;
  if (
    !userAgent ||
    userAgent.length > 256 ||
    /[\r\n]/.test(userAgent) ||
    !/\S+\s+.*[^\s@]+@[^\s@]+\.[^\s@]+/.test(userAgent)
  ) {
    throw new Error('SEC_USER_AGENT must identify the application and a contact email');
  }
  const fetcher = options.fetch ?? fetch;
  const sleep = options.sleep ?? delay;
  const now = options.now ?? (() => new Date());

  return async (url: string, kind: ContentKind): Promise<DownloadedArtifact> => {
    validateSourceUrl(url, kind);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Per downloader, sequential use is limited to at most four starts per second.
      // The caller must coordinate other processes to respect SEC's aggregate limit.
      await sleep(REQUEST_INTERVAL_MS);
      const response = await fetcher(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: kind === 'json' ? 'application/json' : 'text/html',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 429 || [500, 502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        if (attempt === MAX_ATTEMPTS - 1) {
          throw new Error(`SEC HTTP ${response.status}: retry budget exhausted`);
        }
        await sleep(retryDelay(response.headers.get('retry-after'), attempt, now()));
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`SEC HTTP ${response.status}`);
      }
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      const accepted =
        kind === 'json' ? ['application/json'] : ['text/html', 'application/xhtml+xml'];
      if (!contentType || !accepted.includes(contentType)) {
        await response.body?.cancel();
        throw new Error(`unexpected SEC content type: ${contentType ?? ''}`);
      }
      const bytes = await readResponse(response);
      if (kind === 'html') {
        validateFilingHtml(bytes);
      }
      return {
        bytes,
        meta: {
          sourceUrl: url,
          downloadedAt: now().toISOString(),
          sha256: sha256(bytes),
          byteLength: bytes.length,
        },
      };
    }
    throw new Error('unreachable retry state');
  };
}
