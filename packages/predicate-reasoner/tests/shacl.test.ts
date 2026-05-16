import { describe, it, expect } from 'vitest';
import { runShacl } from '../src/shacl.js';

const SHAPES_TTL = `
  @prefix sh:  <http://www.w3.org/ns/shacl#> .
  @prefix ex:  <https://ex/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

  ex:FileShape a sh:NodeShape ;
    sh:targetClass ex:File ;
    sh:property [
      sh:path ex:path ; sh:datatype xsd:string ;
      sh:minCount 1 ; sh:maxCount 1
    ] .
`;

describe('runShacl', () => {
  it('reports no violations when data conforms', async () => {
    const dataTtl = `
      @prefix ex: <https://ex/> .
      ex:f1 a ex:File ; ex:path "auth.ts" .
    `;
    const r = await runShacl(dataTtl, SHAPES_TTL);
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('reports a violation when sh:minCount is unmet', async () => {
    const dataTtl = `
      @prefix ex: <https://ex/> .
      ex:f2 a ex:File .
    `;
    const r = await runShacl(dataTtl, SHAPES_TTL);
    expect(r.ok).toBe(false);
    expect(r.violations[0]!.focusNode).toBe('https://ex/f2');
  });

  it('reports a violation when sh:maxCount is exceeded', async () => {
    const dataTtl = `
      @prefix ex: <https://ex/> .
      ex:f3 a ex:File ; ex:path "a.ts" , "b.ts" .
    `;
    const r = await runShacl(dataTtl, SHAPES_TTL);
    expect(r.ok).toBe(false);
  });
});
