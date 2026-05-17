#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);


// ../predicate-cli/src/docker.ts
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
function findComposeDir() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.PREDICATE_COMPOSE_DIR,
    resolve(here, "compose"),
    resolve(here, "..", "compose"),
    resolve(here, "..", "..", "predicate-skill", "compose"),
    resolve(here, "..", "..", "..", "predicate-skill", "compose"),
    resolve(here, "..", "..", "..", "predicate-server")
  ].filter((p) => Boolean(p));
  for (const c of candidates) {
    if (c && existsSync(resolve(c, "docker-compose.yml"))) return c;
  }
  throw new Error(
    `Could not locate docker-compose.yml. Set PREDICATE_COMPOSE_DIR to the directory containing it, or run from the predicate repo root. Searched: ${candidates.join(", ")}`
  );
}
function dockerAvailable() {
  try {
    execSync("docker version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function compose(args, cwd) {
  const r = spawnSync("docker", ["compose", ...args], { cwd, stdio: "inherit" });
  return r.status ?? 1;
}

// ../predicate-cli/src/commands/up.ts
async function up() {
  if (!dockerAvailable()) {
    console.error("Docker not found. Install Docker Desktop or Docker Engine first.");
    return 2;
  }
  const dir = findComposeDir();
  console.log(`bringing Fuseki up from ${dir}`);
  return compose(["up", "-d"], dir);
}

// ../predicate-cli/src/commands/down.ts
async function down() {
  if (!dockerAvailable()) {
    console.error("Docker not found.");
    return 2;
  }
  const dir = findComposeDir();
  return compose(["down"], dir);
}

// ../predicate-mcp/src/sparql/client.ts
function err(status, body) {
  const e = new Error(`SPARQL error ${status}: ${body}`);
  e.status = status;
  e.body = body;
  return e;
}
function authHeader() {
  const user = process.env.PREDICATE_ADMIN_USER ?? "admin";
  const pass = process.env.PREDICATE_ADMIN_PASSWORD ?? "changeme";
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}
var SparqlClient = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  cfg;
  async select(query) {
    const res = await fetch(this.cfg.queryEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json",
        "Authorization": authHeader()
      },
      body: query
    });
    if (!res.ok) throw err(res.status, await res.text());
    return await res.json();
  }
  async ask(query) {
    const res = await fetch(this.cfg.queryEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        "Accept": "application/sparql-results+json",
        "Authorization": authHeader()
      },
      body: query
    });
    if (!res.ok) throw err(res.status, await res.text());
    const json = await res.json();
    return json.boolean;
  }
  async update(query) {
    const res = await fetch(this.cfg.updateEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-update",
        "Authorization": authHeader()
      },
      body: query
    });
    if (!res.ok) throw err(res.status, await res.text());
  }
  async knownGraphs() {
    const r = await this.select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } FILTER(STRSTARTS(STR(?g), "kg:")) }'
    );
    return r.results.bindings.map((b) => b.g.value);
  }
};

// ../predicate-mcp/src/config.ts
function loadConfig() {
  const raw = process.env.FUSEKI_URL ?? "http://localhost:3030";
  const fusekiUrl = raw.replace(/\/+$/, "");
  const dataset = process.env.PREDICATE_DATASET ?? "predicate";
  return {
    fusekiUrl,
    dataset,
    queryEndpoint: `${fusekiUrl}/${dataset}/query`,
    updateEndpoint: `${fusekiUrl}/${dataset}/update`,
    dataEndpoint: `${fusekiUrl}/${dataset}/data`
  };
}

// ../predicate-cli/src/commands/doctor.ts
async function doctor() {
  const cfg = loadConfig();
  const checks = [];
  checks.push({
    name: "docker installed",
    ok: dockerAvailable(),
    detail: dockerAvailable() ? "" : "install Docker Desktop"
  });
  const ping = await fetch(`${cfg.fusekiUrl}/$/ping`).catch(() => null);
  checks.push({
    name: "fuseki reachable",
    ok: Boolean(ping?.ok),
    detail: ping?.ok ? cfg.fusekiUrl : `not reachable at ${cfg.fusekiUrl} \u2014 try 'predicate up'`
  });
  if (ping?.ok) {
    const client = new SparqlClient(cfg);
    const tboxOk = await client.ask(`
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { ?c a owl:Class } }
    `).catch(() => false);
    checks.push({
      name: "kg:tbox loaded",
      ok: tboxOk,
      detail: tboxOk ? "" : "no classes found \u2014 try 'predicate up' (re-runs bootstrap)"
    });
  }
  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) {
    const mark = c.ok ? "[x]" : "[ ]";
    const name = c.name.padEnd(width);
    const detail = c.detail ? `  \u2014 ${c.detail}` : "";
    console.log(`${mark} ${name}${detail}`);
  }
  return checks.every((c) => c.ok) ? 0 : 1;
}

