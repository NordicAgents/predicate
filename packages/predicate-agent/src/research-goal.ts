import type { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { kgAssert, type Triple } from 'predicate-mcp/src/tools/kg-assert.js';
import { GoalStore } from './goal-store.js';
import { Decomposer } from './decomposer.js';
import { GapDetector } from './gap-detector.js';
import type {
  CandidateTriple, GoalPlan, GoalPlanWithStats,
  ResearchStats,
} from './types.js';
import type { ResearchSource } from './research-source.js';
import type { Extractor } from './extractor.js';

export interface ResearchGoalInput {
  goal: string;
  source: 'user' | 'inferred';
  parentGoal?: string;
  executeResearch?: boolean;
  sources?: ResearchSource[];
  extractors?: Extractor[];
}

export async function researchGoal(
  client: SparqlClient,
  input: ResearchGoalInput,
): Promise<GoalPlan | GoalPlanWithStats> {
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

  const base: GoalPlan = { goalId: goal.id, subQuestions, gaps };
  if (!input.executeResearch) return base;

  const sources = input.sources ?? [];
  const extractors = input.extractors ?? [];
  const stats: ResearchStats[] = [];

  for (let i = 0; i < subQuestions.length; i++) {
    const sq = subQuestions[i]!;
    const gap = gaps[i]!;
    const stat: ResearchStats = {
      subQuestionId: sq.id,
      artifactsFetched: 0,
      candidatesExtracted: 0,
      assertedCount: 0,
      rejectedCount: 0,
      errors: [],
    };
    if (!gap.answerable) {
      stats.push(stat);
      continue;
    }
    for (const src of sources) {
      const artifacts = await src.fetch({ intent: sq.intent });
      stat.artifactsFetched += artifacts.length;
      for (const artifact of artifacts) {
        for (const extr of extractors) {
          if (!extr.supports(sq.intent.kind)) continue;
          const candidates = extr.extract(artifact, sq.intent);
          stat.candidatesExtracted += candidates.length;
          for (const c of candidates) {
            try {
              await assertCandidate(client, c);
              stat.assertedCount += 1;
            } catch (e) {
              stat.rejectedCount += 1;
              stat.errors.push((e as Error).message);
            }
          }
        }
      }
    }
    stats.push(stat);
  }
  return { ...base, stats };
}

async function assertCandidate(client: SparqlClient, c: CandidateTriple): Promise<void> {
  const t: Triple = {
    subject: c.subject,
    predicate: c.predicate,
    object: c.object,
    source: c.source,
    confidence: c.confidence,
    method: c.method,
  };
  await kgAssert(client, t);
}
