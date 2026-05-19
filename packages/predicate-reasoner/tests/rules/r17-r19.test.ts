import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { runFixpoint } from '../../src/fixpoint.js';
import { RULES } from '../../src/rules/index.js';
import type { RuleConfig } from '../../src/rules/types.js';

const client = getAdapter();

const cfg: RuleConfig = {
  tboxGraph: 'kg:tbox',
  aboxGraphs: ['kg:abox-test-r17-r19'],
  inferredGraph: 'kg:inferred-test-r17-r19',
  closureCutoff: 0.5,
};

async function reset(g: string): Promise<void> {
  await client.update(`DROP SILENT GRAPH <${g}>`);
  await client.update(`CREATE SILENT GRAPH <${g}>`);
}

beforeEach(async () => {
  await reset(cfg.aboxGraphs[0]!);
  await reset(cfg.inferredGraph);
});

afterAll(async () => {
  await reset(cfg.aboxGraphs[0]!);
  await reset(cfg.inferredGraph);
});

async function inferredHas(query: string): Promise<boolean> {
  return client.ask(query);
}

describe('R17 hotspot', () => {
  it('derives codebase:Hotspot for files modified in >=3 distinct sessions', async () => {
    await client.update(`
      PREFIX cb: <https://predicate.dev/codebase#>
      INSERT DATA { GRAPH <${cfg.aboxGraphs[0]}> {
        <file:///a.ts> cb:modifiedIn <urn:session:1> , <urn:session:2> , <urn:session:3> .
        <file:///b.ts> cb:modifiedIn <urn:session:1> , <urn:session:2> .
      } }
    `);
    await runFixpoint(client, RULES, cfg);
    expect(
      await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
        ASK { GRAPH <${cfg.inferredGraph}> { <file:///a.ts> a cb:Hotspot } }`),
    ).toBe(true);
    expect(
      await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
        ASK { GRAPH <${cfg.inferredGraph}> { <file:///b.ts> a cb:Hotspot } }`),
    ).toBe(false);
  });
});

describe('R18 flaky command', () => {
  it('derives codebase:FlakyCommand for commands that failed in >=2 distinct sessions', async () => {
    await client.update(`
      PREFIX cb: <https://predicate.dev/codebase#>
      INSERT DATA { GRAPH <${cfg.aboxGraphs[0]}> {
        <urn:bash:flaky> cb:failedIn <urn:session:1> , <urn:session:2> .
        <urn:bash:rare>  cb:failedIn <urn:session:1> .
      } }
    `);
    await runFixpoint(client, RULES, cfg);
    expect(
      await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
        ASK { GRAPH <${cfg.inferredGraph}> { <urn:bash:flaky> a cb:FlakyCommand } }`),
    ).toBe(true);
    expect(
      await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
        ASK { GRAPH <${cfg.inferredGraph}> { <urn:bash:rare>  a cb:FlakyCommand } }`),
    ).toBe(false);
  });
});

describe('R19 active file', () => {
  it('derives codebase:ActiveFile only for files modified in the most-recent session', async () => {
    await client.update(`
      PREFIX cb:   <https://predicate.dev/codebase#>
      PREFIX pred: <https://predicate.dev/meta#>
      PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
      INSERT DATA { GRAPH <${cfg.aboxGraphs[0]}> {
        <urn:session:old>  a pred:Session ; pred:at "2026-01-01T00:00:00Z"^^xsd:dateTime .
        <urn:session:new>  a pred:Session ; pred:at "2026-05-17T00:00:00Z"^^xsd:dateTime .
        <file:///old.ts>   cb:modifiedIn <urn:session:old> .
        <file:///new.ts>   cb:modifiedIn <urn:session:new> .
      } }
    `);
    await runFixpoint(client, RULES, cfg);
    expect(
      await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
        ASK { GRAPH <${cfg.inferredGraph}> { <file:///new.ts> a cb:ActiveFile } }`),
    ).toBe(true);
    expect(
      await inferredHas(`PREFIX cb: <https://predicate.dev/codebase#>
        ASK { GRAPH <${cfg.inferredGraph}> { <file:///old.ts> a cb:ActiveFile } }`),
    ).toBe(false);
  });
});
