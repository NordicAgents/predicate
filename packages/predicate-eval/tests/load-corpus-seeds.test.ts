import { describe, it, expect } from 'vitest';
import { OxigraphAdapter } from 'predicate-mcp/src/storage/oxigraph.js';
import { main as loadCorpus } from '../src/load-corpus.js';

// `pnpm demo` runs `tsx load-corpus.ts` against a fresh store with no TBox
// pre-seeded. main() must seed the codebase schema itself, otherwise the very
// first kg_assert is rejected with "predicate ... not declared in kg:tbox".
describe('load-corpus self-seeds the codebase TBox', () => {
  it('runs on a fresh store with no pre-seeded schema', async () => {
    const adapter = new OxigraphAdapter({ storePath: ':memory:' });

    await expect(loadCorpus(adapter)).resolves.not.toThrow();

    const filePresent = await adapter.ask(`
      PREFIX cb: <https://predicate.dev/codebase#>
      ASK { GRAPH <kg:abox> { ?f a cb:File } }
    `);
    expect(filePresent).toBe(true);
  });
});
