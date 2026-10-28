import { createHash } from 'node:crypto';
import type { Artifact } from './contracts.ts';

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
export function verifyBytes(meta: Artifact, bytes: Uint8Array): void {
  if (bytes.byteLength !== meta.byteLength || sha256(bytes) !== meta.sha256) throw new Error('cache integrity mismatch');
}
