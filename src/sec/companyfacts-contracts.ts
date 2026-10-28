import { keys, object } from '../shared/validation.ts';
import { companyFactsUrl, parseArtifact } from './contracts.ts';
import type { Artifact } from './contracts.ts';

export type CompanyFactsManifest = {
  schemaVersion: 1;
  kind: 'sec-companyfacts';
  cik: string;
  artifact: Artifact;
};

export function parseCompanyCik(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('CIK must be a ten-digit string');
  }
  companyFactsUrl(input);
  return input;
}

export function validateCompanyFactsSnapshot(bytes: Uint8Array, company: string): void {
  parseCompanyCik(company);
  const snapshot = object(JSON.parse(new TextDecoder().decode(bytes)) as unknown, 'companyfacts');
  if (snapshot.cik !== Number(company)) {
    throw new Error('companyfacts CIK does not match request');
  }
  object(snapshot.facts, 'companyfacts.facts');
}

export function parseCompanyFactsManifest(input: unknown): CompanyFactsManifest {
  const value = object(input, 'companyfacts manifest');
  keys(value, ['schemaVersion', 'kind', 'cik', 'artifact'], 'companyfacts manifest');
  if (value.schemaVersion !== 1 || value.kind !== 'sec-companyfacts') {
    throw new Error('unsupported companyfacts manifest');
  }
  const cik = parseCompanyCik(value.cik);
  const artifact = parseArtifact(value.artifact);
  if (artifact.sourceUrl !== companyFactsUrl(cik)) {
    throw new Error('incorrect companyfacts source URL');
  }
  return { schemaVersion: 1, kind: 'sec-companyfacts', cik, artifact };
}
