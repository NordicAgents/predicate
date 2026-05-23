#!/usr/bin/env node
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { doctor } from './commands/doctor.js';
import { stats } from './commands/stats.js';
import { sessionstart } from './commands/sessionstart.js';
import { maintain } from './commands/maintain.js';
import { capture } from './commands/capture.js';
import { extract } from './commands/extract.js';
import { sessions } from './commands/sessions.js';
import { captures } from './commands/captures.js';
import { recall } from './commands/recall.js';
import { dashboard } from './commands/dashboard.js';
import { init } from './commands/init.js';
import { schema } from './commands/schema.js';
import { config } from './commands/config.js';
import { migrate } from './commands/migrate.js';
import { install } from './commands/install.js';
import { shadowReport } from './commands/shadow-report.js';

// Injected at bundle time from predicate-skill's package.json (see
// scripts/bundle.mjs). Falls back to '0.0.0-dev' when run unbundled.
declare const __PREDICATE_VERSION__: string | undefined;
const VERSION = typeof __PREDICATE_VERSION__ === 'string' ? __PREDICATE_VERSION__ : '0.0.0-dev';

function help(): void {
  console.log(`predicate <command>

Commands:
  up                Open the Oxigraph store and load the seed TBox.
                    Default store: reuse an existing .predicate/store from a
                    parent dir; else <git-root>/.predicate/store inside a repo
                    (auto-gitignored); else ~/.predicate/projects/<hash>/store.
                    --scope local|project|user   force a specific store
                       local   = ./.predicate/store (current dir)
                       project = <git-root>/.predicate/store
                       user    = the global ~/.predicate/store (shared)
                    --if-needed                  no-op if the graph is already initialised
  init              Initialize kg:tbox with a community ontology, an uploaded file, or empty.
  down              Stop the oxigraph daemon (or Fuseki), preserving data.
                    --all   sweep all home-registered oxigraph daemons
  doctor            Health checks: docker, fuseki, tbox.
  stats             Print kg_stats output for the live graph.
  sessionstart      Print a one-line KG status banner (used by hook scripts).
  maintain          Run kg_maintain (reaper + generalizer + sweeper).
  shadow-report     Roll up GateShadow counterfactual events into a per-(N,TTL) promote/wait/expire tally.
  capture           Record a tool invocation in kg:usage (opt-in via PREDICATE_RAW_CAPTURE).
  extract           Read a Stop-hook payload from stdin and extract typed triples into kg:abox.
  sessions          List recent extracted sessions (modifiedFiles / succeeded / failed counts).
  captures          List raw kg:usage ToolCall captures (opt-in raw-capture path).
  recall            Substring search over session history (files + commands).
  dashboard         Serve a localhost web view of session-history + reasoning output.
  schema            List / approve / reject pending kg:tbox-staging proposals.
  config            Get/set runtime config (schema-learning toggle, init keys).
  migrate           Migrate data: --from fuseki --to oxigraph.
  install           Write MCP config + AGENTS.md for an MCP-only host: install <vscode|cursor>.
  --version         Print the predicate version.
  --help            This message.

Env:
  PREDICATE_BACKEND         oxigraph (default) | fuseki
  PREDICATE_STORE_PATH      explicit Oxigraph store path (overrides scope resolution)
  FUSEKI_URL                http://localhost:3030 (only used when PREDICATE_BACKEND=fuseki)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
  PREDICATE_RAW_CAPTURE     "1" enables raw kg_capture writes (default off)
  PREDICATE_CAPTURE_SKIP    when raw capture is on, comma list of tools to skip
  PREDICATE_CAPTURE_TRUNCATE  max chars per captured input/output (default 500)
  PREDICATE_CLI_BIN         override the binary spawned by \`predicate dashboard\` actions
  PREDICATE_CLI_ARGS        extra leading args for that binary (space-separated)
  PREDICATE_PROMOTED_DIR    override the path PromotionSweeper writes promoted TBox Turtle into
`);
}

async function main(): Promise<number> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'up':              return up(process.argv.slice(3));
    case 'down':            return down(process.argv.slice(3));
    case 'doctor':          return doctor(process.argv.slice(3));
    case 'stats':           return stats();
    case 'sessionstart':    return sessionstart();
    case 'maintain':        return maintain();
    case 'shadow-report':   return shadowReport();
    case 'capture':         return capture(process.argv.slice(3));
    case 'extract':         return extract(process.argv.slice(3));
    case 'sessions':        return sessions(process.argv.slice(3));
    case 'captures':        return captures(process.argv.slice(3));
    case 'recall':          return recall(process.argv.slice(3));
    case 'dashboard':       return dashboard(process.argv.slice(3));
    case 'schema':          return schema(process.argv.slice(3));
    case 'config':          return config(process.argv.slice(3));
    case 'init':            return init(process.argv.slice(3));
    case 'migrate':         return migrate(process.argv.slice(3));
    case 'install':         return install(process.argv.slice(3));
    case '--version':
    case 'version':      console.log(VERSION); return 0;
    case undefined:
    case '--help':
    case 'help':         help(); return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      help();
      return 2;
  }
}

// Flush any in-flight debounced writes (e.g. OxigraphAdapter's 300ms timer)
// before the process exits. We only close if an adapter was actually opened
// during this run; getCachedAdapter() never constructs one.
async function flushAdapter(): Promise<void> {
  const { getCachedAdapter } = await import('predicate-mcp/src/storage/factory.js');
  const adapter = getCachedAdapter();
  if (adapter) {
    try { await adapter.close(); } catch { /* best effort */ }
  }
}

main()
  .then(async (code) => {
    await flushAdapter();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err);
    await flushAdapter();
    process.exit(1);
  });
