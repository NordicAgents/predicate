import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { researchGoal } from 'predicate-agent/src/index.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESEARCH_QUESTIONS } from '../src/research-questions.js';

const client = new SparqlClient(loadConfig());

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

async function loadTbox(file: string): Promise<void> {
  const ttl = readFileSync(resolve(import.meta.dirname, '../../', file), 'utf8');
  const cfg = loadConfig();
  const auth = 'Basic ' + Buffer.from(
    `${process.env.PREDICATE_ADMIN_USER ?? 'admin'}:${process.env.PREDICATE_ADMIN_PASSWORD ?? 'changeme'}`,
  ).toString('base64');
  await fetch(`${cfg.dataEndpoint}?graph=kg:tbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle', Authorization: auth },
    body: ttl,
  });
}

beforeAll(async () => {
  await reset('kg:tbox');
  await loadTbox('predicate-ontology/tbox/codebase.ttl');
  await loadTbox('predicate-ontology/meta/predicate-meta.ttl');
});

beforeEach(async () => {
  for (const g of ['kg:goals', 'kg:meta']) await reset(g);
});

describe('research loop over the 5 starter questions', () => {
  for (const { question, expectedAnswerable, expectedIntentKinds } of RESEARCH_QUESTIONS) {
    it(`${question}`, async () => {
      const plan = await researchGoal(client, { goal: question, source: 'user' });
      const intentKinds = plan.subQuestions.map((s) => s.intent.kind);
      for (const k of expectedIntentKinds) expect(intentKinds).toContain(k);
      const allAnswerable = plan.gaps.every((g) => g.answerable);
      expect(allAnswerable).toBe(expectedAnswerable);
    });
  }
});
