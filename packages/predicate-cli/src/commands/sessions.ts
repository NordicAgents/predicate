import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';

interface SessionRow {
  sessionUri: string;
  sessionId: string;
  startedAt: string;
  modifiedFiles: number;
  succeeded: number;
  failed: number;
}

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function help(): void {
  console.log(`predicate sessions [--limit N] [--json]

List recent development sessions captured in kg:abox by the
Stop-hook extractor (see \`predicate extract\`). Per-session aggregates:
modifiedFiles (codebase:modifiedIn), succeeded (codebase:succeededIn),
failed (codebase:failedIn).

Options:
  --limit N    Show the N most recent sessions (default 10).
  --json       Output as JSON instead of a table.
  --help       Print this message.
`);
}

async function fetchSessions(client: StorageAdapter, limit: number): Promise<SessionRow[]> {
  const META = 'https://industriagents.com/predicate/meta#';
  const CB   = 'https://industriagents.com/predicate/codebase#';
  const rows = await client.select(
    `PREFIX pred: <${META}>
     PREFIX cb:   <${CB}>
     SELECT ?s ?sid ?at
            (COUNT(DISTINCT ?f) AS ?files)
            (COUNT(DISTINCT ?ok) AS ?okN)
            (COUNT(DISTINCT ?bad) AS ?badN)
     WHERE {
       GRAPH <kg:abox> {
         ?s a pred:Session ;
            pred:sessionId ?sid ;
            pred:at        ?at .
         OPTIONAL { ?f   cb:modifiedIn  ?s }
         OPTIONAL { ?ok  cb:succeededIn ?s }
         OPTIONAL { ?bad cb:failedIn    ?s }
       }
     }
     GROUP BY ?s ?sid ?at
     ORDER BY DESC(?at)
     LIMIT ${limit}`,
  );
  return rows.results.bindings.map((b) => ({
    sessionUri:     b['s']!.value,
    sessionId:      b['sid']!.value,
    startedAt:      b['at']!.value,
    modifiedFiles:  parseInt(b['files']!.value, 10),
    succeeded:      parseInt(b['okN']!.value, 10),
    failed:         parseInt(b['badN']!.value, 10),
  }));
}

function renderTable(rows: SessionRow[]): string {
  if (rows.length === 0) return '(no sessions in kg:abox — run `predicate extract` from a Stop hook first)';
  const header = ['sessionId', 'startedAt', 'modifiedFiles', 'succeeded', 'failed'];
  const cells: string[][] = [header, ...rows.map((r) => [
    r.sessionId,
    r.startedAt,
    String(r.modifiedFiles),
    String(r.succeeded),
    String(r.failed),
  ])];
  const widths = header.map((_, i) => Math.max(...cells.map((row) => row[i]!.length)));
  return cells
    .map((row) => row.map((c, i) => c.padEnd(widths[i]!)).join('  '))
    .join('\n');
}

export async function sessions(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const limitStr = parseFlag(args, '--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 10;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('predicate sessions: --limit must be a positive integer');
    return 2;
  }

  try {
    const client = getAdapter();
    const rows = await fetchSessions(client, limit);
    if (hasFlag(args, '--json')) console.log(JSON.stringify(rows, null, 2));
    else console.log(renderTable(rows));
    return 0;
  } catch (err) {
    console.error(`predicate sessions failed: ${(err as Error).message}`);
    return 1;
  }
}
