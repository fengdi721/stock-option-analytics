import type { ReportedFact } from './contracts.ts';

export type Calculation =
  | { status: 'available'; value: string }
  | { status: 'unavailable'; reason: 'missing_fact' | 'nonpositive_denominator' };

/** Percentage rounded to two decimals, ties away from zero, using integer arithmetic. */
export function percentage(numerator: bigint, denominator: bigint): Calculation {
  if (denominator <= 0n) {
    return { status: 'unavailable', reason: 'nonpositive_denominator' };
  }
  const absolute = numerator < 0n ? -numerator : numerator;
  const scaled = (absolute * 10_000n * 2n + denominator) / (denominator * 2n);
  const sign = numerator < 0n && scaled !== 0n ? '-' : '';
  return {
    status: 'available',
    value: `${sign}${scaled / 100n}.${String(scaled % 100n).padStart(2, '0')}`,
  };
}

export function compareReportedFacts(previous: ReportedFact, current: ReportedFact) {
  if (previous.status === 'missing' || current.status === 'missing') {
    const missing: Calculation = { status: 'unavailable', reason: 'missing_fact' };
    return { differenceUsd: missing, percentChange: missing };
  }
  const difference = BigInt(current.value) - BigInt(previous.value);
  const differenceUsd: Calculation = { status: 'available', value: difference.toString() };
  return { differenceUsd, percentChange: percentage(difference, BigInt(previous.value)) };
}
