import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve } from 'node:path';
import type { BackendName } from './storage/adapter.js';
import { resolveProjectDir } from './project-dir.js';

export interface Config {
  backend: BackendName;
  fusekiUrl: string;
  dataset: string;
  queryEndpoint: string;
  updateEndpoint: string;
  dataEndpoint: string;
  oxigraphStorePath: string;
}

/** Directory name for Predicate's home root. */
export const MARKER_DIR = '.predicate';

/** Predicate's home root: `$XDG_DATA_HOME/predicate` if set, else `$HOME/.predicate`. */
export function homeRoot(): string {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return join(xdg, 'predicate');
  const home = process.env.HOME ?? homedir();
  return join(home, MARKER_DIR);
}

/**
 * The global user-level store (`--scope user`): `<homeRoot>/store`. A single
 * shared graph across all projects.
 */
export function userStorePath(): string {
  return join(homeRoot(), 'store');
}

/**
 * Per-project store, keyed by a hash of the absolute project dir. Lives under
 * `<homeRoot>/projects/<hash>/store` so projects never share state and nothing
 * is written inside the repo (no .gitignore needed). This is the default.
 */
export function projectStorePath(projectDir: string): string {
  const key = createHash('sha256').update(resolve(projectDir)).digest('hex').slice(0, 16);
  return join(homeRoot(), 'projects', key, 'store');
}

export type StoreScope = 'local' | 'project' | 'user';

/** Walk up from `start` to find the enclosing git working tree, if any. */
export function gitRoot(start: string): string | undefined {
  let dir = resolve(start);
  const root = parse(dir).root;
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}

/** The project dir for this process, resolved robustly (see project-dir.ts). */
export function currentProjectDir(): string {
  return resolveProjectDir({
    env: process.env,
    cwd: process.cwd(),
    pwd: process.env.PWD,
    transcriptsRoot: join(process.env.HOME ?? homedir(), '.claude', 'projects'),
    // Only trust a transcript touched within the last day as a project signal.
    transcriptMaxAgeMs: 24 * 60 * 60 * 1000,
  });
}

/**
 * Resolve the Oxigraph store path. Precedence:
 *   1. PREDICATE_STORE_PATH                    (explicit override)
 *   2. <homeRoot>/projects/<hash>/store        (per-project, keyed by the
 *                                               robustly-resolved project dir)
 */
export function resolveStorePath(): string {
  const override = process.env.PREDICATE_STORE_PATH;
  if (override) return override;
  return projectStorePath(currentProjectDir());
}

/**
 * Map a requested scope to a store path:
 *   - local   → per-project store keyed by baseDir
 *   - project → per-project store keyed by the git root (falls back to baseDir)
 *   - user    → the global ~/.predicate/store
 */
export function scopeStorePath(scope: StoreScope, baseDir: string): string {
  switch (scope) {
    case 'user':
      return userStorePath();
    case 'project':
      return projectStorePath(gitRoot(baseDir) ?? baseDir);
    case 'local':
    default:
      return projectStorePath(baseDir);
  }
}

export function loadConfig(): Config {
  const raw = process.env.FUSEKI_URL ?? 'http://localhost:3030';
  const fusekiUrl = raw.replace(/\/+$/, '');
  const dataset = process.env.PREDICATE_DATASET ?? 'predicate';
  const backend = (process.env.PREDICATE_BACKEND ?? 'oxigraph') as BackendName;
  const oxigraphStorePath = resolveStorePath();
  return {
    backend,
    fusekiUrl,
    dataset,
    queryEndpoint: `${fusekiUrl}/${dataset}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset}/data`,
    oxigraphStorePath,
  };
}
