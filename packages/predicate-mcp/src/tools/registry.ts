import { z } from 'zod';
import { SparqlClient } from '../sparql/client.js';
import { kgExploreSchema } from './kg-explore-schema.js';
import { kgAsk } from './kg-ask.js';
import { kgAssert, type Triple } from './kg-assert.js';
import { kgExplain } from './kg-explain.js';
import { kgMaintain } from './kg-maintain.js';
import { kgResearchGoal } from './kg-research-goal.js';
import { kgProposeSchema } from './kg-propose-schema.js';
import { kgStats } from './kg-stats.js';

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

export function buildTools(client: SparqlClient): ToolDef[] {
  return [
    {
      name: 'kg_explore_schema',
      description: 'Return the TBox slice (classes, sub/super, properties, characteristics) for a concept.',
      inputSchema: z.object({ concept: z.string().min(1) }),
      handler: async (raw): Promise<unknown> => {
        const { concept } = z.object({ concept: z.string() }).parse(raw);
        return kgExploreSchema(client, concept);
      },
    },
    {
      name: 'kg_ask',
      description: 'Execute a caller-drafted SPARQL SELECT/ASK against the live graph; logs usage. Read-only.',
      inputSchema: z.object({
        question: z.string(),
        sparql: z.string(),
        maxRows: z.number().int().positive().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          question: z.string(),
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
      description: 'Decompose a goal and report which predicates the live TBox can/cannot answer. When executeResearch=true and corpusRoot is provided, also fetch artifacts from that directory, extract candidate triples, and assert them via kg_assert.',
      inputSchema: z.object({
        goal: z.string().min(1),
        source: z.enum(['user', 'inferred']).optional(),
        parentGoal: z.string().optional(),
        executeResearch: z.boolean().optional(),
        corpusRoot: z.string().optional(),
      }),
      handler: async (raw): Promise<unknown> => {
        const args = z.object({
          goal: z.string(),
          source: z.enum(['user', 'inferred']).optional(),
          parentGoal: z.string().optional(),
          executeResearch: z.boolean().optional(),
          corpusRoot: z.string().optional(),
        }).parse(raw);
        return kgResearchGoal(client, args);
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
        const args = z.object({
          delta: schemaDeltaSchema,
          justification: z.string().min(1),
          motivatingGoal: z.string().optional(),
          ttlDays: z.number().int().positive().optional(),
        }).parse(raw);
        return kgProposeSchema(client, args);
      },
    },
    {
      name: 'kg_stats',
      description: 'Return current graph counts (triples, abox, inferred, tbox), inferredRatio, unusedConceptRatio, and materializationLatencyMsP95.',
      inputSchema: z.object({}),
      handler: async (): Promise<unknown> => kgStats(client),
    },
    ...stubs(),
  ];
}

function stubs(): ToolDef[] {
  return [];
}
