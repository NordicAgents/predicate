import { SparqlClient } from '../sparql/client.js';
import { researchGoal } from 'predicate-agent/src/index.js';

export interface ResearchGoalToolInput {
  goal: string;
  source?: 'user' | 'inferred';
  parentGoal?: string;
}

export async function kgResearchGoal(
  client: SparqlClient,
  input: ResearchGoalToolInput,
): Promise<unknown> {
  return researchGoal(client, {
    goal: input.goal,
    source: input.source ?? 'user',
    parentGoal: input.parentGoal,
  });
}
