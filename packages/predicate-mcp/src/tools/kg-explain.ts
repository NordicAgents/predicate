import { SparqlClient } from '../sparql/client.js';
import { FusekiConstructAdapter } from 'predicate-reasoner/src/index.js';
import type { Quad } from 'predicate-reasoner/src/types.js';

export interface ExplainInput {
  subject: string;
  predicate: string;
  object: { type: 'uri' | 'literal'; value: string };
}

export async function kgExplain(client: SparqlClient, input: ExplainInput): Promise<unknown> {
  const adapter = new FusekiConstructAdapter(client);
  const claim: Quad = {
    s: input.subject, p: input.predicate,
    o: input.object.type === 'uri' ? input.object.value : { value: input.object.value },
  };
  const trace = await adapter.explain(claim);
  if (trace === null) {
    return { provable: false, reason: 'no derivation found within depth bound' };
  }
  return { provable: true, ...trace };
}
