import { SparqlClient } from '../sparql/client.js';
import {
  researchGoal,
  DocsResearchSource,
  ImportExtractor, FunctionDeclExtractor, EnvVarExtractor,
  GoalStore, GapDetector, SemanticDecomposer,
} from 'predicate-agent/src/index.js';
import type { GoalPlan, GoalPlanWithStats } from 'predicate-agent/src/types.js';

export interface ResearchGoalToolInput {
  goal: string;
  source?: 'user' | 'inferred';
  parentGoal?: string;
  executeResearch?: boolean;
  corpusRoot?: string;
  useLlmDecomposer?: boolean;
}

export type DecomposerKind = 'deterministic' | 'semantic';

export interface ResearchGoalToolResult extends GoalPlan {
  decomposerKind: DecomposerKind;
  stats?: GoalPlanWithStats['stats'];
}

async function buildTBoxSlice(client: SparqlClient): Promise<string> {
  // Naive slice: list every declared predicate. Mirrors buildTBoxSlice
  // in packages/predicate-cli/src/commands/extract.ts.
  const r = await client.select(
    `PREFIX owl: <http://www.w3.org/2002/07/owl#>
     SELECT DISTINCT ?p ?kind WHERE {
       GRAPH <kg:tbox> {
         ?p a ?kind .
         FILTER (?kind IN (owl:ObjectProperty, owl:DatatypeProperty))
       }
     } ORDER BY ?p`,
  );
  return r.results.bindings.map((b) => `${b['p']!.value} a ${b['kind']!.value} .`).join('\n');
}

export async function kgResearchGoal(
  client: SparqlClient,
  input: ResearchGoalToolInput,
): Promise<ResearchGoalToolResult> {
  const baseInput = {
    goal: input.goal,
    source: input.source ?? ('user' as const),
    parentGoal: input.parentGoal,
  };

  const useSemantic = Boolean(input.useLlmDecomposer) && Boolean(process.env['ANTHROPIC_API_KEY']);
  const decomposerKind: DecomposerKind = useSemantic ? 'semantic' : 'deterministic';

  // Semantic path: run our own goal-store + semantic-decomposer + gap-detector,
  // then optionally execute research on the resulting plan. We only divert from
  // the deterministic Decomposer; the rest of the pipeline mirrors researchGoal.
  if (useSemantic) {
    const store = new GoalStore(client);
    const detector = new GapDetector(client);
    const semantic = new SemanticDecomposer();
    const goal = await store.create({
      statement: baseInput.goal,
      source: baseInput.source,
      parentGoal: baseInput.parentGoal,
    });
    const tboxSlice = await buildTBoxSlice(client);
    const subQuestions = await semantic.decompose(baseInput.goal, tboxSlice);
    const gaps = await Promise.all(subQuestions.map((sq) => detector.detect(sq)));
    const plan: GoalPlan = { goalId: goal.id, subQuestions, gaps };
    if (!input.executeResearch) {
      return { ...plan, decomposerKind };
    }
    // v1.13.0: research execution is wired to the deterministic Decomposer
    // inside researchGoal(). When useLlmDecomposer=true is combined with
    // executeResearch=true we degrade gracefully — run the standard
    // deterministic pipeline so candidate-triple extraction is preserved,
    // and report decomposerKind: 'deterministic' so callers know which
    // sub-questions actually drove the research. Plan-only callers get
    // the full semantic decomposition.
    if (!input.corpusRoot) {
      throw new Error(
        'executeResearch=true requires a corpusRoot path to a directory of .ts files',
      );
    }
    const det = await researchGoal(client, {
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
    }) as GoalPlanWithStats;
    return { ...det, decomposerKind: 'deterministic' };
  }

  // Deterministic path (default).
  if (!input.executeResearch) {
    const plan = (await researchGoal(client, baseInput)) as GoalPlan;
    return { ...plan, decomposerKind };
  }
  if (!input.corpusRoot) {
    throw new Error(
      'executeResearch=true requires a corpusRoot path to a directory of .ts files',
    );
  }
  const plan = (await researchGoal(client, {
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
  })) as GoalPlanWithStats;
  return { ...plan, decomposerKind };
}
