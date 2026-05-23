import { describe, it, expect, beforeEach } from 'vitest';
import { getAdapter } from '../../src/storage/index.js';

import { kgCapture } from '../../src/tools/kg-capture.js';

const client = getAdapter();

async function reset(): Promise<void> {
  await client.update(`DROP SILENT GRAPH <kg:usage>`);
  await client.update(`CREATE SILENT GRAPH <kg:usage>`);
}

async function captureCount(): Promise<number> {
  const r = await client.select(
    `PREFIX pred: <https://industriagents.com/predicate/meta#>
     SELECT (COUNT(*) AS ?n) WHERE {
       GRAPH <kg:usage> { ?c a pred:ToolCall }
     }`,
  );
  return parseInt(r.results.bindings[0]!.n!.value, 10);
}

describe('kg_capture', () => {
  beforeEach(async () => { await reset(); });

  it('writes one ToolCall block per invocation', async () => {
    const result = await kgCapture(client, {
      toolName: 'Read',
      input: { file_path: '/foo.ts' },
      output: { content: 'line 1\nline 2' },
      sessionId: 'ses-test',
      phase: 'post',
    });
    expect(result.captureId).toMatch(/^urn:predicate:capture:/);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(await captureCount()).toBe(1);
  });

  it('truncates input and output to PREDICATE_CAPTURE_TRUNCATE chars', async () => {
    const orig = process.env['PREDICATE_CAPTURE_TRUNCATE'];
    process.env['PREDICATE_CAPTURE_TRUNCATE'] = '50';
    try {
      const longString = 'x'.repeat(200);
      const result = await kgCapture(client, {
        toolName: 'Read',
        input: { data: longString },
        output: { data: longString },
        phase: 'post',
      });
      const stored = await client.select(
        `PREFIX pred: <https://industriagents.com/predicate/meta#>
         SELECT ?input ?output WHERE {
           GRAPH <kg:usage> {
             <${result.captureId}> pred:toolInput ?input ;
                                   pred:toolOutput ?output .
           }
         }`,
      );
      const inputStr = stored.results.bindings[0]!.input!.value;
      const outputStr = stored.results.bindings[0]!.output!.value;
      expect(inputStr.length).toBeLessThan(longString.length);
      expect(inputStr).toContain('truncated');
      expect(outputStr.length).toBeLessThan(longString.length);
      expect(outputStr).toContain('truncated');
    } finally {
      if (orig !== undefined) process.env['PREDICATE_CAPTURE_TRUNCATE'] = orig;
      else delete process.env['PREDICATE_CAPTURE_TRUNCATE'];
    }
  });

  it('omits toolOutput when output is undefined (pre-phase)', async () => {
    const result = await kgCapture(client, {
      toolName: 'Edit',
      input: { file_path: '/x.ts' },
      phase: 'pre',
    });
    const r = await client.select(
      `PREFIX pred: <https://industriagents.com/predicate/meta#>
       SELECT (BOUND(?o) AS ?hasOutput) WHERE {
         GRAPH <kg:usage> {
           <${result.captureId}> pred:phase "pre" .
           OPTIONAL { <${result.captureId}> pred:toolOutput ?o }
         }
       }`,
    );
    expect(r.results.bindings[0]!.hasOutput!.value).toBe('false');
  });

  it('returns distinct captureIds for back-to-back calls', async () => {
    const r1 = await kgCapture(client, { toolName: 'Read', phase: 'post' });
    const r2 = await kgCapture(client, { toolName: 'Read', phase: 'post' });
    expect(r1.captureId).not.toBe(r2.captureId);
    expect(await captureCount()).toBe(2);
  });
});
