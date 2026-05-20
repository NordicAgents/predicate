import { loadConfig } from '../config.js';
import { FusekiAdapter } from './fuseki.js';
import { OxigraphAdapter } from './oxigraph.js';
import type { StorageAdapter } from './adapter.js';

let cached: StorageAdapter | undefined;

export function getAdapter(): StorageAdapter {
  if (cached) return cached;
  const cfg = loadConfig();
  switch (cfg.backend) {
    case 'fuseki':
      cached = new FusekiAdapter(cfg);
      return cached;
    case 'oxigraph':
      cached = new OxigraphAdapter({ storePath: cfg.oxigraphStorePath });
      return cached;
    default:
      throw new Error(`unknown PREDICATE_BACKEND='${cfg.backend}'`);
  }
}

// Returns the cached adapter without constructing one. Safe to call even if
// no command called getAdapter() during this run — returns undefined in that case.
export function getCachedAdapter(): StorageAdapter | undefined {
  return cached;
}

// Test-only.
export function _resetAdapterCache(): void {
  cached = undefined;
}
