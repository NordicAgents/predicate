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

// Test-only.
export function _resetAdapterCache(): void {
  cached = undefined;
}
