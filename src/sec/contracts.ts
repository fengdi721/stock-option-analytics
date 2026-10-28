export type Filing = {
  cik: string; accession: string; form: '10-K' | '10-Q';
  periodEnd: string; filedAt: string; sourceUrl: string;
  downloadedAt: string; sha256: string; byteLength: number;
};
export type Artifact = Pick<Filing, 'sourceUrl' | 'downloadedAt' | 'sha256' | 'byteLength'>;
export type Manifest = { schemaVersion: 1; submissions: Artifact; filings: [Filing, Filing] };
export type FilingRequest = { cik: string; accessions: [string, string] };
function record(v: unknown, fields: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('expected object');
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length !== fields.length || fields.some(k => !Object.hasOwn(r, k)))
    throw new Error(`expected exactly: ${fields.join(', ')}`);
  return r;
}
function matches(v: unknown, pattern: RegExp, label: string): asserts v is string {
  if (typeof v !== 'string' || !pattern.test(v)) throw new Error(`invalid ${label}`);
}
export function date(v: unknown): asserts v is string {
  matches(v, /^20\d{2}-\d{2}-\d{2}$/, 'date');
  if (!Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)
    throw new Error('invalid calendar date');
}
function cik(v: unknown): asserts v is string {
  matches(v, /^\d{10}$/, 'CIK');
  if (Number(v) === 0) throw new Error('CIK must be nonzero');
}
function accession(v: unknown): asserts v is string {
  matches(v, /^\d{10}-\d{2}-\d{6}$/, 'accession');
}
export function parseRequest(input: unknown): FilingRequest {
  const r = record(input, ['cik', 'accessions']);
  cik(r.cik);
  if (!Array.isArray(r.accessions) || r.accessions.length !== 2) throw new Error('exactly two accessions required');
  r.accessions.forEach(accession);
  if (r.accessions[0] === r.accessions[1]) throw new Error('duplicate accession');
  return r as FilingRequest;
}
export function submissionsUrl(value: string): string {
  cik(value);
  return `https://data.sec.gov/submissions/CIK${value}.json`;
}
export function filingUrl(company: string, id: string, document: string): string {
  cik(company); accession(id);
  matches(document, /^[A-Za-z0-9][A-Za-z0-9_-]*\.html?$/, 'primary document');
  return `https://www.sec.gov/Archives/edgar/data/${Number(company)}/${id.replaceAll('-', '')}/${document}`;
}
const artifactFields = ['sourceUrl', 'downloadedAt', 'sha256', 'byteLength'];
function artifact(r: Record<string, unknown>): void {
  matches(r.downloadedAt, /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'download timestamp');
  if (!Number.isFinite(Date.parse(r.downloadedAt)) || new Date(r.downloadedAt).toISOString() !== r.downloadedAt)
    throw new Error('invalid download timestamp');
  matches(r.sha256, /^[a-f0-9]{64}$/, 'SHA-256');
  if (!Number.isSafeInteger(r.byteLength) || (r.byteLength as number) < 1 || (r.byteLength as number) > 25_000_000)
    throw new Error('byteLength must be 1–25000000');
}
export function parseManifest(input: unknown): Manifest {
  const m = record(input, ['schemaVersion', 'submissions', 'filings']);
  if (m.schemaVersion !== 1) throw new Error('unsupported manifest version');
  const s = record(m.submissions, artifactFields); artifact(s);
  if (!Array.isArray(m.filings) || m.filings.length !== 2) throw new Error('exactly two filings required');
  for (const raw of m.filings) {
    const f = record(raw, ['cik', 'accession', 'form', 'periodEnd', 'filedAt', ...artifactFields]);
    cik(f.cik); accession(f.accession); date(f.periodEnd); date(f.filedAt); artifact(f);
    if (f.form !== '10-K' && f.form !== '10-Q') throw new Error('only original 10-K and 10-Q supported');
    if (f.periodEnd > f.filedAt || f.filedAt > (f.downloadedAt as string).slice(0, 10))
      throw new Error('inconsistent filing chronology');
    if (typeof f.sourceUrl !== 'string' ||
        f.sourceUrl !== filingUrl(f.cik, f.accession, f.sourceUrl.split('/').at(-1) ?? ''))
      throw new Error('noncanonical SEC filing URL');
  }
  const [a, b] = m.filings as Filing[];
  if (a.cik !== b.cik || a.accession === b.accession || a.periodEnd === b.periodEnd || a.form !== b.form)
    throw new Error('require same company/form and distinct accessions/periods');
  if (s.sourceUrl !== submissionsUrl(a.cik)) throw new Error('incorrect submissions URL');
  return m as Manifest;
}
