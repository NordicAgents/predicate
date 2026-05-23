import type { StorageAdapter } from '../storage/index.js';
import { escapeLiteral } from '../sparql/escape.js';

const META = 'https://industriagents.com/predicate/meta#';
const CONFIG_URI = 'urn:predicate:config';

// Map external key (kebab-case) ↔ internal property (camelCase)
const KEY_TO_PROP: Record<string, { prop: string; type: 'boolean' | 'string' }> = {
  'schema-learning':  { prop: 'schemaLearningEnabled', type: 'boolean' },
  'init-mode':        { prop: 'initMode',              type: 'string'  },
  'init-ontology':    { prop: 'initOntology',          type: 'string'  },
};

export interface KgConfigSetInput {
  key: 'schema-learning' | 'init-mode' | 'init-ontology';
  value: string | boolean;
}

export type KgConfigSetResult =
  | { ok: true; key: string; value: string | boolean }
  | { ok: false; error: string };

export interface KgConfigGetInput {
  key?: 'schema-learning' | 'init-mode' | 'init-ontology';
}

export interface KgConfigGetResult {
  config?: Record<string, string | boolean>;
  key?: string;
  value?: string | boolean | null;
}

function literalFor(value: string | boolean, type: 'boolean' | 'string'): string {
  if (type === 'boolean') {
    return `"${value}"^^<http://www.w3.org/2001/XMLSchema#boolean>`;
  }
  return escapeLiteral(String(value));
}

export async function kgConfigSet(
  client: StorageAdapter,
  input: KgConfigSetInput,
): Promise<KgConfigSetResult> {
  const meta = KEY_TO_PROP[input.key];
  if (!meta) {
    return { ok: false, error: `unknown key '${input.key}'. Valid keys: ${Object.keys(KEY_TO_PROP).join(', ')}` };
  }
  if (meta.type === 'boolean' && typeof input.value !== 'boolean') {
    return { ok: false, error: `${input.key} expects boolean, got ${typeof input.value}` };
  }
  if (meta.type === 'string' && typeof input.value !== 'string') {
    return { ok: false, error: `${input.key} expects string, got ${typeof input.value}` };
  }
  const propIri = `<${META}${meta.prop}>`;
  const lit = literalFor(input.value, meta.type);
  await client.update(`
    PREFIX pred: <${META}>
    DELETE { GRAPH <kg:meta> { <${CONFIG_URI}> ${propIri} ?o } }
    WHERE  { GRAPH <kg:meta> { <${CONFIG_URI}> ${propIri} ?o } }
  `);
  await client.update(`
    PREFIX pred: <${META}>
    INSERT DATA { GRAPH <kg:meta> { <${CONFIG_URI}> ${propIri} ${lit} } }
  `);
  return { ok: true, key: input.key, value: input.value };
}

export async function kgConfigGet(
  client: StorageAdapter,
  input: KgConfigGetInput,
): Promise<KgConfigGetResult> {
  if (input.key) {
    const meta = KEY_TO_PROP[input.key];
    if (!meta) return { key: input.key, value: null };
    const r = await client.select(`
      PREFIX pred: <${META}>
      SELECT ?o WHERE { GRAPH <kg:meta> { <${CONFIG_URI}> <${META}${meta.prop}> ?o } }
    `);
    const b = r.results.bindings[0];
    if (!b) return { key: input.key, value: null };
    const raw = b['o']!.value;
    const value: string | boolean = meta.type === 'boolean' ? raw === 'true' : raw;
    return { key: input.key, value };
  }
  // All-config flavor
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT ?p ?o WHERE { GRAPH <kg:meta> { <${CONFIG_URI}> ?p ?o } }
  `);
  const config: Record<string, string | boolean> = {};
  for (const b of r.results.bindings) {
    const propIri = b['p']!.value;
    const propLocal = propIri.slice(META.length);
    const externalKey = Object.entries(KEY_TO_PROP).find(([, v]) => v.prop === propLocal);
    if (!externalKey) continue;
    const [extKey, kmeta] = externalKey;
    config[extKey] = kmeta.type === 'boolean' ? b['o']!.value === 'true' : b['o']!.value;
  }
  return { config };
}
