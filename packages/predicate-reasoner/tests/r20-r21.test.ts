import { describe, it, expect, beforeAll } from 'vitest';
import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { withJudgmentTBox } from 'predicate-mcp/tests/fixtures/with-judgment.js';

const client = getAdapter();

beforeAll(async () => {
  await withJudgmentTBox(client);
});

describe('judgment overlay', () => {
  it('loads j:settledAs as a ConflictFunctionalProperty (not owl:FunctionalProperty)', async () => {
    const isMarker = await client.ask(`
      PREFIX j: <https://predicate.dev/judgment#>
      ASK { GRAPH <kg:tbox> { j:settledAs a j:ConflictFunctionalProperty } }
    `);
    const isOwlFunctional = await client.ask(`
      PREFIX j:   <https://predicate.dev/judgment#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      ASK { GRAPH <kg:tbox> { j:settledAs a owl:FunctionalProperty } }
    `);
    expect(isMarker).toBe(true);
    expect(isOwlFunctional).toBe(false);
  });
});
