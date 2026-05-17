import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';

const META = 'https://predicate.dev/meta#';
const CONFIG_URI = 'urn:predicate:config';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface CatalogEntry { name: string; description: string; license: string; files: string[]; shapes?: string }
interface Catalog { version: string; ontologies: CatalogEntry[] }

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}
function hasFlag(args: string[], name: string): boolean { return args.includes(name); }

function findCatalogDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Monorepo source layout (packages/predicate-cli/src/commands/ -> packages/predicate-ontology/catalog)
    join(here, '..', '..', '..', 'predicate-ontology', 'catalog'),
    // Bundled-skill layout (packages/predicate-skill/cli.bundle.mjs -> packages/predicate-ontology/catalog)
    join(here, '..', 'predicate-ontology', 'catalog'),
    // Other fallbacks
    join(here, '..', '..', 'predicate-ontology', 'catalog'),
    join(here, 'predicate-ontology', 'catalog'),
  ];
  for (const c of candidates) if (existsSync(join(c, 'catalog.json'))) return c;
  throw new Error(`catalog directory not found — checked ${candidates.join(', ')}`);
}

function findMetaTtl(catalogDir: string): string {
  // predicate-meta.ttl lives at predicate-ontology/meta/, sibling to catalog/
  return join(catalogDir, '..', 'meta', 'predicate-meta.ttl');
}

function help(): void {
  console.log(`predicate init [--mode community|upload|empty] [--ontology NAME] [--file PATH] [--force]

Initialize the Predicate knowledge graph with a chosen TBox.

Modes:
  community  Install one of the bundled ontologies (see catalog).
             Sub-option: --ontology NAME (top, codebase, foaf, schema-org-lite, fhir-core).
  upload     Load a user-supplied .ttl file.
             Sub-option: --file PATH (max 10 MB; cannot use the pred: namespace).
  empty      Load meta vocab + minimal top ontology (Thing, dependsOn, relatedTo).

Other options:
  --force    Wipe existing config + kg:tbox + abox/inferred/provenance/goals/usage
             and re-init. Required if already initialized.
  --help     Print this message.

Without flags + with TTY: runs an interactive prompt.

Examples:
  predicate init --mode community --ontology codebase
  predicate init --mode upload --file ./my-domain.ttl
  predicate init --mode empty
`);
}

async function checkConfigExists(client: SparqlClient): Promise<boolean> {
  return client.ask(`
    PREFIX pred: <${META}>
    ASK { GRAPH <kg:meta> { <${CONFIG_URI}> a pred:Config } }
  `);
}

async function loadTtlFile(client: SparqlClient, path: string): Promise<void> {
  const cfg = loadConfig();
  const turtle = readFileSync(path, 'utf8');
  const auth = 'Basic ' + Buffer.from(`admin:${process.env['PREDICATE_ADMIN_PASSWORD'] ?? 'changeme'}`).toString('base64');
  const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', 'Authorization': auth },
    body: turtle,
  });
  if (!r.ok) throw new Error(`Fuseki load failed for ${path}: ${r.status} ${await r.text()}`);
  void client;
}

async function destructiveReset(client: SparqlClient): Promise<void> {
  for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage', 'kg:meta']) {
    await client.update(`DROP SILENT GRAPH <${g}>`);
    await client.update(`CREATE SILENT GRAPH <${g}>`);
  }
}

async function writeConfig(
  client: SparqlClient,
  mode: 'community' | 'upload' | 'empty',
  ontology: string,
): Promise<void> {
  const now = new Date().toISOString();
  await client.update(`
    PREFIX pred: <${META}>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:meta> {
      <${CONFIG_URI}> a pred:Config ;
        pred:initMode             ${escapeLiteral(mode)} ;
        pred:initOntology         ${escapeLiteral(ontology)} ;
        pred:schemaLearningEnabled "true"^^xsd:boolean ;
        pred:initializedAt        "${now}"^^xsd:dateTime .
    } }
  `);
}

function validateUserUpload(turtle: string): { ok: boolean; error?: string } {
  // Reject any usage of the pred: namespace
  if (/https?:\/\/predicate\.dev\/meta#/.test(turtle)) {
    return { ok: false, error: `Uploaded ontology uses the reserved 'pred:' namespace (https://predicate.dev/meta#). Rename or remove those triples.` };
  }
  return { ok: true };
}

async function doCommunity(client: SparqlClient, ontologyName: string): Promise<number> {
  const catalogDir = findCatalogDir();
  const catalog: Catalog = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8'));
  const entry = catalog.ontologies.find((o) => o.name === ontologyName);
  if (!entry) {
    console.error(`predicate init: unknown ontology '${ontologyName}'. Available: ${catalog.ontologies.map((o) => o.name).join(', ')}`);
    return 2;
  }
  await loadTtlFile(client, findMetaTtl(catalogDir));
  for (const f of entry.files) await loadTtlFile(client, join(catalogDir, f));
  if (entry.shapes) await loadTtlFile(client, join(catalogDir, entry.shapes));
  await writeConfig(client, 'community', ontologyName);
  console.log(`predicate init: ${ontologyName} ontology loaded (${entry.description}, license: ${entry.license}).`);
  return 0;
}

