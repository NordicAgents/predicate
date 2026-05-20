import { existsSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import type { BackendName } from './storage/adapter.js';

export interface Config {
  backend: BackendName;
  fusekiUrl: string;
  dataset: string;
  queryEndpoint: string;
  updateEndpoint: string;
  dataEndpoint: string;
  oxigraphStorePath: string;
}

/** Directory name that marks a scoped (project/local) Oxigraph store. */
export const MARKER_DIR = '.predicate';

/**
 * The user-level store path (`--scope user`): `$XDG_DATA_HOME/predicate/store`
 * if XDG is set, else `$HOME/.predicate/store`.
 */
export function userStorePath(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const home = process.env.HOME ?? '';
  return xdg ? join(xdg, 'predicate', 'store') : join(home, MARKER_DIR, 'store');
}

/**
 * Walk up from `startDir` looking for a `.predicate/` marker directory.
 * Returns the path to its `store/` subdir, or undefined if none is found.
 * This is what keeps the CLI and the Claude-launched MCP server pointed at
 * the same store without any shared config file — both resolve from the
 * filesystem marker created by `predicate up`.
 */
export function findMarkerStore(startDir: string): string | undefined {
  let dir = resolve(startDir);
  const root = parse(dir).root;
  for (;;) {
    if (existsSync(join(dir, MARKER_DIR))) return join(dir, MARKER_DIR, 'store');
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}

/**
 * Resolve the Oxigraph store path. Precedence:
 *   1. PREDICATE_STORE_PATH                         (explicit override)
 *   2. nearest .predicate/ marker walking up from   (project / local scope)
 *      CLAUDE_PROJECT_DIR ?? cwd
 *   3. ~/.predicate/store if it already exists       (user scope / legacy installs)
 *   4. <baseDir>/.predicate/store                    (default = current dir)
 */
export function resolveStorePath(): string {
  const override = process.env.PREDICATE_STORE_PATH;
  if (override) return override;

  const baseDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

  const marker = findMarkerStore(baseDir);
  if (marker) return marker;

  const userStore = userStorePath();
  if (existsSync(userStore)) return userStore;

  return join(resolve(baseDir), MARKER_DIR, 'store');
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
 * Map a requested scope to the store path `predicate up --scope <scope>`
 * should create and use:
 *   - local   → <baseDir>/.predicate/store
 *   - project → <git-root>/.predicate/store (falls back to baseDir if not a repo)
 *   - user    → ~/.predicate/store
 */
export function scopeStorePath(scope: StoreScope, baseDir: string): string {
  switch (scope) {
    case 'user':
      return userStorePath();
    case 'project': {
      const root = gitRoot(baseDir) ?? baseDir;
      return join(resolve(root), MARKER_DIR, 'store');
    }
    case 'local':
    default:
      return join(resolve(baseDir), MARKER_DIR, 'store');
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
