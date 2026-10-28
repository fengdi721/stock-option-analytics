import { keys, object } from '../shared/validation.ts';
import { parseComparisonRequest } from './contracts.ts';
import type { ComparisonRequest } from './contracts.ts';

// Fixed mappings avoid silently substituting a different accounting concept.
export const metricConcepts = {
  revenue: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  netIncome: 'NetIncomeLoss',
  operatingCashFlow: 'NetCashProvidedByUsedInOperatingActivities',
} as const;

export type FinancialMetric = keyof typeof metricConcepts;
export type MetricsRequest = ComparisonRequest & { metrics: FinancialMetric[] };

function isMetric(value: unknown): value is FinancialMetric {
  return typeof value === 'string' && Object.hasOwn(metricConcepts, value);
}

export function parseMetricsRequest(input: unknown): MetricsRequest {
  const value = object(input, 'metrics request');
  keys(value, ['cik', 'periods', 'metrics'], 'metrics request');
  const request = parseComparisonRequest({ cik: value.cik, periods: value.periods });
  if (!Array.isArray(value.metrics) || value.metrics.length < 1 || value.metrics.length > 3) {
    throw new Error('select one to three distinct supported metrics');
  }
  // Array.from also validates sparse array slots supplied by direct callers.
  const metrics = Array.from(value.metrics, (metric: unknown) => {
    if (!isMetric(metric)) {
      throw new Error('unsupported metric: require revenue, netIncome or operatingCashFlow');
    }
    return metric;
  });
  if (new Set(metrics).size !== metrics.length) {
    throw new Error('duplicate metric');
  }
  return { ...request, metrics };
}
