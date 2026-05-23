import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { escapeLiteral } from 'predicate-mcp/src/sparql/escape.js';
import { SchemaProposer } from '../src/schema-proposer.js';
import { PromotionSweeper } from '../src/promotion-sweeper.js';
import { LifecycleController } from '../src/lifecycle-controller.js';

const client = getAdapter();
let promotedDir: string;

beforeAll(() => {
  promotedDir = mkdtempSync(join(tmpdir(), 'predicate-demote-'));
  process.env['PREDICATE_PROMOTED_DIR'] = promotedDir;
});

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}
async function recordUsage(sparql: string): Promise<void> {
  await client.update(`
    PREFIX pred: <https://industriagents.com/predicate/meta#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    INSERT DATA { GRAPH <kg:usage> {
      <urn:test:usage:${Math.random().toString(36).slice(2, 8)}> a pred:Query ;
        pred:sparql ${escapeLiteral(sparql)} ;
        pred:at "${new Date().toISOString()}"^^xsd:dateTime . } }`);
}

describe('demote round-trip', () => {
  beforeEach(async () => {
    for (const g of ['kg:tbox', 'kg:tbox-staging', 'kg:tbox-demoted', 'kg:meta', 'kg:usage', 'kg:inferred']) {
      await reset(g);
    }
  });

  it('promotes then demotes: triples leave kg:tbox, land in kg:tbox-demoted', async () => {
    const proposer = new SchemaProposer(client);
    const delta = { kind: 'add-class' as const, add: [
      { s: 'https://industriagents.com/predicate/codebase/Widget', p: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', o: { type: 'uri' as const, value: 'http://www.w3.org/2002/07/owl#Class' } },
    ] };
    const proposalId = await proposer.propose(delta, { justification: 'because' });
    for (let i = 0; i < 3; i++) await recordUsage('SELECT * WHERE { <https://industriagents.com/predicate/codebase/Widget> ?p ?o }');
    const decision = await new PromotionSweeper(client).promoteById(proposalId, { actor: 'test' });
    expect(decision.outcome).toBe('promoted');

    const ctrl = new LifecycleController(client);
    const demote = await ctrl.demoteById(proposalId, { reason: 'test', actor: 'test' });
    expect(demote.outcome).toBe('demoted');

    const tbox = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox> { ?s ?p ?o } }`);
    const demoted = await client.select(`SELECT (COUNT(*) AS ?n) WHERE { GRAPH <kg:tbox-demoted> { ?s ?p ?o } }`);
    expect(parseInt(tbox.results.bindings[0]!['n']!.value, 10)).toBe(0);
    expect(parseInt(demoted.results.bindings[0]!['n']!.value, 10)).toBeGreaterThan(0);
    expect(demote.demotedFile && existsSync(demote.demotedFile)).toBeTruthy();
  });

  it('returns not-found for an unknown proposal', async () => {
    const ctrl = new LifecycleController(client);
    const d = await ctrl.demoteById('urn:predicate:proposal:missing', { reason: 'x', actor: 'test' });
    expect(d.outcome).toBe('not-found');
  });
});
