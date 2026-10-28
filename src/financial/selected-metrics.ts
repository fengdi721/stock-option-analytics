import { extractSelectedMetrics } from './companyfacts.ts';
import { compareReportedFacts } from './calculations.ts';
import { durationDays } from './contracts.ts';

/** Compare only explicitly selected annual USD concepts, preserving request order. */
export function compareSelectedMetrics(snapshot: unknown, input: unknown) {
  const extracted = extractSelectedMetrics(snapshot, input);
  return {
    schemaVersion: 1,
    cik: extracted.cik,
    basis: 'as-filed-selected-metrics',
    unit: 'USD',
    percentageDecimals: 2,
    periods: extracted.periods.map((period) => ({ ...period, durationDays: durationDays(period) })),
    warnings:
      durationDays(extracted.periods[0]) === durationDays(extracted.periods[1])
        ? []
        : ['unequal_period_lengths'],
    metrics: extracted.metrics.map((entry) => ({
      ...entry,
      change: compareReportedFacts(entry.observations[0], entry.observations[1]),
    })),
  };
}
