import { boundedInteger, object } from '../shared/validation.ts';
import { date } from '../sec/contracts.ts';
import { parseComparisonRequest } from './contracts.ts';
import type { AnnualFacts, AnnualPeriod, ReportedFact } from './contracts.ts';

const concepts = {
  revenue: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  netIncome: 'NetIncomeLoss',
};

function selectFact(
  taxonomy: Record<string, unknown>,
  concept: string,
  period: AnnualPeriod,
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
      fact.form !== '10-K'
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

/** Select exact filing/period facts, never the latest observation of an old period. */
export function extractAnnualFacts(snapshot: unknown, input: unknown) {
  const request = parseComparisonRequest(input);
  const root = object(snapshot, 'companyfacts');
  if (root.cik !== Number(request.cik)) {
    throw new Error('companyfacts CIK does not match request');
  }
  const facts = object(root.facts, 'companyfacts.facts');
  const taxonomy = Object.hasOwn(facts, 'us-gaap') ? object(facts['us-gaap'], 'us-gaap') : {};
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
