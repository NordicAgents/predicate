import { z } from 'zod';
import { SparqlClient } from '../sparql/client.js';
import { kgExploreSchema } from './kg-explore-schema.js';
import { kgAsk } from './kg-ask.js';
import { kgAssert, type Triple } from './kg-assert.js';
import { NotImplementedError } from './stubs.js';

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
    ...stubs(),
  ];
}

function stubs(): ToolDef[] {
  const names: [string, string][] = [
    ['kg_explain', 'Return the inference path for a claim.'],
    ['kg_propose_schema', 'Stage a schema delta for review.'],
    ['kg_research_goal', 'Run gap-detect → research → propose loop for a goal.'],
    ['kg_stats', 'Graph stats: triples, inferred ratio, materialization latency.'],
    ['kg_maintain', 'Trigger pruning, generalization, and refactor sweep.'],
  ];
  return names.map(([name, description]) => ({
    name,
    description,
    inputSchema: z.unknown(),
    handler: async (): Promise<never> => { throw new NotImplementedError(name); },
  }));
}
