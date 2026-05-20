import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { bootstrapGraphs } from 'predicate-server/src/index.js';

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
    // Bundled-alongside-CLI layout (predicate-skill global install).
    join(here, 'catalog'),
    // Monorepo / source-tree layouts.
    join(here, '..', '..', '..', 'predicate-ontology', 'catalog'),
    join(here, '..', 'predicate-ontology', 'catalog'),
    join(here, '..', '..', 'predicate-ontology', 'catalog'),
    join(here, 'predicate-ontology', 'catalog'),
  ];
  for (const c of candidates) if (existsSync(join(c, 'catalog.json'))) return c;
  throw new Error(`catalog directory not found — checked ${candidates.join(', ')}`);
}

function findMetaTtl(catalogDir: string): string {
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

async function checkConfigExists(client: StorageAdapter): Promise<boolean> {
  return client.ask(`
    PREFIX pred: <${META}>
    ASK { GRAPH <kg:meta> { <${CONFIG_URI}> a pred:Config } }
  `);
}

async function loadTtlFile(client: StorageAdapter, path: string): Promise<void> {
  const turtle = readFileSync(path, 'utf8');
  await client.loadTurtle(turtle, 'kg:tbox');
}

// The judgment layer is core vocabulary, loaded regardless of seed mode.
async function loadJudgmentOverlay(client: StorageAdapter, catalogDir: string): Promise<void> {
  await loadTtlFile(client, join(catalogDir, 'judgment.ttl'));
  await loadTtlFile(client, join(catalogDir, 'judgment.shacl.ttl'));
}

// v2.0.1: always wipes kg:tbox + kg:tbox-staging + kg:meta so init is idempotent
// against TBox residue from a half-migrated v1.13 install or earlier test pollution.
// When `force=true` also wipes the ABox-side graphs (caller has accepted destruction).
async function wipeForInit(client: StorageAdapter, force: boolean): Promise<void> {
  const tboxGraphs = ['kg:tbox', 'kg:tbox-staging', 'kg:meta'];
  const aboxGraphs = ['kg:abox', 'kg:inferred', 'kg:provenance', 'kg:goals', 'kg:usage'];
  const toWipe = force ? [...tboxGraphs, ...aboxGraphs] : tboxGraphs;
  for (const g of toWipe) await client.clearGraph(g);
}

async function writeConfig(
  client: StorageAdapter,
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
  if (/https?:\/\/predicate\.dev\/meta#/.test(turtle)) {
    return { ok: false, error: `Uploaded ontology uses the reserved 'pred:' namespace (https://predicate.dev/meta#). Rename or remove those triples.` };
  }
  return { ok: true };
}

// --- Pre-flight: prepare a plan, do all I/O-cheap validation up front.
// Returns either a `Plan` describing what to load, or an exit code if invalid.

type Plan =
  | { kind: 'community'; entry: CatalogEntry; catalogDir: string }
  | { kind: 'upload'; abs: string; turtle: string; size: number; catalogDir: string }
  | { kind: 'empty'; catalogDir: string };

interface PlanError { exitCode: number }

async function buildPlanCommunity(ontology: string): Promise<Plan | PlanError> {
  const catalogDir = findCatalogDir();
  const catalog: Catalog = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8'));
  const entry = catalog.ontologies.find((o) => o.name === ontology);
  if (!entry) {
    console.error(`predicate init: unknown ontology '${ontology}'. Available: ${catalog.ontologies.map((o) => o.name).join(', ')}`);
    return { exitCode: 2 };
  }
  return { kind: 'community', entry, catalogDir };
}

async function buildPlanUpload(filePath: string): Promise<Plan | PlanError> {
  const abs = resolve(filePath);
  if (!existsSync(abs)) {
    console.error(`predicate init: file not found: ${abs}`);
    return { exitCode: 1 };
  }
  const sz = statSync(abs).size;
  if (sz > MAX_UPLOAD_BYTES) {
    console.error(`predicate init: file too large (${sz} bytes; max ${MAX_UPLOAD_BYTES})`);
    return { exitCode: 1 };
  }
  const turtle = readFileSync(abs, 'utf8');
  const v = validateUserUpload(turtle);
  if (!v.ok) {
    console.error(`predicate init: ${v.error}`);
    return { exitCode: 1 };
  }
  const catalogDir = findCatalogDir();
  return { kind: 'upload', abs, turtle, size: sz, catalogDir };
}

function buildPlanEmpty(): Plan {
  return { kind: 'empty', catalogDir: findCatalogDir() };
}

// --- Apply: do the destructive write. Only called after a Plan is valid.

async function applyPlan(client: StorageAdapter, plan: Plan, force: boolean): Promise<number> {
  await wipeForInit(client, force);
  await loadTtlFile(client, findMetaTtl(plan.catalogDir));
  await loadJudgmentOverlay(client, plan.catalogDir);

  if (plan.kind === 'community') {
    for (const f of plan.entry.files) await loadTtlFile(client, join(plan.catalogDir, f));
    if (plan.entry.shapes) await loadTtlFile(client, join(plan.catalogDir, plan.entry.shapes));
    await writeConfig(client, 'community', plan.entry.name);
    console.log(`predicate init: ${plan.entry.name} ontology loaded (${plan.entry.description}, license: ${plan.entry.license}).`);
    return 0;
  }
  if (plan.kind === 'upload') {
    try {
      await loadTtlFile(client, plan.abs);
    } catch (err) {
      // Fuseki rejected the file at load time (malformed turtle, etc.). Roll
      // back to meta-only so the user isn't left in a broken state.
      await client.clearGraph('kg:tbox');
      await loadTtlFile(client, findMetaTtl(plan.catalogDir));
      console.error(`predicate init: upload failed during load: ${(err as Error).message}. kg:tbox rolled back to meta-only.`);
      return 1;
    }
    await writeConfig(client, 'upload', 'user');
    console.log(`predicate init: uploaded ${plan.abs} (${plan.size} bytes). Schema-learning enabled.`);
    return 0;
  }
  // empty
  await loadTtlFile(client, join(plan.catalogDir, 'top.ttl'));
  await writeConfig(client, 'empty', 'top');
  console.log(`predicate init: empty mode (meta + top vocabulary loaded). The agent will propose new predicates as needed; sweeper promotes after 3 uses.`);
  return 0;
}

function isPlanError(p: Plan | PlanError): p is PlanError {
  return 'exitCode' in p;
}

async function interactive(client: StorageAdapter, force: boolean): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`Welcome to Predicate. Choose how to initialize the knowledge graph:

  (1) Install a community ontology  — pick one of our bundled vocabularies
  (2) Upload your own ontology      — load a custom .ttl file
  (3) Start empty                   — meta vocab only, agent grows the rest
`);
    const choice = (await rl.question('Your choice [1/2/3]: ')).trim();
    let plan: Plan | PlanError;
    if (choice === '1') {
      const catalogDir = findCatalogDir();
      const catalog: Catalog = JSON.parse(readFileSync(join(catalogDir, 'catalog.json'), 'utf8'));
      console.log('\nAvailable ontologies:');
      for (const o of catalog.ontologies) console.log(`  - ${o.name.padEnd(18)} ${o.description}`);
      const name = (await rl.question('\nWhich ontology? ')).trim();
      plan = await buildPlanCommunity(name);
    } else if (choice === '2') {
      const path = (await rl.question('Path to .ttl file: ')).trim();
      plan = await buildPlanUpload(path);
    } else if (choice === '3') {
      plan = buildPlanEmpty();
    } else {
      console.error(`predicate init: invalid choice '${choice}'. Run with --help for non-interactive flags.`);
      return 2;
    }
    if (isPlanError(plan)) return plan.exitCode;
    return applyPlan(client, plan, force);
  } finally {
    rl.close();
  }
}

