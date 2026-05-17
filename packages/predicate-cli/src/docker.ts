import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findComposeDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.PREDICATE_COMPOSE_DIR,
    resolve(here, 'compose'),
    resolve(here, '..', 'compose'),
    resolve(here, '..', '..', 'predicate-skill', 'compose'),
    resolve(here, '..', '..', '..', 'predicate-skill', 'compose'),
    resolve(here, '..', '..', '..', 'predicate-server'),
  ].filter((p): p is string => Boolean(p));
  for (const c of candidates) {
    if (c && existsSync(resolve(c, 'docker-compose.yml'))) return c;
  }
  throw new Error(
    'Could not locate docker-compose.yml. ' +
    'Set PREDICATE_COMPOSE_DIR to the directory containing it, ' +
    `or run from the predicate repo root. Searched: ${candidates.join(', ')}`,
  );
}

export function dockerAvailable(): boolean {
  try {
    execSync('docker version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function compose(args: string[], cwd: string): number {
  const r = spawnSync('docker', ['compose', ...args], { cwd, stdio: 'inherit' });
  return r.status ?? 1;
}
