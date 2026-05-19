import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';

interface CaptureRow {
  captureId: string;
  at: string;
  toolName: string;
  phase: string;
  sessionId: string;
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
  console.log(`predicate captures [--limit N] [--tool NAME] [--json]

List raw tool-call captures from kg:usage (only present when
PREDICATE_RAW_CAPTURE=1 was set during the session — see
\`predicate capture --help\` for details). The structured Stop-hook
extraction path uses kg:abox + \`predicate sessions\` instead.

Options:
  --limit N    Show the N most recent captures (default 20).
  --tool NAME  Filter to a specific tool (e.g. --tool Bash).
  --json       Output as JSON.
  --help       Print this message.
`);
}

async function fetchCaptures(
  client: StorageAdapter,
  opts: { limit: number; tool?: string },
): Promise<CaptureRow[]> {
  const META = 'https://predicate.dev/meta#';
  const toolFilter = opts.tool
    ? `FILTER (?tool = "${opts.tool.replace(/"/g, '\\"')}")`
    : '';
  const r = await client.select(
    `PREFIX pred: <${META}>
     SELECT ?c ?at ?tool ?phase ?session WHERE {
       GRAPH <kg:usage> {
         ?c a pred:ToolCall ;
            pred:at        ?at ;
            pred:toolName  ?tool ;
            pred:phase     ?phase .
         OPTIONAL { ?c pred:sessionId ?session }
         ${toolFilter}
       }
     }
     ORDER BY DESC(?at)
     LIMIT ${opts.limit}`,
  );
  return r.results.bindings.map((b) => ({
    captureId: b['c']!.value,
    at:        b['at']!.value,
    toolName:  b['tool']!.value,
    phase:     b['phase']!.value,
    sessionId: b['session']?.value ?? '',
  }));
}

function renderTable(rows: CaptureRow[]): string {
  if (rows.length === 0) {
    return '(no captures in kg:usage — set PREDICATE_RAW_CAPTURE=1 to enable raw capture, then re-run)';
  }
  const header = ['captureId', 'at', 'tool', 'phase', 'sessionId'];
  const cells: string[][] = [header, ...rows.map((r) => [
    r.captureId.replace(/^urn:predicate:capture:/, ''),
    r.at,
    r.toolName,
    r.phase,
    r.sessionId,
  ])];
  const widths = header.map((_, i) => Math.max(...cells.map((row) => row[i]!.length)));
  return cells
    .map((row) => row.map((c, i) => c.padEnd(widths[i]!)).join('  '))
    .join('\n');
}

export async function captures(args: string[]): Promise<number> {
  if (hasFlag(args, '--help')) { help(); return 0; }
  const limitStr = parseFlag(args, '--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 20;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('predicate captures: --limit must be a positive integer');
    return 2;
  }
  const tool = parseFlag(args, '--tool');
  try {
    const client = getAdapter();
    const rows = await fetchCaptures(client, { limit, ...(tool ? { tool } : {}) });
    if (hasFlag(args, '--json')) console.log(JSON.stringify(rows, null, 2));
    else console.log(renderTable(rows));
    return 0;
  } catch (err) {
    console.error(`predicate captures failed: ${(err as Error).message}`);
    return 1;
  }
}
