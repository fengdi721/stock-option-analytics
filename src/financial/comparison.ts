import { extractAnnualFacts } from './companyfacts.ts';
import { durationDays } from './contracts.ts';
import type { AnnualFacts } from './contracts.ts';
import { percentage, compareReportedFacts } from './calculations.ts';
import type { Calculation } from './calculations.ts';

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
      revenue: compareReportedFacts(previous.revenue, current.revenue),
      netIncome: compareReportedFacts(previous.netIncome, current.netIncome),
    },
  };
}
