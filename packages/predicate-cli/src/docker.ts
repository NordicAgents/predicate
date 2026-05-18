import { execSync, spawnSync } from 'node:child_process';
import { existsSync, cpSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// Docker Desktop on macOS only bind-mounts paths under these roots by default.
const DOCKER_SHARED_PREFIXES = ['/Users', '/Volumes', '/private', '/tmp', '/var/folders'];

function isDockerAccessible(path: string): boolean {
  return DOCKER_SHARED_PREFIXES.some(p => path.startsWith(p));
}

// Copy compose dir to ~/.predicate/compose/ so Docker Desktop can bind-mount
// it (e.g. when the package is installed under /opt/homebrew/lib/node_modules).
function stageComposeDir(src: string): string {
  const dest = join(homedir(), '.predicate', 'compose');
  cpSync(src, dest, { recursive: true, force: true });
  return dest;
}

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
    if (c && existsSync(resolve(c, 'docker-compose.yml'))) {
      return isDockerAccessible(c) ? c : stageComposeDir(c);
    }
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
