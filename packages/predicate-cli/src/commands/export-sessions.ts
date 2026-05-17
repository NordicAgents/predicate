import { loadConfig } from 'predicate-mcp/src/config.js';

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 || i + 1 >= args.length ? undefined : args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate export-sessions [--since DATE] [--user NAME] > out.trig

Export local kg:abox session-history triples as TriG (one named graph
containing all triples for sessions started after --since).

Options:
  --since DATE   ISO 8601 datetime cutoff (default: 7 days ago).
  --user NAME    Tag the export graph name with this user identifier
                 (default: \$USER env var).
  --help         Print this message.

Example:
  predicate export-sessions --since 2026-05-10 --user alice > alice.trig
  # send alice.trig to teammate; they run:
  predicate import-sessions alice.trig
`);
}

function authHeader(): string {
  const user = process.env['PREDICATE_ADMIN_USER'] ?? 'admin';
  const pass = process.env['PREDICATE_ADMIN_PASSWORD'] ?? 'changeme';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function exportSessions(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const cfg = loadConfig();
  const since = parseFlag(args, '--since') ?? new Date(Date.now() - 7 * 86400_000).toISOString();
  const user = parseFlag(args, '--user') ?? process.env['USER'] ?? 'anonymous';
  const exportGraph = `urn:predicate:export:${encodeURIComponent(user)}:${new Date().toISOString()}`;

  const query = `
    PREFIX pred: <https://predicate.dev/meta#>
    CONSTRUCT { ?s ?p ?o }
    WHERE {
      GRAPH <kg:abox> {
        ?session a pred:Session ; pred:at ?at .
        FILTER (?at >= "${since}"^^<http://www.w3.org/2001/XMLSchema#dateTime>)
        ?s ?p ?o .
        FILTER (?s = ?session ||
                EXISTS { ?s ?_p1 ?session } ||
                EXISTS { ?session ?_p2 ?s })
      }
    }
  `;

  try {
    const r = await fetch(`${cfg.fusekiUrl}/${cfg.dataset}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/n-triples',
        'Authorization': authHeader(),
      },
      body: 'query=' + encodeURIComponent(query),
    });
    if (!r.ok) {
      console.error(`predicate export-sessions: SPARQL error ${r.status}`);
      return 1;
    }
    const ntriples = await r.text();
    // Wrap into TriG with the export graph name.
    console.log(`<${exportGraph}> {`);
    const body = ntriples.split('\n').filter((l) => l.trim()).map((l) => '  ' + l).join('\n');
    if (body) console.log(body);
    console.log('}');
    return 0;
  } catch (err) {
    console.error(`predicate export-sessions failed: ${(err as Error).message}`);
    return 1;
  }
}
