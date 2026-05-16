import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { GoalStore } from './goal-store.js';
import { Decomposer } from './decomposer.js';
import { GapDetector } from './gap-detector.js';
import type { GoalPlan } from './types.js';

export interface ResearchGoalInput {
  goal: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
}

export async function researchGoal(
  client: SparqlClient,
  input: ResearchGoalInput,
): Promise<GoalPlan> {
  const store = new GoalStore(client);
  const decomposer = new Decomposer();
  const detector = new GapDetector(client);

  const goal = await store.create({
    statement: input.goal,
    source: input.source,
    parentGoal: input.parentGoal,
  });

  const subQuestions = decomposer.decompose(input.goal);
  const gaps = await Promise.all(subQuestions.map((sq) => detector.detect(sq)));

  return { goalId: goal.id, subQuestions, gaps };
}
