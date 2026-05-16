import { z } from 'zod';
import { SparqlClient } from '../sparql/client.js';
import { kgExploreSchema } from './kg-explore-schema.js';
import { kgAsk } from './kg-ask.js';
import { kgAssert, type Triple } from './kg-assert.js';
import { kgExplain } from './kg-explain.js';
import { kgMaintain } from './kg-maintain.js';
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
    ...stubs(),
  ];
}

function stubs(): ToolDef[] {
  const names: [string, string][] = [
    ['kg_propose_schema', 'Stage a schema delta for review.'],
    ['kg_research_goal', 'Run gap-detect → research → propose loop for a goal.'],
    ['kg_stats', 'Graph stats: triples, inferred ratio, materialization latency.'],
  ];
  return names.map(([name, description]) => ({
    name,
    description,
    inputSchema: z.unknown(),
    handler: async (): Promise<never> => { throw new NotImplementedError(name); },
  }));
}
