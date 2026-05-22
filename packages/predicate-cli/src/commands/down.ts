import { findComposeDir, dockerAvailable, compose } from '../docker.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { getCachedAdapter } from 'predicate-mcp/src/storage/factory.js';

export async function down(args: string[] = []): Promise<number> {
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

  if (cfg.backend === 'oxigraph') {
    const { stopDaemon } = await import('predicate-mcp/src/storage/index.js');
    if (args.includes('--all')) {
      const { homeRoot } = await import('predicate-mcp/src/config.js');
      const { readdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const roots: string[] = [join(homeRoot(), 'store')];
      try {
        const projects = await readdir(join(homeRoot(), 'projects'));
        for (const p of projects) roots.push(join(homeRoot(), 'projects', p, 'store'));
      } catch { /* none */ }
      for (const r of roots) await stopDaemon(r).catch((e) => console.error(`predicate down: ${r}: ${(e as Error).message}`));
      console.log(`predicate down: stopped home-registered oxigraph daemons (${roots.length} candidate stores).`);
      return 0;
    }
    await stopDaemon(cfg.oxigraphStorePath);
    console.log(`predicate down: stopped oxigraph daemon for ${cfg.oxigraphStorePath} (in-repo stores: run from the repo).`);
    return 0;
  }

  // oxigraph-wasm: flush any in-flight writes; nothing else to stop.
  const adapter = getCachedAdapter();
  if (adapter) {
    try { await adapter.close(); } catch { /* best effort */ }
  }
  console.log('WASM backend is in-process; no daemon to stop. Store flushed to disk.');
  return 0;
}
