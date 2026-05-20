import { findComposeDir, dockerAvailable, compose } from '../docker.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { init } from './init.js';

const META = 'https://predicate.dev/meta#';
const CONFIG_URI = 'urn:predicate:config';

async function checkConfigExists(client: StorageAdapter): Promise<boolean> {
  return client.ask(`
    PREFIX pred: <${META}>
    ASK { GRAPH <kg:meta> { <${CONFIG_URI}> a pred:Config } }
  `);
}

async function detectLegacyCodebase(client: StorageAdapter): Promise<boolean> {
  return client.ask(`
    PREFIX cb:  <https://predicate.dev/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }
  `);
}

async function writeLegacyConfig(client: StorageAdapter): Promise<void> {
  const now = new Date().toISOString();
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${CONFIG_URI}> a pred:Config ;
        pred:initMode              ${escapeLiteral('community')} ;
        pred:initOntology          ${escapeLiteral('codebase')} ;
        pred:schemaLearningEnabled "true"^^xsd:boolean ;
        pred:initializedAt         "${now}"^^xsd:dateTime .
    } }
  `);
}

// v2.0.1: poll Fuseki's /$/ping until it responds (or we hit the timeout).
// `docker compose up -d` returns when the container has been CREATED, not
// when Fuseki is bound to the port and serving SPARQL. Without this poll,
// the very next fetch() inside up() crashes with `fetch failed` (ECONNREFUSED).
async function waitForFuseki(timeoutSec = 20): Promise<boolean> {
  const cfg = loadConfig();
  const url = `${cfg.fusekiUrl}/$/ping`;
  for (let i = 0; i < timeoutSec; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise((res) => setTimeout(res, 1000));
  }
  return false;
}

export async function up(): Promise<number> {
  const { loadConfig } = await import('predicate-mcp/src/config.js');
  const cfg = loadConfig();

  if (cfg.backend === 'fuseki') {
    if (!dockerAvailable()) {
      console.error('Docker not found. Install Docker Desktop or Docker Engine first, or unset PREDICATE_BACKEND to use the default in-process Oxigraph backend.');
      return 2;
    }
    const dir = findComposeDir();
    console.log(`bringing Fuseki up from ${dir}`);
    const rc = await compose(['up', '-d'], dir);
    if (rc !== 0) return rc;
    const ready = await waitForFuseki(20);
    if (!ready) {
      console.error('predicate up: Fuseki did not become ready in 20s.');
      return 1;
    }
  } else {
    console.log(`opening Oxigraph store at ${cfg.oxigraphStorePath}`);
  }

  // Bootstrap + init paths are shared.
  const { bootstrapGraphs } = await import('predicate-server/src/index.js');
  const { getAdapter } = await import('predicate-mcp/src/storage/index.js');
  const client = getAdapter();
  await bootstrapGraphs(client);

  try {
    if (await checkConfigExists(client)) return 0;
    if (await detectLegacyCodebase(client)) {
      await writeLegacyConfig(client);
      console.log(`predicate up: legacy codebase ontology detected — wrote 'community/codebase' config.`);
      return 0;
    }
    if (process.stdin.isTTY) return init([]);
    console.error('predicate up: no init config and non-TTY stdin; defaulting to empty mode.');
    return init(['--mode', 'empty']);
  } catch (err) {
    console.error(`predicate up: post-bootstrap init check failed: ${(err as Error).message}`);
    return 0;
  }
}
