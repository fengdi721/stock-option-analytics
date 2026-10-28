import { extractAnnualFacts } from './companyfacts.ts';
import { durationDays } from './contracts.ts';
import type { AnnualFacts, ReportedFact } from './contracts.ts';

type Calculation =
  | { status: 'available'; value: string }
  | { status: 'unavailable'; reason: 'missing_fact' | 'nonpositive_denominator' };

/** Percentage rounded to two decimals, ties away from zero, using integer arithmetic. */
function percentage(numerator: bigint, denominator: bigint): Calculation {
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

function change(previous: ReportedFact, current: ReportedFact) {
  if (previous.status === 'missing' || current.status === 'missing') {
    const missing: Calculation = { status: 'unavailable', reason: 'missing_fact' };
    return { differenceUsd: missing, percentChange: missing };
  }
  const difference = BigInt(current.value) - BigInt(previous.value);
  const differenceUsd: Calculation = { status: 'available', value: difference.toString() };
  return { differenceUsd, percentChange: percentage(difference, BigInt(previous.value)) };
}

function margin(facts: AnnualFacts): Calculation {
  if (facts.revenue.status === 'missing' || facts.netIncome.status === 'missing') {
    return { status: 'unavailable', reason: 'missing_fact' };
  }
  return percentage(BigInt(facts.netIncome.value), BigInt(facts.revenue.value));
}

export function compareAnnualFinancials(snapshot: unknown, request: unknown) {
  const extracted = extractAnnualFacts(snapshot, request);
  const [previous, current] = extracted.periods;
  return {
    schemaVersion: 1,
    cik: extracted.cik,
    basis: 'as-filed',
    unit: 'USD',
    percentageDecimals: 2,
    warnings:
      durationDays(previous.period) === durationDays(current.period)
        ? []
        : ['unequal_period_lengths'],
    periods: extracted.periods.map((facts) => ({
      ...facts,
      durationDays: durationDays(facts.period),
      netMarginPercent: margin(facts),
    })),
    changes: {
      revenue: change(previous.revenue, current.revenue),
      netIncome: change(previous.netIncome, current.netIncome),
    },
  };
}
