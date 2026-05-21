import { describe, it, expect, beforeEach } from 'vitest';
import { OxigraphAdapter } from '../src/storage/index.js';
import { markAboxDirty, isAboxDirty, clearAboxDirty, materializeIfDirty } from '../src/materialize.js';
import { kgAssert } from '../src/tools/kg-assert.js';

const TBOX = `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix cb: <https://predicate.dev/codebase#> .
cb:calls a owl:ObjectProperty , owl:TransitiveProperty .
`;

describe('dirty marker', () => {
  let client: OxigraphAdapter;
  beforeEach(() => { client = new OxigraphAdapter({ storePath: ':memory:' }); });

  it('is clean on a fresh store (absent marker)', async () => {
    expect(await isAboxDirty(client)).toBe(false);
  });

  it('mark then clear toggles the flag, idempotently', async () => {
    await markAboxDirty(client);
    await markAboxDirty(client);
    expect(await isAboxDirty(client)).toBe(true);
    await clearAboxDirty(client);
    expect(await isAboxDirty(client)).toBe(false);
  });
});

describe('materializeIfDirty', () => {
  it('reasons once when dirty and reports it ran; no-op when clean', async () => {
    const client = new OxigraphAdapter({ storePath: ':memory:' });
    await client.loadTurtle(TBOX, 'kg:tbox');
    const F = 'https://predicate.dev/codebase/x#';
    const C = 'https://predicate.dev/codebase#calls';
    const assert = (s: string, o: string) =>
      kgAssert(client, { subject: s, predicate: C, object: { type: 'uri', value: o },
        source: 't', confidence: 0.95, method: 'm' });
    await assert(`${F}a`, `${F}b`);
    await assert(`${F}b`, `${F}c`);
    await markAboxDirty(client);

    const ranFirst = await materializeIfDirty(client);
    expect(ranFirst).toBe(true);
    const inferred = await client.ask(`ASK { GRAPH <kg:inferred> { <${F}a> <${C}> <${F}c> } }`);
    expect(inferred).toBe(true);
    expect(await isAboxDirty(client)).toBe(false);

    const ranSecond = await materializeIfDirty(client);
    expect(ranSecond).toBe(false);
  });
});
