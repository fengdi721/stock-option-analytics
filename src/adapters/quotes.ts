import { cents, keys, object, parseScenario, validateContract } from '../domain/payoff.ts';

const header = ['symbol','expiration','type','strike','bid','ask','quote_at','multiplier','source'];
function timestamp(value: unknown, name: string): number {
  if (typeof value !== 'string' || !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace('.000Z', 'Z') !== value)
    throw new Error(`${name} must be a valid UTC timestamp YYYY-MM-DDTHH:mm:ssZ`);
  return Date.parse(value);
}
function contractKey(q: Record<string, unknown>) {
  return [q.symbol,q.expiration,q.type,cents(q.strike).toString(),q.multiplier].join('|');
}
export function scenarioFromQuotes(csv: string, input: unknown) {
  const request = object(input, 'request'); keys(request, ['currency','asOf','maxQuoteAgeSeconds','legs','prices'], 'request');
  const asOf = timestamp(request.asOf, 'asOf');
  const maxAge = request.maxQuoteAgeSeconds;
  if (!Number.isSafeInteger(maxAge) || (maxAge as number) < 0 || (maxAge as number) > 86400)
    throw new Error('maxQuoteAgeSeconds must be an integer from 0 to 86400');
  if (!Array.isArray(request.legs) || request.legs.length < 1 || request.legs.length > 20)
    throw new Error('legs must contain 1–20 legs');
  // Restricted CSV contract: no quoted cells, embedded newlines, or delimiter guessing.
  if (csv.includes('"') || csv.includes('\0')) throw new Error('quoted or NUL-containing CSV is not supported');
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0] !== header.join(',')) throw new Error('CSV header must be: ' + header.join(','));
  if (lines.length < 2 || lines.length > 10001) throw new Error('CSV must contain 1–10000 data rows');
  const quotes = new Map<string, Record<string, unknown>>();
  for (const [i, line] of lines.slice(1).entries()) {
    const cells = line.split(',');
    if (cells.length !== header.length || cells.some(c => c !== c.trim() || c === ''))
      throw new Error(`CSV row ${i+2}: invalid column count, whitespace or empty field`);
    const q: Record<string, unknown> = Object.fromEntries(header.map((key,index) => [key,cells[index]]));
    if (!/^[1-9][0-9]*$/.test(q.multiplier as string)) throw new Error('multiplier must be a positive integer');
    q.multiplier = Number(q.multiplier); validateContract(q);
    if (cents(q.bid, 'bid') > cents(q.ask, 'ask')) throw new Error('bid cannot exceed ask');
    const quoted = timestamp(q.quote_at, 'quote_at');
    if (quoted > asOf || asOf - quoted > (maxAge as number)*1000)
      throw new Error('quote is future-dated or stale relative to asOf');
    if ((q.quote_at as string).slice(0,10) > (q.expiration as string)) throw new Error('quote is after expiration');
    if (!['synthetic','user-provided'].includes(q.source as string)) throw new Error('source must be synthetic or user-provided');
    const key=contractKey(q);
    if (quotes.has(key)) throw new Error('duplicate contract in snapshot');
    quotes.set(key,q);
  }
  const selections: Record<string, unknown>[] = [];
  const legs = request.legs.map(raw => {
    const leg=object(raw,'requested leg');
    keys(leg,['symbol','expiration','type','side','strike','quantity','multiplier','feesPerContract'],'requested leg');
    validateContract(leg);
    const q=quotes.get(contractKey(leg));
    if (!q) throw new Error('requested contract is missing from snapshot');
    const premium=leg.side==='long'?q.ask:q.bid;
    selections.push({symbol:q.symbol,expiration:q.expiration,type:q.type,strike:q.strike,multiplier:q.multiplier,
      quoteAt:q.quote_at,source:q.source,priceSide:leg.side==='long'?'ask':'bid',premium});
    return {...leg,premium};
  });
  return {scenario:parseScenario({currency:request.currency,legs,prices:request.prices}),
    provenance:{asOf:request.asOf,maxQuoteAgeSeconds:maxAge,fillAssumption:'long at ask, short at bid; no execution guarantee',selections}};
}
