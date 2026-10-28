import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { MAX_ARTIFACT_BYTES } from './contracts.ts';
import type { Artifact } from './contracts.ts';
import { verifyBytes } from './integrity.ts';

export async function hasManifest(directory: string): Promise<boolean> {
  try {
    await stat(join(directory, 'manifest.json'));
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function readBounded(path: string, limit = MAX_ARTIFACT_BYTES): Promise<Uint8Array> {
  if ((await stat(path)).size > limit) {
    throw new Error('cache file exceeds size limit');
  }
  const bytes = await readFile(path);
  if (bytes.length > limit) {
    throw new Error('cache file exceeds size limit');
  }
  return bytes;
}

export async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeArtifact(
  directory: string,
  meta: Artifact,
  bytes: Uint8Array,
): Promise<void> {
  verifyBytes(meta, bytes);
  await atomicWrite(join(directory, `${meta.sha256}.blob`), bytes);
}

export async function acquireLock(directory: string): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, '.lock');
  await mkdir(lock);
  return () => rm(lock, { recursive: true, force: true });
}
