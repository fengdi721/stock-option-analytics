export type Leg = {
  symbol: string; expiration: string; type: 'call' | 'put'; side: 'long' | 'short';
  strike: string; premium: string; quantity: number; multiplier: number;
  feesPerContract: string;
};
export type Scenario = { currency: 'USD'; legs: Leg[]; prices: string[] };

export function object(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, expected: string[], name: string): void {
  if (Object.keys(value).some(key => !expected.includes(key)) || expected.some(key => !(key in value)))
    throw new Error(`${name} must contain exactly: ${expected.join(', ')}`);
}
// All accepted USD amounts are decimal strings. BigInt preserves exact cents.
export function cents(value: unknown, name = 'amount'): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$/.test(value))
    throw new Error(`${name} must be a nonnegative USD decimal string with at most 2 decimals (max 999999999.99)`);
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function money(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
function integer(value: unknown, name: string): void {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 100000)
    throw new Error(`${name} must be an integer from 1 to 100000`);
}
export function validateContract(value: Record<string, unknown>): void {
  if (typeof value.symbol !== 'string' || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(value.symbol))
    throw new Error('symbol must be an uppercase ticker');
  const date = value.expiration;
  if (typeof date !== 'string' || !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)
    throw new Error('expiration must be a valid YYYY-MM-DD date in 2000–2099');
  if (!['call', 'put'].includes(value.type as string)) throw new Error('type must be call or put');
  cents(value.strike, 'strike'); integer(value.multiplier, 'multiplier');
}
export function parseScenario(input: unknown): Scenario {
  const v = object(input, 'scenario'); keys(v, ['currency', 'legs', 'prices'], 'scenario');
  if (v.currency !== 'USD') throw new Error('currency must be USD');
  if (!Array.isArray(v.legs) || v.legs.length < 1 || v.legs.length > 20)
    throw new Error('legs must contain 1–20 legs');
  for (const raw of v.legs) {
    const leg = object(raw, 'leg');
    keys(leg, ['symbol','expiration','type','side','strike','premium','quantity','multiplier','feesPerContract'], 'leg');
    validateContract(leg);
    if (!['long', 'short'].includes(leg.side as string)) throw new Error('side must be long or short');
    integer(leg.quantity, 'quantity'); cents(leg.premium, 'premium'); cents(leg.feesPerContract, 'feesPerContract');
  }
  const legs = v.legs as Leg[];
  if (legs.some(l => l.symbol !== legs[0].symbol || l.expiration !== legs[0].expiration))
    throw new Error('all legs must share symbol and expiration');
  if (!Array.isArray(v.prices) || v.prices.length < 1 || v.prices.length > 10000)
    throw new Error('prices must contain 1–10000 scenarios');
  v.prices.forEach(price => cents(price, 'scenario price'));
  return v as Scenario;
}
export function calculateExpiryPayoff(input: unknown) {
  const scenario = parseScenario(input);
  return {
    schemaVersion: 1,
    currency: scenario.currency,
    symbol: scenario.legs[0].symbol,
    expiration: scenario.legs[0].expiration,
    assumptions: ['Expiry intrinsic value only; no early exercise, assignment or margin simulation.',
      'Premium is per share; multiplier is explicit; feesPerContract is total allocated fee per contract.',
      'Amounts are exact USD cents; input prices are scenarios, not predictions.'],
    rows: scenario.prices.map(price => {
      const spot = cents(price);
      let total = 0n;
      const legs = scenario.legs.map((leg, index) => {
        const signedIntrinsic = leg.type === 'call' ? spot - cents(leg.strike) : cents(leg.strike) - spot;
        const intrinsic = signedIntrinsic > 0n ? signedIntrinsic : 0n;
        const size = BigInt(leg.quantity) * BigInt(leg.multiplier);
        const gross = (leg.side === 'long' ? 1n : -1n) * (intrinsic - cents(leg.premium)) * size;
        const fees = cents(leg.feesPerContract) * BigInt(leg.quantity);
        total += gross - fees;
        return {index, intrinsicPerShare: money(intrinsic), grossPnl: money(gross), fees: money(fees), netPnl: money(gross - fees)};
      });
      return {price: money(spot), legs, netPnl: money(total)};
    })
  };
}
