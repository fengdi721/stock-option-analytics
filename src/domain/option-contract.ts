import { boundedInteger } from '../shared/validation.ts';
import { amount } from './money.ts';

export type OptionContract = {
  symbol: string;
  expiration: string;
  type: 'call' | 'put';
  strike: string;
  multiplier: number;
};

export function parseContract(value: Record<string, unknown>): OptionContract {
  const { symbol, expiration, type, multiplier } = value;
  if (typeof symbol !== 'string' || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) {
    throw new Error('symbol must be an uppercase ticker');
  }
  if (
    typeof expiration !== 'string' ||
    !/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(expiration) ||
    !Number.isFinite(Date.parse(expiration)) ||
    new Date(expiration).toISOString().slice(0, 10) !== expiration
  ) {
    throw new Error('expiration must be a valid YYYY-MM-DD date in 2000–2099');
  }
  if (type !== 'call' && type !== 'put') {
    throw new Error('type must be call or put');
  }
  const strike = amount(value.strike, 'strike');
  boundedInteger(multiplier, 'multiplier', 1, 100000);
  return { symbol, expiration, type, strike, multiplier };
}
