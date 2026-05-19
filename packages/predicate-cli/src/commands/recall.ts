import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';

interface RecallResult {
  query: string;
  files: Array<{ file: string; modifiedInSessions: number; lastModifiedAt: string }>;
  commands: Array<{ commandText: string; succeeded: number; failed: number }>;
}

function help(): void {
  console.log(`predicate recall <query> [--json] [--limit N]

Search session-history (kg:abox) for files and commands matching the
query substring. Output:
  - Files: list of file paths matching <query>, with how many sessions
    they were modified in and when last touched.
  - Commands: list of bash command texts matching <query>, with success
    and failure counts.

This is a substring-match memory primitive, not a semantic search.
Use it to answer questions like "what did I do with X recently?".

Options:
  --limit N    Cap rows per category (default 10).
  --json       Output as JSON.
  --help       Print this message.

Example:
  predicate recall auth
  predicate recall "pnpm test"
`);
}

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function escapeSparqlLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function searchFiles(
  client: StorageAdapter,
  query: string,
  limit: number,
): Promise<RecallResult['files']> {
  const CB = 'https://predicate.dev/codebase#';
  const META = 'https://predicate.dev/meta#';
  const r = await client.select(
    `PREFIX cb:   <${CB}>
     PREFIX pred: <${META}>
     SELECT ?file (COUNT(DISTINCT ?session) AS ?modCount) (MAX(?at) AS ?lastAt)
     WHERE {
       GRAPH <kg:abox> {
         ?file cb:modifiedIn ?session .
         ?session pred:at ?at .
         FILTER (CONTAINS(LCASE(STR(?file)), LCASE("${escapeSparqlLiteral(query)}")))
       }
     }
     GROUP BY ?file
     ORDER BY DESC(?lastAt)
     LIMIT ${limit}`,
  );
  return r.results.bindings.map((b) => ({
    file:               b['file']!.value,
    modifiedInSessions: parseInt(b['modCount']!.value, 10),
    lastModifiedAt:     b['lastAt']!.value,
  }));
}

async function searchCommands(
  client: StorageAdapter,
  query: string,
  limit: number,
): Promise<RecallResult['commands']> {
  const CB = 'https://predicate.dev/codebase#';
  const r = await client.select(
    `PREFIX cb: <${CB}>
     SELECT ?text
            (COUNT(DISTINCT ?okSession) AS ?okN)
            (COUNT(DISTINCT ?badSession) AS ?badN)
     WHERE {
       GRAPH <kg:abox> {
         ?cmd a cb:Command ; cb:commandText ?text .
         OPTIONAL { ?cmd cb:succeededIn ?okSession }
         OPTIONAL { ?cmd cb:failedIn    ?badSession }
         FILTER (CONTAINS(LCASE(?text), LCASE("${escapeSparqlLiteral(query)}")))
       }
     }
     GROUP BY ?text
     ORDER BY DESC(?badN) DESC(?okN)
     LIMIT ${limit}`,
  );
  return r.results.bindings.map((b) => ({
    commandText: b['text']!.value,
    succeeded:   parseInt(b['okN']!.value, 10),
    failed:      parseInt(b['badN']!.value, 10),
  }));
}

function render(result: RecallResult): string {
  const lines: string[] = [];
  lines.push(`recall "${result.query}":`);
  lines.push('');
  if (result.files.length > 0) {
    lines.push(`  Files (${result.files.length}):`);
    for (const f of result.files) {
      lines.push(`    ${f.file} — ${f.modifiedInSessions} sessions, last ${f.lastModifiedAt}`);
    }
    lines.push('');
  }
  if (result.commands.length > 0) {
    lines.push(`  Commands (${result.commands.length}):`);
    for (const c of result.commands) {
      const cmd = c.commandText.length > 80 ? c.commandText.slice(0, 80) + '…' : c.commandText;
      lines.push(`    ${cmd}  (ok=${c.succeeded} fail=${c.failed})`);
    }
    lines.push('');
  }
  if (result.files.length === 0 && result.commands.length === 0) {
    lines.push(`  (no files or commands matched "${result.query}" in kg:abox)`);
  }
  return lines.join('\n');
}

export async function recall(args: string[]): Promise<number> {
  if (hasFlag(args, '--help') || args.length === 0) {
    help();
    return args.length === 0 ? 2 : 0;
  }
  const flagIdxs = new Set<number>();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' || args[i] === '--json') {
      flagIdxs.add(i);
      if (args[i] === '--limit') flagIdxs.add(i + 1);
    }
  }
  const queryParts = args.filter((_, i) => !flagIdxs.has(i));
  const query = queryParts.join(' ').trim();
  if (!query) {
    console.error('predicate recall: query argument is required');
    return 2;
  }
  const limitStr = parseFlag(args, '--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 10;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('predicate recall: --limit must be a positive integer');
    return 2;
  }
  try {
    const client = getAdapter();
    const [files, commands] = await Promise.all([
      searchFiles(client, query, limit),
      searchCommands(client, query, limit),
    ]);
    const result: RecallResult = { query, files, commands };
    if (hasFlag(args, '--json')) console.log(JSON.stringify(result, null, 2));
    else console.log(render(result));
    return 0;
  } catch (err) {
    console.error(`predicate recall failed: ${(err as Error).message}`);
    return 1;
  }
}