// ../predicate-mcp/src/tools/kg-stats.ts
async function countGraph(client, graph) {
  const r = await client.select(
    `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${graph}> { ?s ?p ?o } }`
  );
  return parseInt(r.results.bindings[0].n.value, 10);
}
async function countClasses(client) {
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
    }
  `);
  return parseInt(r.results.bindings[0].n.value, 10);
}
async function unusedConceptRatio(client, classCount) {
  if (classCount === 0) return 0;
  const r = await client.select(`
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    SELECT (COUNT(DISTINCT ?c) AS ?n) WHERE {
      GRAPH <kg:tbox> { ?c a owl:Class }
      FILTER NOT EXISTS {
        { GRAPH <kg:abox>     { ?x rdf:type ?c } }
        UNION
        { GRAPH <kg:inferred> { ?x rdf:type ?c } }
      }
    }
  `);
  const unused = parseInt(r.results.bindings[0].n.value, 10);
  return unused / classCount;
}
async function materializationLatencyP95(client) {
  const r = await client.select(`
    PREFIX pred: <https://predicate.dev/meta#>
    SELECT ?payload WHERE {
      GRAPH <kg:meta> {
        ?e a pred:MaterializationCompleted ;
           pred:payload ?payload .
      }
    }
  `);
  const values = r.results.bindings.map((b) => {
    const raw = b.payload?.value ?? "";
    const m = raw.match(/"elapsedMs"\s*:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }).filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const idx = Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1);
  return values[Math.max(idx, 0)];
}
async function kgStats(client) {
  const [abox, inferred, tbox] = await Promise.all([
    countGraph(client, "kg:abox"),
    countGraph(client, "kg:inferred"),
    countGraph(client, "kg:tbox")
  ]);
  const classes = await countClasses(client);
  const triples = abox + inferred + tbox;
  const denom = abox + inferred;
  const inferredRatio = denom === 0 ? 0 : inferred / denom;
  const unused = await unusedConceptRatio(client, classes);
  const p95 = await materializationLatencyP95(client);
  return {
    triples,
    abox,
    inferred,
    tbox,
    classes,
    inferredRatio,
    unusedConceptRatio: unused,
    materializationLatencyMsP95: p95
  };
}

// ../predicate-cli/src/commands/stats.ts
async function stats() {
  const client = new SparqlClient(loadConfig());
  const s = await kgStats(client);
  const rows = [
    ["triples", s.triples],
    ["abox", s.abox],
    ["inferred", s.inferred],
    ["tbox", s.tbox],
    ["classes", s.classes],
    ["inferredRatio", s.inferredRatio.toFixed(3)],
    ["unusedConceptRatio", s.unusedConceptRatio.toFixed(3)],
    ["materializationLatencyMsP95", s.materializationLatencyMsP95]
  ];
  const width = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) {
    console.log(`${k.padEnd(width)}  ${v}`);
  }
  return 0;
}

// ../predicate-cli/src/index.ts
var VERSION = "1.0.0";
function help() {
  console.log(`predicate <command>

Commands:
  up           Bring Fuseki up (docker compose up -d) and load the seed TBox.
  down         Stop Fuseki, preserve the data volume.
  doctor       Health checks: docker, fuseki, tbox.
  stats        Print kg_stats output for the live graph.
  --version    Print the predicate version.
  --help       This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
`);
}
async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case "up":
      return up();
    case "down":
      return down();
    case "doctor":
      return doctor();
    case "stats":
      return stats();
    case "--version":
    case "version":
      console.log(VERSION);
      return 0;
    case void 0:
    case "--help":
    case "help":
      help();
      return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      return 2;
  }
}
main().then((code) => process.exit(code)).catch((err2) => {
  console.error(err2);
  process.exit(1);
});
