import { boundedInteger, keys, object } from '../shared/validation.ts';
import { amount, cents, money } from './money.ts';
import { parseContract } from './option-contract.ts';
import type { OptionContract } from './option-contract.ts';

export type Leg = OptionContract & {
  side: 'long' | 'short';
  premium: string;
  quantity: number;
  feesPerContract: string;
};
export type Scenario = { currency: 'USD'; legs: Leg[]; prices: string[] };

function parseLeg(input: unknown): Leg {
  const value = object(input, 'leg');
  keys(value, ['symbol', 'expiration', 'type', 'side', 'strike', 'premium', 'quantity', 'multiplier', 'feesPerContract'], 'leg');
  const contract = parseContract(value);
  const { side, quantity } = value;
  if (side !== 'long' && side !== 'short') throw new Error('side must be long or short');
  boundedInteger(quantity, 'quantity', 1, 100000);
  return { ...contract, side, quantity, premium: amount(value.premium, 'premium'),
    feesPerContract: amount(value.feesPerContract, 'feesPerContract') };
}

export function parseScenario(input: unknown): Scenario {
  const value = object(input, 'scenario');
  keys(value, ['currency', 'legs', 'prices'], 'scenario');
  if (value.currency !== 'USD') throw new Error('currency must be USD');
  if (!Array.isArray(value.legs) || value.legs.length < 1 || value.legs.length > 20) {
    throw new Error('legs must contain 1–20 legs');
  }
  const legs = Array.from(value.legs, (raw: unknown) => parseLeg(raw));
  if (legs.some(leg => leg.symbol !== legs[0].symbol || leg.expiration !== legs[0].expiration)) {
    throw new Error('all legs must share symbol and expiration');
  }
  if (!Array.isArray(value.prices) || value.prices.length < 1 || value.prices.length > 10000) {
    throw new Error('prices must contain 1–10000 scenarios');
  }
  const prices = Array.from(value.prices, (raw: unknown) => amount(raw, 'scenario price'));
  return { currency: value.currency, legs, prices };
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
