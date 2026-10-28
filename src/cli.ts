import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calculateExpiryPayoff } from './domain/payoff.ts';
import { scenarioFromQuotes } from './adapters/quotes.ts';

const usage='Usage: node src/cli.ts payoff <scenario.json> | quote-payoff <snapshot.csv> <request.json>';
function read(path: string): string {
  if (statSync(path).size > 2_000_000) throw new Error('input exceeds 2 MB limit');
  return readFileSync(path,'utf8');
}
try {
  const args=process.argv.slice(2);
  if (args.length===1 && ['--help','-h'].includes(args[0])) console.log(usage);
  else if (args[0]==='payoff' && args.length===2) {
    console.log(JSON.stringify(calculateExpiryPayoff(JSON.parse(read(args[1]))),null,2));
  } else if (args[0]==='quote-payoff' && args.length===3) {
    const csv=read(args[1]);
    const {scenario,provenance}=scenarioFromQuotes(csv,JSON.parse(read(args[2])));
    console.log(JSON.stringify({...calculateExpiryPayoff(scenario),provenance:{...provenance,
      snapshotSha256:createHash('sha256').update(csv).digest('hex')}},null,2));
  } else throw new Error(usage);
} catch(error) {
  console.error(JSON.stringify({error:error instanceof Error?error.message:String(error)}));
  process.exitCode=1;
}
