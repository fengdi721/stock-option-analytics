import { keys, object } from '../shared/validation.ts';
import { date, parseRequest } from '../sec/contracts.ts';

export type AnnualPeriod = { accession: string; start: string; end: string };
export type ComparisonRequest = { cik: string; periods: [AnnualPeriod, AnnualPeriod] };
export type ReportedFact =
  | {
      status: 'available';
      value: string;
      citations: { pointer: string; filedAt: string; accession: string }[];
    }
  | { status: 'missing'; reason: 'concept_missing' | 'usd_unit_missing' | 'period_not_found' };
export type AnnualFacts = {
  period: AnnualPeriod;
  revenue: ReportedFact;
  netIncome: ReportedFact;
};

export function durationDays(period: AnnualPeriod): number {
  return (Date.parse(period.end) - Date.parse(period.start)) / 86_400_000 + 1;
}

function parsePeriod(input: unknown, accession: string): AnnualPeriod {
  const value = object(input, 'period');
  keys(value, ['accession', 'start', 'end'], 'period');
  const { start, end } = value;
  date(start);
  date(end);
  const period = { accession, start, end };
  if (durationDays(period) < 350 || durationDays(period) > 380) {
    throw new Error('only annual duration periods of 350–380 days supported');
  }
  return period;
}

export function parseComparisonRequest(input: unknown): ComparisonRequest {
  const value = object(input, 'comparison request');
  keys(value, ['cik', 'periods'], 'comparison request');
  if (!Array.isArray(value.periods) || value.periods.length !== 2) {
    throw new Error('exactly two annual periods required');
  }
  const first = object(value.periods[0], 'first period');
  const second = object(value.periods[1], 'second period');
  const request = parseRequest({ cik: value.cik, accessions: [first.accession, second.accession] });
  const periods: [AnnualPeriod, AnnualPeriod] = [
    parsePeriod(first, request.accessions[0]),
    parsePeriod(second, request.accessions[1]),
  ];
  if (Date.parse(periods[1].start) - Date.parse(periods[0].end) !== 86_400_000) {
    throw new Error('periods must be consecutive and ordered oldest first');
  }
  return { cik: request.cik, periods };
}

export type ReconciliationRequest = {
  cik: string;
  period: { start: string; end: string };
  filings: [{ accession: string; form: '10-K' }, { accession: string; form: '10-K' | '10-K/A' }];
};

/** Both filings must explicitly refer to the same annual duration, not two fiscal years. */
export function parseReconciliationRequest(input: unknown): ReconciliationRequest {
  const value = object(input, 'reconciliation request');
  keys(value, ['cik', 'period', 'filings'], 'reconciliation request');
  const period = object(value.period, 'period');
  keys(period, ['start', 'end'], 'period');
  if (!Array.isArray(value.filings) || value.filings.length !== 2) {
    throw new Error('exactly two explicit filings required');
  }
  const original = object(value.filings[0], 'original filing');
  const later = object(value.filings[1], 'later filing');
  for (const filing of [original, later]) {
    keys(filing, ['accession', 'form'], 'filing');
  }
  if (original.form !== '10-K' || (later.form !== '10-K' && later.form !== '10-K/A')) {
    throw new Error('require an original 10-K and an explicit later 10-K or 10-K/A');
  }
  const request = parseRequest({
    cik: value.cik,
    accessions: [original.accession, later.accession],
  });
  const annual = parsePeriod(
    { ...period, accession: request.accessions[0] },
    request.accessions[0],
  );
  return {
    cik: request.cik,
    period: { start: annual.start, end: annual.end },
    filings: [
      { accession: request.accessions[0], form: original.form },
      { accession: request.accessions[1], form: later.form },
    ],
  };
}
