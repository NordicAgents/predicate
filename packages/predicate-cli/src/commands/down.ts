import { findComposeDir, dockerAvailable, compose } from '../docker.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { getCachedAdapter } from 'predicate-mcp/src/storage/factory.js';

export async function down(): Promise<number> {
  const cfg = loadConfig();

  if (cfg.backend === 'fuseki') {
    if (!dockerAvailable()) {
      console.error('Docker not found.');
      return 2;
    }
    const dir = findComposeDir();
    console.log(`stopping Fuseki at ${dir}`);
    return compose(['down'], dir);
  }

  // Oxigraph: flush any in-flight writes; nothing else to "stop" since the
  // store is in-process. Future `predicate up` will reload from disk.
  const adapter = getCachedAdapter();
  if (adapter) {
    try { await adapter.close(); } catch { /* best effort */ }
  }
  console.log('Oxigraph backend is in-process; no daemon to stop. Store flushed to disk.');
  return 0;
}
