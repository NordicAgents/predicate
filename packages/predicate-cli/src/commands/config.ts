import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgConfigGet, kgConfigSet } from 'predicate-mcp/src/tools/kg-config.js';

const KEYS = ['schema-learning', 'init-mode', 'init-ontology'] as const;
type Key = (typeof KEYS)[number];

function isKey(s: string | undefined): s is Key {
  return s !== undefined && (KEYS as readonly string[]).includes(s);
}

function help(): void {
  console.log(`predicate config <get|set>

  config get [<key>]            Print one value, or the full config if key omitted.
  config set <key> <value>      Write a runtime config value into kg:meta.

Keys:
  schema-learning   boolean (true|false) — toggles the auto-proposer.
  init-mode         string  — usually written by \`predicate init\`.
  init-ontology     string  — usually written by \`predicate init\`.
`);
}

export async function config(args: string[]): Promise<number> {
  const sub = args[0];
  if (sub === '--help') { help(); return 0; }
  if (sub === undefined) { help(); return 2; }

  const client = getAdapter();

  if (sub === 'get') {
    const key = args[1];
    if (key !== undefined && !isKey(key)) {
      console.error(`predicate config get: unknown key '${key}'. Valid: ${KEYS.join(', ')}`);
      return 2;
    }
    const r = await kgConfigGet(client, isKey(key) ? { key } : {});
    console.log(JSON.stringify(isKey(key) ? { [r.key!]: r.value } : (r.config ?? {}), null, 2));
    return 0;
  }

  if (sub === 'set') {
    const key = args[1];
    const valueRaw = args[2];
    if (!isKey(key)) {
      console.error(`predicate config set: key must be one of ${KEYS.join(', ')}`);
      return 2;
    }
    if (valueRaw === undefined) {
      console.error('predicate config set: a value is required');
      return 2;
    }
    let value: string | boolean = valueRaw;
    if (key === 'schema-learning') {
      if (valueRaw !== 'true' && valueRaw !== 'false') {
        console.error(`predicate config set: schema-learning expects true|false, got '${valueRaw}'`);
        return 2;
      }
      value = valueRaw === 'true';
    }
    const res = await kgConfigSet(client, { key, value });
    if (!res.ok) { console.error(`predicate config set: ${res.error}`); return 2; }
    console.log(`predicate config set: ${res.key}=${res.value}`);
    return 0;
  }

  console.error(`predicate config: unknown subcommand '${sub}'`);
  help();
  return 2;
}
