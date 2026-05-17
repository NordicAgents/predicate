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
import { peer } from './commands/peer.js';
import { exportSessions } from './commands/export-sessions.js';
import { importSessions } from './commands/import-sessions.js';
import { ld } from './commands/ld.js';

const VERSION = '1.0.0';

function help(): void {
  console.log(`predicate <command>

Commands:
  up                Bring Fuseki up (docker compose up -d) and load the seed TBox.
  down              Stop Fuseki, preserve the data volume.
  doctor            Health checks: docker, fuseki, tbox.
  stats             Print kg_stats output for the live graph.
  sessionstart      Print a one-line KG status banner (used by hook scripts).
  maintain          Run kg_maintain (reaper + generalizer + sweeper).
  capture           Record a tool invocation in kg:usage (opt-in via PREDICATE_RAW_CAPTURE).
  extract           Read a Stop-hook payload from stdin and extract typed triples into kg:abox.
  sessions          List recent extracted sessions (modifiedFiles / succeeded / failed counts).
  captures          List raw kg:usage ToolCall captures (opt-in raw-capture path).
  recall            Substring search over session history (files + commands).
  dashboard         Serve a localhost web view of session-history + reasoning output.
  peer              Manage federation peers (add / list / remove).
  export-sessions   Export local session-history triples as TriG to stdout.
  import-sessions   Import a teammate's TriG export into local Fuseki.
  ld                Linked-Data federation (DBpedia / Wikidata): init / list / ask.
  --version         Print the predicate version.
  --help            This message.

Env:
  FUSEKI_URL                http://localhost:3030 (default)
  PREDICATE_DATASET         predicate (default)
  PREDICATE_ADMIN_USER      admin (default)
  PREDICATE_ADMIN_PASSWORD  changeme (default)
  PREDICATE_COMPOSE_DIR     override docker-compose.yml location
  PREDICATE_RAW_CAPTURE     "1" enables raw kg_capture writes (default off)
  PREDICATE_CAPTURE_SKIP    when raw capture is on, comma list of tools to skip
  PREDICATE_CAPTURE_TRUNCATE  max chars per captured input/output (default 500)
`);
}

async function main(): Promise<number> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'up':              return up();
    case 'down':            return down();
    case 'doctor':          return doctor();
    case 'stats':           return stats();
    case 'sessionstart':    return sessionstart();
    case 'maintain':        return maintain();
    case 'capture':         return capture(process.argv.slice(3));
    case 'extract':         return extract(process.argv.slice(3));
    case 'sessions':        return sessions(process.argv.slice(3));
    case 'captures':        return captures(process.argv.slice(3));
    case 'recall':          return recall(process.argv.slice(3));
    case 'dashboard':       return dashboard(process.argv.slice(3));
    case 'peer':            return peer(process.argv.slice(3));
    case 'export-sessions': return exportSessions(process.argv.slice(3));
    case 'import-sessions': return importSessions(process.argv.slice(3));
    case 'ld':              return ld(process.argv.slice(3));
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

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
