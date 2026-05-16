import { SparqlClient } from '../sparql/client.js';
import {
  researchGoal,
  DocsResearchSource,
  ImportExtractor, FunctionDeclExtractor, EnvVarExtractor,
} from 'predicate-agent/src/index.js';

export interface ResearchGoalToolInput {
  goal: string;
  source?: 'user' | 'inferred';
  parentGoal?: string;
  executeResearch?: boolean;
  corpusRoot?: string;
}

export async function kgResearchGoal(
  client: SparqlClient,
  input: ResearchGoalToolInput,
): Promise<unknown> {
  const baseInput = {
    goal: input.goal,
    source: input.source ?? ('user' as const),
    parentGoal: input.parentGoal,
  };
  if (!input.executeResearch) {
    return researchGoal(client, baseInput);
  }
  if (!input.corpusRoot) {
    throw new Error(
      'executeResearch=true requires a corpusRoot path to a directory of .ts files',
    );
  }
  return researchGoal(client, {
    ...baseInput,
    executeResearch: true,
    sources: [new DocsResearchSource({
      root: input.corpusRoot,
      extensions: ['.ts'],
    })],
    extractors: [
      new ImportExtractor(),
      new FunctionDeclExtractor(),
      new EnvVarExtractor(),
    ],
  });
}
