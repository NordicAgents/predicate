import { getAdapter } from 'predicate-mcp/src/storage/index.js';
import { kgAsk } from 'predicate-mcp/src/tools/kg-ask.js';

const C = 'https://predicate.dev/codebase#';

const questions: { q: string; sparql: string }[] = [
  {
    q: 'What does auth.ts depend on (1 hop)?',
    sparql: `
      PREFIX c: <${C}>
      SELECT ?dep WHERE { GRAPH <kg:abox> {
        <https://predicate.dev/codebase/auth.ts> c:imports ?dep } }
    `,
  },
  {
    q: 'Transitive deps of auth.ts via the inferred graph',
    sparql: `
      PREFIX c: <${C}>
      SELECT ?dep WHERE {
        { GRAPH <kg:abox> { <https://predicate.dev/codebase/auth.ts> c:imports ?dep } }
        UNION
        { GRAPH <kg:inferred> { <https://predicate.dev/codebase/auth.ts> c:dependsOn ?dep } }
      }
    `,
  },
  {
    q: 'Which functions in jwt.ts read which env vars?',
    sparql: `
      PREFIX c: <https://predicate.dev/codebase#>
      SELECT ?fn ?env WHERE { GRAPH <kg:abox> {
        ?fn c:declaredIn <https://predicate.dev/codebase/jwt.ts> ;
            c:reads ?env } }
    `,
  },
];

async function main(): Promise<void> {
  const client = getAdapter();
  for (const { q, sparql } of questions) {
    const r = await kgAsk(client, { question: q, sparql });
    console.log(`\nQ: ${q}\n   rows=${r.rowCount} truncated=${r.truncated}`);
    for (const b of r.bindings) {
      console.log('   ', Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
