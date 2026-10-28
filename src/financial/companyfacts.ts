import { boundedInteger, object } from '../shared/validation.ts';
import { date } from '../sec/contracts.ts';
import { parseComparisonRequest, parseReconciliationRequest } from './contracts.ts';
import type { AnnualFacts, AnnualPeriod, ReportedFact } from './contracts.ts';

const concepts = {
  revenue: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  netIncome: 'NetIncomeLoss',
};

function selectFact(
  taxonomy: Record<string, unknown>,
  concept: string,
  period: AnnualPeriod,
  form: '10-K' | '10-K/A' = '10-K',
): ReportedFact {
  if (!Object.hasOwn(taxonomy, concept)) {
    return { status: 'missing', reason: 'concept_missing' };
  }
  const definition = object(taxonomy[concept], concept);
  const units = object(definition.units, `${concept}.units`);
  if (!Object.hasOwn(units, 'USD')) {
    return { status: 'missing', reason: 'usd_unit_missing' };
  }
  if (!Array.isArray(units.USD)) {
    throw new Error(`${concept}.units.USD must be an array`);
  }
  let selected: Extract<ReportedFact, { status: 'available' }> | undefined;
  for (const [index, input] of units.USD.entries()) {
    const fact = object(input, `${concept}[${index}]`);
    if (
      fact.accn !== period.accession ||
      fact.start !== period.start ||
      fact.end !== period.end ||
      fact.form !== form
    ) {
      continue;
    }
    // JSON numbers outside the safe integer range may already have lost precision.
    boundedInteger(fact.val, `${concept}.val`, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const filedAt = fact.filed;
    date(filedAt);
    if (filedAt < period.end) {
      throw new Error(`${concept}: filing date precedes the period end`);
    }
    const value = BigInt(fact.val).toString();
    if (selected && (selected.value !== value || selected.citations[0].filedAt !== filedAt)) {
      throw new Error(`${concept}: conflicting facts for the requested accession and period`);
    }
    selected ??= { status: 'available', value, citations: [] };
    selected.citations.push({
      pointer: `/facts/us-gaap/${concept}/units/USD/${index}`,
      filedAt,
      accession: period.accession,
    });
  }
  return selected ?? { status: 'missing', reason: 'period_not_found' };
}

function readTaxonomy(snapshot: unknown, cik: string): Record<string, unknown> {
  const root = object(snapshot, 'companyfacts');
  if (root.cik !== Number(cik)) {
    throw new Error('companyfacts CIK does not match request');
  }
  const facts = object(root.facts, 'companyfacts.facts');
  return Object.hasOwn(facts, 'us-gaap') ? object(facts['us-gaap'], 'us-gaap') : {};
}

/** Select exact filing/period facts, never the latest observation of an old period. */
export function extractAnnualFacts(snapshot: unknown, input: unknown) {
  const request = parseComparisonRequest(input);
  const taxonomy = readTaxonomy(snapshot, request.cik);
  const extract = (period: AnnualPeriod): AnnualFacts => ({
    period,
    revenue: selectFact(taxonomy, concepts.revenue, period),
    netIncome: selectFact(taxonomy, concepts.netIncome, period),
  });
  const periods: [AnnualFacts, AnnualFacts] = [
    extract(request.periods[0]),
    extract(request.periods[1]),
  ];
  return { cik: request.cik, periods };
}

export function extractReconciliationFacts(snapshot: unknown, input: unknown) {
  const request = parseReconciliationRequest(input);
  const taxonomy = readTaxonomy(snapshot, request.cik);

  const extract = (filing: (typeof request.filings)[number]): AnnualFacts => {
    const period = { ...request.period, accession: filing.accession };
    return {
      period,
      revenue: selectFact(taxonomy, concepts.revenue, period, filing.form),
      netIncome: selectFact(taxonomy, concepts.netIncome, period, filing.form),
    };
  };

  const filings: [AnnualFacts, AnnualFacts] = [
    extract(request.filings[0]),
    extract(request.filings[1]),
  ];
  return { request, filings };
}
