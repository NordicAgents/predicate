import { findComposeDir, dockerAvailable, compose } from '../docker.js';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { init } from './init.js';

const META = 'https://predicate.dev/meta#';
const CONFIG_URI = 'urn:predicate:config';

async function checkConfigExists(client: SparqlClient): Promise<boolean> {
  return client.ask(`
    PREFIX pred: <${META}>
    ASK { GRAPH <kg:meta> { <${CONFIG_URI}> a pred:Config } }
  `);
}

async function detectLegacyCodebase(client: SparqlClient): Promise<boolean> {
  return client.ask(`
    PREFIX cb:  <https://predicate.dev/codebase#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    ASK { GRAPH <kg:tbox> { cb:File a owl:Class } }
  `);
}

async function writeLegacyConfig(client: SparqlClient): Promise<void> {
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

export async function up(): Promise<number> {
  if (!dockerAvailable()) {
    console.error('Docker not found. Install Docker Desktop or Docker Engine first.');
    return 2;
  }
  const dir = findComposeDir();
  console.log(`bringing Fuseki up from ${dir}`);
  const rc = await compose(['up', '-d'], dir);
  if (rc !== 0) return rc;

  // v2.0: check config
  try {
    const client = new SparqlClient(loadConfig());
    if (await checkConfigExists(client)) return 0;
    if (await detectLegacyCodebase(client)) {
      await writeLegacyConfig(client);
      console.log(`predicate up: legacy codebase ontology detected — wrote 'community/codebase' config.`);
      return 0;
    }
    if (process.stdin.isTTY) {
      return init([]);
    }
    console.error('predicate up: no init config and non-TTY stdin; defaulting to empty mode.');
    return init(['--mode', 'empty']);
  } catch (err) {
    console.error(`predicate up: post-bootstrap init check failed: ${(err as Error).message}`);
    return 0;  // Fuseki is up; init failure is non-fatal
  }
}
