import { SparqlClient } from '../sparql/client.js';
import { SchemaProposer, type SchemaDelta } from 'predicate-agent/src/index.js';

export interface ProposeSchemaInput {
  delta: SchemaDelta;
  justification: string;
  motivatingGoal?: string;
  ttlDays?: number;
}

export async function kgProposeSchema(
  client: SparqlClient,
  input: ProposeSchemaInput,
): Promise<{ proposalId: string }> {
  const proposer = new SchemaProposer(client);
  const id = await proposer.propose(input.delta, {
    justification: input.justification,
    motivatingGoal: input.motivatingGoal,
    ttlDays: input.ttlDays,
  });
  return { proposalId: id };
}
