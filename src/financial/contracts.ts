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
