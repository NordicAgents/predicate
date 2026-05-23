import type { StorageAdapter } from 'predicate-mcp/src/storage/index.js';
import type {
  Quad, InferenceTrace, DerivationStep, ProvenanceRecord,
} from './types.js';
import type { Rule } from './rules/types.js';

const META = 'https://industriagents.com/predicate/meta#';
const MAX_DEPTH = 8;

function quadKey(q: Quad): string {
  const o = typeof q.o === 'string' ? q.o : (q.o as { value: string }).value;
  return `${q.s}|${q.p}|${o}`;
}

async function isAsserted(client: StorageAdapter, q: Quad): Promise<boolean> {
  const o = typeof q.o === 'string' ? `<${q.o}>` : `"${(q.o as { value: string }).value}"`;
  return client.ask(`
    ASK {
      {
        GRAPH <kg:abox>  { <${q.s}> <${q.p}> ${o} }
      } UNION {
        GRAPH <kg:tbox>  { <${q.s}> <${q.p}> ${o} }
      }
    }
  `);
}

async function getProvenance(client: StorageAdapter, q: Quad): Promise<ProvenanceRecord | null> {
  const o = typeof q.o === 'string' ? `<${q.o}>` : `"${(q.o as { value: string }).value}"`;
  const r = await client.select(`
    PREFIX pred: <${META}>
    SELECT ?src ?conf ?method ?ts WHERE {
      GRAPH <kg:provenance> {
        << <${q.s}> <${q.p}> ${o} >> pred:source ?src ;
                                      pred:confidence ?conf ;
                                      pred:method ?method ;
                                      pred:timestamp ?ts .
      }
    } LIMIT 1
  `);
  const b = r.results.bindings[0];
  if (!b) return null;
  return {
    triple: q,
    source: b.src!.value,
    confidence: parseFloat(b.conf!.value),
    method: b.method!.value,
    timestamp: b.ts!.value,
  };
}

export async function explain(
  client: StorageAdapter,
  rules: Rule[],
  claim: Quad,
): Promise<InferenceTrace | null> {
  const derivation: DerivationStep[] = [];
  const cited: ProvenanceRecord[] = [];
  const visited = new Set<string>();
  let alternatesExist = false;

  async function recurse(target: Quad, depth: number): Promise<boolean> {
    if (depth > MAX_DEPTH) return false;
    const key = quadKey(target);
    if (visited.has(key)) return true;
    visited.add(key);

    if (await isAsserted(client, target)) {
      const prov = await getProvenance(client, target);
      if (prov) cited.push(prov);
      return true;
    }

    for (const rule of rules) {
      if (!rule.backward) continue;
      if (!rule.backward.matches(target)) continue;
      const r = await client.select(rule.backward.premiseQuery(target));
      if (r.results.bindings.length === 0) continue;
      if (r.results.bindings.length > 1) alternatesExist = true;

      const binding: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.results.bindings[0]!)) binding[k] = v.value;
      const premises = rule.backward.buildPremises(target, binding);

      const ok = (await Promise.all(premises.map((p) => recurse(p, depth + 1))))
        .every(Boolean);
      if (!ok) continue;

      derivation.push({ rule: rule.id, premises, conclusion: target });
      return true;
    }
    return false;
  }

  const ok = await recurse(claim, 0);
  if (!ok) return null;
  return { conclusion: claim, derivation, citedProvenance: cited, alternatesExist };
}