async function doUpload(client: SparqlClient, filePath: string): Promise<number> {
  const abs = resolve(filePath);
  if (!existsSync(abs)) {
    console.error(`predicate init: file not found: ${abs}`);
    return 1;
  }
  const sz = statSync(abs).size;
  if (sz > MAX_UPLOAD_BYTES) {
    console.error(`predicate init: file too large (${sz} bytes; max ${MAX_UPLOAD_BYTES})`);
    return 1;
  }
  const turtle = readFileSync(abs, 'utf8');
  const v = validateUserUpload(turtle);
  if (!v.ok) {
    console.error(`predicate init: ${v.error}`);
    return 1;
  }
  const catalogDir = findCatalogDir();
  await loadTtlFile(client, findMetaTtl(catalogDir));
  try {
    await loadTtlFile(client, abs);
  } catch (err) {
    // Roll back to meta-only state
    await client.update(`DROP SILENT GRAPH <kg:tbox>`);
    await client.update(`CREATE SILENT GRAPH <kg:tbox>`);
    await loadTtlFile(client, findMetaTtl(catalogDir));
    console.error(`predicate init: upload failed during load: ${(err as Error).message}. kg:tbox rolled back to meta-only.`);
    return 1;
  }
  await writeConfig(client, 'upload', 'user');
  console.log(`predicate init: uploaded ${abs} (${sz} bytes). Schema-learning enabled.`);
  return 0;
}

async function doEmpty(client: SparqlClient): Promise<number> {
  const catalogDir = findCatalogDir();
  await loadTtlFile(client, findMetaTtl(catalogDir));
  await loadTtlFile(client, join(catalogDir, 'top.ttl'));
  await writeConfig(client, 'empty', 'top');
  console.log(`predicate init: empty mode (meta + top vocabulary loaded). The agent will propose new predicates as needed; sweeper promotes after 3 uses.`);
  return 0;
}

async function interactive(client: SparqlClient): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`Welcome to Predicate. Choose how to initialize the knowledge graph:

  (1) Install a community ontology  — pick one of our bundled vocabularies
  (2) Upload your own ontology      — load a custom .ttl file
  (3) Start empty                   — meta vocab only, agent grows the rest
`);
    const choice = (await rl.question('Your choice [1/2/3]: ')).trim();
    if (choice === '1') {
      const catalogDir = findCatalogDir();
      const catalog: Catalog = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8'));
      console.log('\nAvailable ontologies:');
      for (const o of catalog.ontologies) console.log(`  - ${o.name.padEnd(18)} ${o.description}`);
      const name = (await rl.question('\nWhich ontology? ')).trim();
      return doCommunity(client, name);
    }
    if (choice === '2') {
      const path = (await rl.question('Path to .ttl file: ')).trim();
      return doUpload(client, path);
    }
    if (choice === '3') {
      return doEmpty(client);
    }
    console.error(`predicate init: invalid choice '${choice}'. Run with --help for non-interactive flags.`);
    return 2;
  } finally {
    rl.close();
  }
}

export async function init(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const client = new SparqlClient(loadConfig());

  // Force-reset path
  if (hasFlag(args, '--force')) {
    await destructiveReset(client);
  } else if (await checkConfigExists(client)) {
    const cfg = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?m ?o WHERE { GRAPH <kg:meta> {
        <${CONFIG_URI}> pred:initMode ?m ; pred:initOntology ?o .
      } }
    `);
    const b = cfg.results.bindings[0];
    const mode = b?.m?.value ?? '?';
    const ont = b?.o?.value ?? '?';
    console.error(`predicate init: already initialized as '${mode}/${ont}'. Use --force to reset (destructive). Or kg_config_set to toggle individual fields.`);
    return 2;
  }

  const mode = parseFlag(args, '--mode');
  if (!mode) {
    if (process.stdin.isTTY) return interactive(client);
    console.error(`predicate init: --mode is required when stdin is not a TTY. Run with --help.`);
    return 2;
  }
  if (mode === 'community') {
    const ontology = parseFlag(args, '--ontology') ?? 'codebase';
    return doCommunity(client, ontology);
  }
  if (mode === 'upload') {
    const file = parseFlag(args, '--file');
    if (!file) { console.error(`predicate init: --mode upload requires --file PATH`); return 2; }
    return doUpload(client, file);
  }
  if (mode === 'empty') {
    return doEmpty(client);
  }
  console.error(`predicate init: invalid --mode '${mode}'. Must be one of: community, upload, empty.`);
  return 2;
}
