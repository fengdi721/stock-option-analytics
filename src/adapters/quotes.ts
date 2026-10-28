import { boundedInteger, keys, object } from '../shared/validation.ts';
import { amount, cents } from '../domain/money.ts';
import { parseContract } from '../domain/option-contract.ts';
import type { OptionContract } from '../domain/option-contract.ts';
import { parseScenario } from '../domain/payoff.ts';

const header = ['symbol', 'expiration', 'type', 'strike', 'bid', 'ask', 'quote_at', 'multiplier', 'source'];
type Quote = OptionContract & {
  bid: string;
  ask: string;
  quoteAt: string;
  source: 'synthetic' | 'user-provided';
};

function timestamp(value: unknown, name: string): { value: string; epoch: number } {
  if (
    typeof value !== 'string' || !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().replace('.000Z', 'Z') !== value
  ) {
    throw new Error(`${name} must be a valid UTC timestamp YYYY-MM-DDTHH:mm:ssZ`);
  }
  return { value, epoch: Date.parse(value) };
}

function contractKey(contract: OptionContract): string {
  return [contract.symbol, contract.expiration, contract.type, cents(contract.strike).toString(), contract.multiplier].join('|');
}

function parseQuotes(csv: string, asOf: number, maxAge: number): Map<string, Quote> {
  // Restricted CSV contract: no quoted cells, embedded newlines, or delimiter guessing.
  if (csv.includes('"') || csv.includes('\0')) throw new Error('quoted or NUL-containing CSV is not supported');
  const lines = csv.trim().split(/\r?\n/);
  if (lines[0] !== header.join(',')) throw new Error('CSV header must be: ' + header.join(','));
  if (lines.length < 2 || lines.length > 10001) throw new Error('CSV must contain 1–10000 data rows');
  const quotes = new Map<string, Quote>();
  for (const [index, line] of lines.slice(1).entries()) {
    const cells = line.split(',');
    if (cells.length !== header.length || cells.some(cell => cell !== cell.trim() || cell === '')) {
      throw new Error(`CSV row ${index + 2}: invalid column count, whitespace or empty field`);
    }
    const row = Object.fromEntries(header.map((key, position) => [key, cells[position]]));
    if (!/^[1-9][0-9]*$/.test(row.multiplier)) throw new Error('multiplier must be a positive integer');
    const contract = parseContract({ ...row, multiplier: Number(row.multiplier) });
    const bid = amount(row.bid, 'bid');
    const ask = amount(row.ask, 'ask');
    if (cents(bid) > cents(ask)) throw new Error('bid cannot exceed ask');
    const quoted = timestamp(row.quote_at, 'quote_at');
    if (quoted.epoch > asOf || asOf - quoted.epoch > maxAge * 1000) {
      throw new Error('quote is future-dated or stale relative to asOf');
    }
    if (quoted.value.slice(0, 10) > contract.expiration) throw new Error('quote is after expiration');
    const source = row.source;
    if (source !== 'synthetic' && source !== 'user-provided') throw new Error('source must be synthetic or user-provided');
    const key = contractKey(contract);
    if (quotes.has(key)) throw new Error('duplicate contract in snapshot');
    quotes.set(key, { ...contract, bid, ask, quoteAt: quoted.value, source });
  }
  return quotes;
}

export function scenarioFromQuotes(csv: string, input: unknown) {
  const request = object(input, 'request');
  keys(request, ['currency', 'asOf', 'maxQuoteAgeSeconds', 'legs', 'prices'], 'request');
  const asOf = timestamp(request.asOf, 'asOf');
  const maxAge = request.maxQuoteAgeSeconds;
  boundedInteger(maxAge, 'maxQuoteAgeSeconds', 0, 86400);
  if (!Array.isArray(request.legs) || request.legs.length < 1 || request.legs.length > 20) {
    throw new Error('legs must contain 1–20 legs');
  }
  const quotes = parseQuotes(csv, asOf.epoch, maxAge);
  const selections: Array<{
    symbol: string; expiration: string; type: 'call' | 'put'; strike: string;
    multiplier: number; quoteAt: string; source: Quote['source']; priceSide: 'ask' | 'bid'; premium: string;
  }> = [];
  const legs = Array.from(request.legs, (raw: unknown) => {
    const leg = object(raw, 'requested leg');
    keys(leg, ['symbol', 'expiration', 'type', 'side', 'strike', 'quantity', 'multiplier', 'feesPerContract'], 'requested leg');
    const contract = parseContract(leg);
    const quote = quotes.get(contractKey(contract));
    if (!quote) throw new Error('requested contract is missing from snapshot');
    const priceSide = leg.side === 'long' ? 'ask' : 'bid';
    const premium = quote[priceSide];
    selections.push({ symbol: quote.symbol, expiration: quote.expiration, type: quote.type,
      strike: quote.strike, multiplier: quote.multiplier, quoteAt: quote.quoteAt,
      source: quote.source, priceSide, premium });
    return { ...leg, premium };
  });
  return { scenario: parseScenario({ currency: request.currency, legs, prices: request.prices }),
    provenance: { asOf: asOf.value, maxQuoteAgeSeconds: maxAge,
      fillAssumption: 'long at ask, short at bid; no execution guarantee', selections } };
}
