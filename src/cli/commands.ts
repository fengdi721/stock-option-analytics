import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateExpiryPayoff } from '../domain/payoff.ts';
import { retrieveFilings, validateCache } from '../sec/retrieval.ts';
import { scenarioFromQuotes } from '../adapters/quotes.ts';
import { compareAnnualFinancials } from '../financial/comparison.ts';

export const usage =
  'Usage: node src/cli.ts payoff <scenario.json> | quote-payoff <snapshot.csv> <request.json> | sec-fetch <request.json> <cache-root> | sec-validate <cache-directory> | financial-compare <companyfacts.json> <request.json>';
function readBytes(path: string, limit = 2_000_000): Buffer {
  const message =
    limit === 2_000_000 ? 'input exceeds 2 MB limit' : `input exceeds ${limit} byte limit`;
  if (statSync(path).size > limit) {
    throw new Error(message);
  }
  const bytes = readFileSync(path);
  if (bytes.length > limit) {
    throw new Error(message);
  }
  return bytes;
}
function read(path: string): string {
  return readBytes(path).toString('utf8');
}
function readJson(path: string): unknown {
  return JSON.parse(read(path)) as unknown;
}
export async function runCommand(args: string[], environment: NodeJS.ProcessEnv): Promise<unknown> {
  if (args[0] === 'payoff' && args.length === 2) {
    return calculateExpiryPayoff(readJson(args[1]));
  }
  if (args[0] === 'quote-payoff' && args.length === 3) {
    const csv = read(args[1]);
    const { scenario, provenance } = scenarioFromQuotes(csv, readJson(args[2]));
    return {
      ...calculateExpiryPayoff(scenario),
      provenance: { ...provenance, snapshotSha256: createHash('sha256').update(csv).digest('hex') },
    };
  }
  if (args[0] === 'financial-compare' && args.length === 3) {
    const bytes = readBytes(args[1], 25_000_000);
    const result = compareAnnualFinancials(
      JSON.parse(bytes.toString('utf8')) as unknown,
      readJson(args[2]),
    );
    return {
      ...result,
      provenance: {
        expectedSourceUrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${result.cik}.json`,
        snapshotSha256: createHash('sha256').update(bytes).digest('hex'),
        byteLength: bytes.length,
        verification: 'local-content-hash-only',
      },
    };
  }
  if (args[0] === 'sec-fetch' && args.length === 3) {
    return retrieveFilings(readJson(args[1]), args[2], { userAgent: environment.SEC_USER_AGENT });
  }
  if (args[0] === 'sec-validate' && args.length === 2) {
    return { valid: true, manifest: await validateCache(args[1]) };
  }
  throw new Error(usage);
}
