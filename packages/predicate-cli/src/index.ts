#!/usr/bin/env node
import { up } from './commands/up.js';
import { down } from './commands/down.js';
import { doctor } from './commands/doctor.js';
import { stats } from './commands/stats.js';

const VERSION = '1.0.0';

function help(): void {
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

async function main(): Promise<number> {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'up':        return up();
    case 'down':      return down();
    case 'doctor':    return doctor();
    case 'stats':     return stats();
    case '--version':
    case 'version':   console.log(VERSION); return 0;
    case undefined:
    case '--help':
    case 'help':      help(); return 0;
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
