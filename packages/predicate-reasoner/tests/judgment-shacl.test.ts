import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runShacl } from '../src/shacl.js';

const here = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(here, '..', '..', 'predicate-ontology', 'catalog');
const shapes = readFileSync(join(CATALOG, 'judgment.shacl.ttl'), 'utf8');
const ont = readFileSync(join(CATALOG, 'judgment.ttl'), 'utf8');

describe('judgment SHACL', () => {
  it('fails a judgment with no j:basedOn', async () => {
    const data = `${ont}
      @prefix j: <https://predicate.dev/judgment#> .
      @prefix ex: <https://predicate.dev/corpus/x#> .
      ex:j1 a j:Assessment ; j:rationale "fragile" ; j:about ex:svc .`;
    const r = await runShacl(data, shapes);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.resultPath?.includes('basedOn'))).toBe(true);
  });

  it('passes a well-formed judgment', async () => {
    const data = `${ont}
      @prefix j: <https://predicate.dev/judgment#> .
      @prefix ex: <https://predicate.dev/corpus/x#> .
      ex:j2 a j:Assessment ; j:rationale "fragile" ; j:about ex:svc ; j:basedOn ex:incident1 .`;
    const r = await runShacl(data, shapes);
    expect(r.ok).toBe(true);
  });
});
