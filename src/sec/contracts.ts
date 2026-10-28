import { boundedInteger, keys, object } from '../shared/validation.ts';

export const MAX_ARTIFACT_BYTES = 25_000_000;
export type FilingMetadata = {
  cik: string;
  accession: string;
  form: '10-K' | '10-Q';
  periodEnd: string;
  filedAt: string;
  sourceUrl: string;
};
export type Artifact = {
  sourceUrl: string;
  downloadedAt: string;
  sha256: string;
  byteLength: number;
};
export type Filing = FilingMetadata & Artifact;
export type Manifest = { schemaVersion: 1; submissions: Artifact; filings: [Filing, Filing] };
export type FilingRequest = { cik: string; accessions: [string, string] };
const metadataFields = ['cik', 'accession', 'form', 'periodEnd', 'filedAt', 'sourceUrl'];
const downloadFields = ['downloadedAt', 'sha256', 'byteLength'];
function record(value: unknown, fields: string[]): Record<string, unknown> {
  const result = object(value, 'SEC input');
  keys(result, fields, 'SEC input');
  return result;
}
function matches(value: unknown, pattern: RegExp, label: string): asserts value is string {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`invalid ${label}`);
  }
}
export function date(value: unknown): asserts value is string {
  matches(value, /^20\d{2}-\d{2}-\d{2}$/, 'date');
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('invalid calendar date');
  }
}
function cik(value: unknown): asserts value is string {
  matches(value, /^\d{10}$/, 'CIK');
  if (Number(value) === 0) {
    throw new Error('CIK must be nonzero');
  }
}
function accession(value: unknown): asserts value is string {
  matches(value, /^\d{10}-\d{2}-\d{6}$/, 'accession');
}
export function parseRequest(input: unknown): FilingRequest {
  const value = record(input, ['cik', 'accessions']);
  const company = value.cik;
  cik(company);
  if (!Array.isArray(value.accessions) || value.accessions.length !== 2) {
    throw new Error('exactly two accessions required');
  }
  const first: unknown = value.accessions[0];
  const second: unknown = value.accessions[1];
  accession(first);
  accession(second);
  if (first === second) {
    throw new Error('duplicate accession');
  }
  return { cik: company, accessions: [first, second] };
}
export function submissionsUrl(value: string): string {
  cik(value);
  return `https://data.sec.gov/submissions/CIK${value}.json`;
}
export function companyFactsUrl(value: string): string {
  cik(value);
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${value}.json`;
}

export function filingUrl(company: string, id: string, document: string): string {
  cik(company);
  accession(id);
  matches(document, /^[A-Za-z0-9][A-Za-z0-9_-]*\.html?$/, 'primary document');
  return `https://www.sec.gov/Archives/edgar/data/${Number(company)}/${id.replaceAll('-', '')}/${document}`;
}
/** Metadata is valid independently of whether the document has been downloaded. */
export function parseFilingMetadata(input: unknown): FilingMetadata {
  const value = record(input, metadataFields);
  const { cik: company, accession: id, form, periodEnd, filedAt, sourceUrl } = value;
  cik(company);
  accession(id);
  date(periodEnd);
  date(filedAt);
  if (form !== '10-K' && form !== '10-Q') {
    throw new Error('only original 10-K and 10-Q supported');
  }
  if (periodEnd > filedAt) {
    throw new Error('inconsistent filing chronology');
  }
  if (
    typeof sourceUrl !== 'string' ||
    sourceUrl !== filingUrl(company, id, sourceUrl.split('/').at(-1) ?? '')
  ) {
    throw new Error('noncanonical SEC filing URL');
  }
  return { cik: company, accession: id, form, periodEnd, filedAt, sourceUrl };
}
function validatePair(filings: readonly [FilingMetadata, FilingMetadata]): void {
  const [first, second] = filings;
  if (
    first.cik !== second.cik ||
    first.accession === second.accession ||
    first.periodEnd === second.periodEnd ||
    first.form !== second.form
  ) {
    throw new Error('require same company/form and distinct accessions/periods');
  }
}
export function parseMetadataPair(input: unknown): [FilingMetadata, FilingMetadata] {
  if (!Array.isArray(input) || input.length !== 2) {
    throw new Error('exactly two filings required');
  }
  const pair: [FilingMetadata, FilingMetadata] = [
    parseFilingMetadata(input[0]),
    parseFilingMetadata(input[1]),
  ];
  validatePair(pair);
  return pair;
}
export function parseArtifact(input: unknown): Artifact {
  const value = record(input, ['sourceUrl', ...downloadFields]);
  const { sourceUrl, downloadedAt, sha256, byteLength } = value;
  if (typeof sourceUrl !== 'string') {
    throw new Error('invalid source URL');
  }
  matches(downloadedAt, /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'download timestamp');
  if (
    !Number.isFinite(Date.parse(downloadedAt)) ||
    new Date(downloadedAt).toISOString() !== downloadedAt
  ) {
    throw new Error('invalid download timestamp');
  }
  matches(sha256, /^[a-f0-9]{64}$/, 'SHA-256');
  boundedInteger(byteLength, 'byteLength', 1, MAX_ARTIFACT_BYTES);
  return { sourceUrl, downloadedAt, sha256, byteLength };
}
function parseFiling(input: unknown): Filing {
  const value = record(input, [...metadataFields, ...downloadFields]);
  const metadata = parseFilingMetadata({
    cik: value.cik,
    accession: value.accession,
    form: value.form,
    periodEnd: value.periodEnd,
    filedAt: value.filedAt,
    sourceUrl: value.sourceUrl,
  });
  const artifact = parseArtifact({
    sourceUrl: value.sourceUrl,
    downloadedAt: value.downloadedAt,
    sha256: value.sha256,
    byteLength: value.byteLength,
  });
  if (metadata.filedAt > artifact.downloadedAt.slice(0, 10)) {
    throw new Error('inconsistent filing chronology');
  }
  return { ...metadata, ...artifact };
}
export function parseManifest(input: unknown): Manifest {
  const value = record(input, ['schemaVersion', 'submissions', 'filings']);
  if (value.schemaVersion !== 1) {
    throw new Error('unsupported manifest version');
  }
  const submissions = parseArtifact(value.submissions);
  if (!Array.isArray(value.filings) || value.filings.length !== 2) {
    throw new Error('exactly two filings required');
  }
  const filings: [Filing, Filing] = [parseFiling(value.filings[0]), parseFiling(value.filings[1])];
  validatePair(filings);
  if (submissions.sourceUrl !== submissionsUrl(filings[0].cik)) {
    throw new Error('incorrect submissions URL');
  }
  return { schemaVersion: 1, submissions, filings };
}