export async function init(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const client = getAdapter();
  await bootstrapGraphs(client);
  const force = hasFlag(args, '--force');

  // Refusal check FIRST: refuse if config exists and no --force.
  if (!force && await checkConfigExists(client)) {
    const cfg = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?m ?o WHERE { GRAPH <kg:meta> {
        <${CONFIG_URI}> pred:initMode ?m ; pred:initOntology ?o .
      } }
    `);
    const b = cfg.results.bindings[0];
    const mode = b?.m?.value ?? '?';
    const ont = b?.o?.value ?? '?';
    console.error(`predicate init: already initialized as '${mode}/${ont}'. Use --force to reset (destructive). Or 'predicate config set' to toggle individual fields.`);
    return 2;
  }

  const mode = parseFlag(args, '--mode');
  if (!mode) {
    if (process.stdin.isTTY) return interactive(client, force);
    console.error(`predicate init: --mode is required when stdin is not a TTY. Run with --help.`);
    return 2;
  }

  // v2.0.1: VALIDATE the plan BEFORE any destructive write.
  let plan: Plan | PlanError;
  if (mode === 'community') {
    const ontology = parseFlag(args, '--ontology') ?? 'codebase';
    plan = await buildPlanCommunity(ontology);
  } else if (mode === 'upload') {
    const file = parseFlag(args, '--file');
    if (!file) { console.error(`predicate init: --mode upload requires --file PATH`); return 2; }
    plan = await buildPlanUpload(file);
  } else if (mode === 'empty') {
    plan = buildPlanEmpty();
  } else {
    console.error(`predicate init: invalid --mode '${mode}'. Must be one of: community, upload, empty.`);
    return 2;
  }

  if (isPlanError(plan)) return plan.exitCode;
  return applyPlan(client, plan, force);
}
