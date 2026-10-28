import { filingUrl } from './contracts.ts';
import type { Filing, FilingRequest } from './contracts.ts';

export type FilingMetadata = Pick<Filing, 'cik' | 'accession' | 'form' | 'periodEnd' | 'filedAt' | 'sourceUrl'>;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid submissions object');
  }
  return value as Record<string, unknown>;
}

/** Only the recent table is supported; historical archive files need their own provenance contract. */
export function selectFilings(bytes: Uint8Array, request: FilingRequest): [FilingMetadata, FilingMetadata] {
  const doc = object(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  if ((typeof doc.cik !== 'string' && typeof doc.cik !== 'number') ||
      String(doc.cik).padStart(10, '0') !== request.cik) {
    throw new Error('submissions CIK mismatch');
  }
  const recent = object(object(doc.filings).recent);
  const fields = ['accessionNumber', 'form', 'reportDate', 'filingDate', 'primaryDocument'];
  const ids: unknown = recent.accessionNumber;
  if (!Array.isArray(ids) || fields.some(key => !Array.isArray(recent[key]) || recent[key].length !== ids.length)) {
    throw new Error('invalid submissions columns');
  }

  const select = (id: string): FilingMetadata => {
    const matches = ids.flatMap((value: unknown, index) => value === id ? [index] : []);
    if (matches.length !== 1) {
      throw new Error(`accession ${id} missing or duplicated in recent submissions; historical archives not supported`);
    }
    const index = matches[0];
    const value = (key: string): string => {
      const column = recent[key];
      if (!Array.isArray(column) || typeof column[index] !== 'string') {
        throw new Error(`invalid submissions ${key}`);
      }
      return column[index];
    };
    const form = value('form');
    if (form !== '10-K' && form !== '10-Q') {
      throw new Error('only original 10-K and 10-Q supported');
    }
    return {
      cik: request.cik,
      accession: id,
      form,
      periodEnd: value('reportDate'),
      filedAt: value('filingDate'),
      sourceUrl: filingUrl(request.cik, id, value('primaryDocument')),
    };
  };
  return [select(request.accessions[0]), select(request.accessions[1])];
}
