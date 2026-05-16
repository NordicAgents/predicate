import { describe, it, expect } from 'vitest';
import { SparqlClient } from '../../src/sparql/client.js';
import { loadConfig } from '../../src/config.js';
import { buildTools } from '../../src/tools/registry.js';

describe('kg_explain wired in MCP registry', () => {
  const tools = buildTools(new SparqlClient(loadConfig()));
  it('is no longer a stub', async () => {
    const explain = tools.find((t) => t.name === 'kg_explain')!;
    const result = (await explain.handler({
      subject: 'https://ex/Dog',
      predicate: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      object: { type: 'uri', value: 'https://ex/Animal' },
    })) as { provable: boolean };
    expect(typeof result.provable).toBe('boolean');
  });
});
