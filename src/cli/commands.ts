import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateExpiryPayoff } from '../domain/payoff.ts';
import { retrieveFilings, validateCache } from '../sec/retrieval.ts';
import { scenarioFromQuotes } from '../adapters/quotes.ts';

export const usage = 'Usage: node src/cli.ts payoff <scenario.json> | quote-payoff <snapshot.csv> <request.json> | sec-fetch <request.json> <cache-root> | sec-validate <cache-directory>';
function read(path: string): string {
  if (statSync(path).size > 2_000_000) throw new Error('input exceeds 2 MB limit');
  return readFileSync(path, 'utf8');
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
    return { ...calculateExpiryPayoff(scenario), provenance: { ...provenance,
      snapshotSha256: createHash('sha256').update(csv).digest('hex') } };
  }
  if (args[0] === 'sec-fetch' && args.length === 3) {
    return retrieveFilings(readJson(args[1]), args[2], { userAgent: environment.SEC_USER_AGENT });
  }
  if (args[0] === 'sec-validate' && args.length === 2) {
    return { valid: true, manifest: await validateCache(args[1]) };
  }
  throw new Error(usage);
}
