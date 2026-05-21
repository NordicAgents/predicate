import { z } from 'zod';
import type { CompletionProvider } from 'predicate-agent/src/index.js';
import type { StorageAdapter } from '../storage/index.js';
import { parseInput } from './parse-input.js';
import { kgExploreSchema } from './kg-explore-schema.js';
import { kgAsk } from './kg-ask.js';
import { kgAssert, type Triple } from './kg-assert.js';
import { kgExplain } from './kg-explain.js';
import { kgMaintain } from './kg-maintain.js';
import { kgResearchGoal } from './kg-research-goal.js';
import { kgProposeSchema } from './kg-propose-schema.js';
import { kgStats } from './kg-stats.js';
import { kgExtractJudgments } from './kg-extract-judgments.js';

export interface BuildToolsOptions {
  /**
   * Extra completion providers (e.g. an MCP SamplingProvider) forwarded to
   * tools that issue LLM calls — currently kg_research_goal. The decomposer
   * tries these before falling back to the Anthropic SDK provider.
   */
  extraCompletionProviders?: CompletionProvider[];
}

const deltaQuadSchema = z.object({
  s: z.string(),
  p: z.string(),
  o: z.union([
    z.object({ type: z.literal('uri'), value: z.string() }),
    z.object({
      type: z.literal('literal'), value: z.string(),
      datatype: z.string().optional(),
    }),
  ]),
});

const schemaDeltaSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add-class'),
    add: z.array(deltaQuadSchema),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
  z.object({
    kind: z.literal('add-property'),
    add: z.array(deltaQuadSchema),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
  z.object({
    kind: z.literal('refine-class'),
    parent: z.string(),
    add: z.array(deltaQuadSchema),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
  z.object({
    kind: z.literal('breaking'),
    remove: z.array(deltaQuadSchema),
    add: z.array(deltaQuadSchema),
    migration: z.string(),
    shapes: z.array(deltaQuadSchema).optional(),
  }),
]);

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (args: unknown) => Promise<unknown>;
}

export function buildTools(client: StorageAdapter, options: BuildToolsOptions = {}): ToolDef[] {
  const extraCompletionProviders = options.extraCompletionProviders ?? [];
  return [
    {
      name: 'kg_explore_schema',
      description: 'Return the TBox slice (classes, sub/super, properties, characteristics) for a concept.',
      inputSchema: z.object({ concept: z.string().min(1) }),
      handler: async (raw): Promise<unknown> => {
        const { concept } = parseInput(z.object({ concept: z.string().min(1) }), raw, 'kg_explore_schema');
        return kgExploreSchema(client, concept);
      },
    },
    {
      name: 'kg_ask',
      description: 'Execute a caller-drafted SPARQL SELECT/ASK against the live graph; logs usage. Read-only. "question" is an optional human-readable label.',
      inputSchema: z.object({
        question: z.string().optional(),
        sparql: z.string(),
        maxRows: z.number().int().positive().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          question: z.string().optional(),
          sparql: z.string(),
          maxRows: z.number().int().positive().optional(),
        }).parse(raw);
        return kgAsk(client, args);
      },
    },
    {
      name: 'kg_assert',
      description: 'Assert a triple into kg:abox with RDF-star provenance (source, confidence, method).',
      inputSchema: z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.object({
          type: z.enum(['uri', 'literal']),
          value: z.string(),
          datatype: z.string().optional(),
        }),
        source: z.string(),
        confidence: z.number().min(0).max(1),
        method: z.string(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = raw as Triple;
        await kgAssert(client, args);
        return { ok: true };
      },
    },
    {
      name: 'kg_explain',
      description: 'Return one valid inference trace for a claim, with cited provenance for every asserted premise.',
      inputSchema: z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.object({
          type: z.enum(['uri', 'literal']),
          value: z.string(),
        }),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          subject: z.string(),
          predicate: z.string(),
          object: z.object({ type: z.enum(['uri', 'literal']), value: z.string() }),
        }).parse(raw);
        return kgExplain(client, args);
      },
    },
    {
      name: 'kg_maintain',
      description: 'Archive stale low-confidence ABox triples; emit a MaintenanceRun event.',
      inputSchema: z.object({
        archiveCutoff: z.number().min(0).max(1).optional(),
        ageDays: z.number().int().positive().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        return kgMaintain(client, raw as Parameters<typeof kgMaintain>[1]);
      },
    },
    {
      name: 'kg_research_goal',
      description: 'Decompose a goal and report which predicates the live TBox can/cannot answer. When executeResearch=true and corpusRoot is provided, also fetch artifacts from that directory, extract candidate triples, and assert them via kg_assert. Set useLlmDecomposer=true to enable LLM-augmented decomposition for questions that do not match a built-in pattern; the decomposer prefers MCP sampling (no API key needed) and falls back to ANTHROPIC_API_KEY, then to deterministic.',
      inputSchema: z.object({
        goal: z.string().min(1),
        source: z.enum(['user', 'inferred']).optional(),
        parentGoal: z.string().optional(),
        executeResearch: z.boolean().optional(),
        corpusRoot: z.string().optional(),
        useLlmDecomposer: z.boolean().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = parseInput(z.object({
          goal: z.string().min(1),
          source: z.enum(['user', 'inferred']).optional(),
          parentGoal: z.string().optional(),
          executeResearch: z.boolean().optional(),
          corpusRoot: z.string().optional(),
          useLlmDecomposer: z.boolean().optional(),
        }), raw, 'kg_research_goal');
        return kgResearchGoal(client, args, { extraCompletionProviders });
      },
    },
    {
      name: 'kg_propose_schema',
      description: "Stage a SchemaDelta proposal (add-class, add-property, refine-class, or breaking). Writes to kg:tbox-staging with metadata; emits a SchemaProposed event. Promotion is the sweeper's job.",
      inputSchema: z.object({
        delta: schemaDeltaSchema,
        justification: z.string().min(1),
        motivatingGoal: z.string().optional(),
        ttlDays: z.number().int().positive().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = parseInput(z.object({
          delta: schemaDeltaSchema,
          justification: z.string().min(1),
          motivatingGoal: z.string().optional(),
          ttlDays: z.number().int().positive().optional(),
        }), raw, 'kg_propose_schema');
        return kgProposeSchema(client, args);
      },
    },
    {
      name: 'kg_stats',
      description: 'Return current graph counts (triples, abox, inferred, tbox), inferredRatio, unusedConceptRatio, and materializationLatencyMsP95.',
      inputSchema: z.object({}),
      handler: async (): Promise<unknown> => kgStats(client),
    },
    {
      name: 'kg_extract_judgments',
      description: 'Return the j: schema slice, current judgments about touched entities, and a brief instructing you (the host model) to distill this session\'s judgments and assert them via kg_assert. Makes no LLM call. Call near session end when you made a decision, formed a preference/assessment, or reconciled conflicting sources.',
      inputSchema: z.object({
        touchedEntities: z.array(z.string()).optional(),
        sessionId: z.string().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = parseInput(z.object({
          touchedEntities: z.array(z.string()).optional(),
          sessionId: z.string().optional(),
        }), raw, 'kg_extract_judgments');
        return kgExtractJudgments(client, args);
      },
    },
    ...stubs(),
  ];
}

function stubs(): ToolDef[] {
  return [];
}
