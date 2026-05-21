import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
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
 * Home-keyed per-project store for directories that are NOT git repos:
 * `<homeRoot>/projects/<hash>/store`. Keyed by a hash of the absolute dir so
 * non-repo projects never share state and nothing is written into the folder.
 */
export function projectStorePath(projectDir: string): string {
  const key = createHash('sha256').update(resolve(projectDir)).digest('hex').slice(0, 16);
  return join(homeRoot(), 'projects', key, 'store');
}

/** In-repo store path for a given root: `<dir>/.predicate/store`. */
export function inRepoStorePath(dir: string): string {
  return join(resolve(dir), MARKER_DIR, 'store');
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

/**
 * Walk up from `startDir` looking for an existing `.predicate/` store; return
 * its store path, or undefined. Lets a subdirectory (or a later session) reuse
 * the store an ancestor already established instead of forking a new one.
 */
/** realpath if it resolves, else a normalized path — for symlink-safe compares. */
function canonical(p: string): string {
  try { return realpathSync(p); } catch { return resolve(p); }
}

export function findExistingStoreUpward(startDir: string): string | undefined {
  const global = canonical(userStorePath());
  let dir = resolve(startDir);
  const root = parse(dir).root;
  for (;;) {
    const candidate = join(dir, MARKER_DIR, 'store');
    // Never treat the global ~/.predicate/store as a project store, even
    // though home is an ancestor of most projects. Compare via realpath so a
    // symlinked path (e.g. /tmp → /private/tmp) can't slip past the check.
    if (existsSync(candidate) && canonical(candidate) !== global) return candidate;
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
 *   1. PREDICATE_STORE_PATH                  (explicit override)
 *   2. existing .predicate/store walking up  (reuse an established store)
 *   3. <git-root>/.predicate/store           (inside a git repo)
 *   4. <homeRoot>/projects/<hash>/store       (non-repo dir, keyed by path)
 */
export function resolveStorePath(): string {
  const override = process.env.PREDICATE_STORE_PATH;
  if (override) return override;

  const projectDir = currentProjectDir();

  const existing = findExistingStoreUpward(projectDir);
  if (existing) return existing;

  const repo = gitRoot(projectDir);
  if (repo) return inRepoStorePath(repo);

  return projectStorePath(projectDir);
}

/**
 * Map an explicit scope to a store path:
 *   - local   → <baseDir>/.predicate/store
 *   - project → <git-root>/.predicate/store (falls back to baseDir if not a repo)
 *   - user    → the global ~/.predicate/store
 */
export function scopeStorePath(scope: StoreScope, baseDir: string): string {
  switch (scope) {
    case 'user':
      return userStorePath();
    case 'project':
      return inRepoStorePath(gitRoot(baseDir) ?? baseDir);
    case 'local':
    default:
      return inRepoStorePath(baseDir);
  }
}

/**
 * Resolve the store path for a CLI command that accepts `--scope`, keeping it
 * consistent with the long-running server and every other command:
 *   1. An explicit PREDICATE_STORE_PATH always wins (documented override #1),
 *      even over `--scope`, so `up --scope X` opens the same store the server
 *      and read-CLIs will later resolve via `resolveStorePath()`.
 *   2. Otherwise an explicit `--scope` maps to its scope path.
 *   3. Otherwise fall back to the shared auto-resolver.
 */
export function resolveStorePathForScope(
  scope: StoreScope | undefined,
  baseDir: string,
): string {
  const override = process.env.PREDICATE_STORE_PATH?.trim();
  if (override) return override;
  return scope ? scopeStorePath(scope, baseDir) : resolveStorePath();
}

/**
 * If `storePath` is an in-repo store (`<repo>/.predicate/store`) inside a git
 * working tree, make sure that repo's `.gitignore` ignores `.predicate/`.
 * No-op for home-keyed/global stores or non-git dirs. Best-effort.
 */
export function ensureGitignoreForStore(storePath: string): void {
  const containing = dirname(dirname(resolve(storePath))); // dir holding `.predicate`
  const repo = gitRoot(containing);
  if (!repo) return;
  const gitignore = join(repo, '.gitignore');
  const entry = `${MARKER_DIR}/`;
  let body = '';
  try {
    if (existsSync(gitignore)) body = readFileSync(gitignore, 'utf8');
  } catch { return; }
  const lines = body.split('\n').map((l) => l.trim());
  if (lines.includes(entry) || lines.includes(MARKER_DIR)) return;
  const prefix = body.length > 0 && !body.endsWith('\n') ? '\n' : '';
  try {
    writeFileSync(gitignore, `${body}${prefix}${entry}\n`);
  } catch { /* best effort */ }
}

export function loadConfig(): Config {
  const raw = process.env.FUSEKI_URL ?? 'http://localhost:3030';
  const fusekiUrl = raw.replace(/\/+$/, '');
  const dataset = process.env.PREDICATE_DATASET ?? 'predicate';
  // Use `||` (not `??`) and trim so that an empty or whitespace-only
  // PREDICATE_BACKEND (e.g. `export PREDICATE_BACKEND=` in a shell rc) falls
  // back to the default instead of becoming an invalid `''` backend.
  const backend = (process.env.PREDICATE_BACKEND?.trim() || 'oxigraph') as BackendName;
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
