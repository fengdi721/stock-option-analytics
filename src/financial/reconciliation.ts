import { extractReconciliationFacts } from './companyfacts.ts';
import type { AnnualFacts, ReportedFact } from './contracts.ts';

type ReconciledFact = {
  original: ReportedFact;
  later: ReportedFact;
} & (
  | { status: 'changed' | 'unchanged'; differenceUsd: string }
  | { status: 'unavailable'; reason: 'missing_fact' }
);

function reconcileFact(original: ReportedFact, later: ReportedFact): ReconciledFact {
  if (original.status === 'missing' || later.status === 'missing') {
    return { original, later, status: 'unavailable', reason: 'missing_fact' };
  }
  const difference = BigInt(later.value) - BigInt(original.value);
  return {
    original,
    later,
    status: difference === 0n ? 'unchanged' : 'changed',
    differenceUsd: difference.toString(),
  };
}

function filingDate(facts: AnnualFacts): string | null {
  const dates = new Set<string>();
  for (const fact of [facts.revenue, facts.netIncome]) {
    if (fact.status === 'available') {
      for (const citation of fact.citations) {
        dates.add(citation.filedAt);
      }
    }
  }
  if (dates.size > 1) {
    throw new Error('inconsistent filing dates across selected facts for one accession');
  }
  return [...dates][0] ?? null;
}

/** Numeric differences are evidence for investigation, not proof of formal restatement. */
export function reconcileAnnualFinancials(snapshot: unknown, input: unknown) {
  const { request, filings } = extractReconciliationFacts(snapshot, input);
  const [original, later] = filings;
  const originalDate = filingDate(original);
  const laterDate = filingDate(later);
  if (originalDate && laterDate && laterDate < originalDate) {
    throw new Error('later filing date precedes original filing date');
  }
  return {
    schemaVersion: 1,
    cik: request.cik,
    basis: 'same-period-explicit-filings',
    interpretation: 'numeric-disclosure-comparison-only',
    unit: 'USD',
    period: request.period,
    filings: [
      { ...request.filings[0], filedAt: originalDate },
      { ...request.filings[1], filedAt: laterDate },
    ],
    chronology:
      originalDate === null || laterDate === null
        ? 'unavailable'
        : originalDate === laterDate
          ? 'same-day-order-unverified'
          : 'ordered-by-filing-date',
    metrics: {
      revenue: reconcileFact(original.revenue, later.revenue),
      netIncome: reconcileFact(original.netIncome, later.netIncome),
    },
  };
}
