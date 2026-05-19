import { loadConfig } from '../config.js';
import { FusekiAdapter } from './fuseki.js';
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
      throw new Error(
        'PREDICATE_BACKEND=oxigraph is the default but the adapter is not yet linked; ' +
        'set PREDICATE_BACKEND=fuseki to use the HTTP backend in this build.',
      );
    default:
      throw new Error(`unknown PREDICATE_BACKEND='${cfg.backend}'`);
  }
}

// Test-only.
export function _resetAdapterCache(): void {
  cached = undefined;
}
