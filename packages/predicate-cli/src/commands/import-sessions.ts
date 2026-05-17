import { readFileSync } from 'node:fs';
import { loadConfig } from 'predicate-mcp/src/config.js';

function help(): void {
  console.log(`predicate import-sessions <file.trig>

Load a TriG-formatted peer export into local Fuseki. Each named graph
in the TriG is created in the local store as-is (it does NOT overwrite
kg:abox). Use \`kg_ask --include-remote\` to query unioned data
across local + imported peer graphs.

Options:
  --help    Print this message.
`);
}

function authHeader(): string {
  const user = process.env['PREDICATE_ADMIN_USER'] ?? 'admin';
  const pass = process.env['PREDICATE_ADMIN_PASSWORD'] ?? 'changeme';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function importSessions(args: string[]): Promise<number> {
  if (args.length === 0 || args[0] === '--help') { help(); return args.length === 0 ? 2 : 0; }
  const file = args[0]!;
  let trig: string;
  try { trig = readFileSync(file, 'utf8'); }
  catch (err) { console.error(`predicate import-sessions: failed to read ${file}: ${(err as Error).message}`); return 1; }

  const cfg = loadConfig();
  try {
    const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/trig',
        'Authorization': authHeader(),
      },
      body: trig,
    });
    if (!r.ok) {
      console.error(`predicate import-sessions: Fuseki rejected (${r.status}): ${await r.text()}`);
      return 1;
    }
    console.log(`predicate import-sessions: loaded ${trig.length} bytes from ${file}`);
    return 0;
  } catch (err) {
    console.error(`predicate import-sessions failed: ${(err as Error).message}`);
    return 1;
  }
}
