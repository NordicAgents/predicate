import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SparqlClient } from 'predicate-mcp/src/sparql/client.js';
import { loadConfig } from 'predicate-mcp/src/config.js';
import { kgAssert } from 'predicate-mcp/src/tools/kg-assert.js';

const C = 'https://predicate.dev/codebase#';
const DOM = 'https://predicate.dev/codebase';
const ROOT = join(import.meta.dirname, '..', 'fixtures', 'demo-corpus');

function iriForFile(name: string): string { return `${DOM}/${name}`; }
function iriForFn(file: string, name: string): string { return `${DOM}/${file}#${name}`; }
function iriForEnv(name: string): string { return `${DOM}/env/${name}`; }

const importRE = /import\s+\{[^}]*\}\s+from\s+['"]\.\/([\w-]+)['"]/g;
const fnRE = /export\s+function\s+(\w+)\s*\(/g;
const envRE = /process\.env\.([A-Z0-9_]+)/g;

async function main(): Promise<void> {
  const client = new SparqlClient(loadConfig());
  const files = readdirSync(ROOT).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const path = join(ROOT, f);
    const src = readFileSync(path, 'utf8');
    const fileIri = iriForFile(f);

    await kgAssert(client, {
      subject: fileIri, predicate: `${C}path`,
      object: { type: 'literal', value: f },
      source: path, confidence: 1, method: 'fs-read',
    });
    await kgAssert(client, {
      subject: fileIri, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: { type: 'uri', value: `${C}File` },
      source: path, confidence: 1, method: 'fs-read',
    });

    for (const m of src.matchAll(importRE)) {
      await kgAssert(client, {
        subject: fileIri, predicate: `${C}imports`,
        object: { type: 'uri', value: iriForFile(`${m[1]}.ts`) },
        source: path, confidence: 0.95, method: 'regex-import',
      });
    }

    const declared = new Set<string>();
    for (const m of src.matchAll(fnRE)) {
      const fnIri = iriForFn(f, m[1]!);
      declared.add(m[1]!);
      await kgAssert(client, {
        subject: fnIri, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'uri', value: `${C}Function` },
        source: path, confidence: 1, method: 'regex-fn',
      });
      await kgAssert(client, {
        subject: fnIri, predicate: `${C}declaredIn`,
        object: { type: 'uri', value: fileIri },
        source: path, confidence: 1, method: 'regex-fn',
      });
    }

    for (const m of src.matchAll(envRE)) {
      const envIri = iriForEnv(m[1]!);
      await kgAssert(client, {
        subject: envIri, predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        object: { type: 'uri', value: `${C}EnvVar` },
        source: path, confidence: 1, method: 'regex-env',
      });
      for (const fn of declared) {
        await kgAssert(client, {
          subject: iriForFn(f, fn), predicate: `${C}reads`,
          object: { type: 'uri', value: envIri },
          source: path, confidence: 0.6, method: 'regex-env-near-fn',
        });
      }
    }
  }
  console.log('corpus loaded');
}

main().catch((e) => { console.error(e); process.exit(1); });
