import { describe, it, expect } from 'vitest';
import {
  ImportExtractor, FunctionDeclExtractor, EnvVarExtractor,
} from '../src/extractor.js';
import type { ResearchArtifact, SubQuestionIntent } from '../src/index.js';

function artifact(uri: string, content: string): ResearchArtifact {
  return { source: 'docs', uri, content, metadata: {} };
}

const C = 'https://predicate.dev/codebase';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

describe('ImportExtractor', () => {
  const e = new ImportExtractor();
  const intent: SubQuestionIntent = {
    kind: 'find-dependencies', payload: { symbol: 'x', transitive: true },
  };

  it('supports find-dependencies', () => {
    expect(e.supports(intent.kind)).toBe(true);
  });
  it('does NOT support find-callers', () => {
    expect(e.supports('find-callers')).toBe(false);
  });

  it('extracts :imports triples from "import {…} from \'./other\';"', () => {
    const a = artifact(
      'file:///root/auth.ts',
      "import { verifyJwt } from './jwt';\nexport function login() {}",
    );
    const ts = e.extract(a, intent);
    const importTriples = ts.filter((t) => t.predicate === `${C}#imports`);
    expect(importTriples).toHaveLength(1);
    expect(importTriples[0]!.subject).toBe(`${C}/auth.ts`);
    expect((importTriples[0]!.object as { value: string }).value).toBe(`${C}/jwt.ts`);
    expect(importTriples[0]!.confidence).toBe(0.95);
    expect(importTriples[0]!.method).toBe('regex-import');
  });

  it('also emits one :File rdf:type and one :path per file', () => {
    const a = artifact('file:///root/auth.ts', "import { x } from './y';");
    const ts = e.extract(a, intent);
    const types = ts.filter((t) => t.predicate === RDF_TYPE);
    const paths = ts.filter((t) => t.predicate === `${C}#path`);
    expect(types).toHaveLength(1);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.object).toEqual({ type: 'literal', value: 'auth.ts' });
  });
});

describe('FunctionDeclExtractor', () => {
  const e = new FunctionDeclExtractor();
  const intent: SubQuestionIntent = {
    kind: 'find-symbol-in-file', payload: { symbol: 'login' },
  };

  it('supports find-symbol-in-file and find-dependencies', () => {
    expect(e.supports('find-symbol-in-file')).toBe(true);
    expect(e.supports('find-dependencies')).toBe(true);
    expect(e.supports('unknown')).toBe(false);
  });

  it('emits rdf:type :Function and :declaredIn per exported function', () => {
    const a = artifact(
      'file:///root/auth.ts',
      'export function login() {}\nexport function logout() {}',
    );
    const ts = e.extract(a, intent);
    const fnIris = new Set(ts
      .filter((t) => t.predicate === RDF_TYPE)
      .map((t) => t.subject));
    expect(fnIris).toEqual(new Set([`${C}/auth.ts#login`, `${C}/auth.ts#logout`]));
    const declared = ts.filter((t) => t.predicate === `${C}#declaredIn`);
    expect(declared).toHaveLength(2);
    expect(ts.every((t) => t.confidence === 1)).toBe(true);
  });
});

describe('EnvVarExtractor', () => {
  const e = new EnvVarExtractor();
  const intent: SubQuestionIntent = {
    kind: 'find-readers-of', payload: { envVar: 'JWT_SECRET' },
  };

  it('supports find-readers-of and find-dependencies', () => {
    expect(e.supports('find-readers-of')).toBe(true);
    expect(e.supports('find-dependencies')).toBe(true);
  });

  it('emits rdf:type :EnvVar for each env var seen', () => {
    const a = artifact(
      'file:///root/jwt.ts',
      'export function verifyJwt() { return process.env.JWT_SECRET }',
    );
    const ts = e.extract(a, intent);
    const envIris = ts
      .filter((t) => t.predicate === RDF_TYPE
        && typeof t.object === 'object' && t.object.value === `${C}#EnvVar`)
      .map((t) => t.subject);
    expect(envIris).toContain(`${C}/env/JWT_SECRET`);
  });

  it('emits :reads from each exported function to env vars in the same file (heuristic, conf 0.6)', () => {
    const a = artifact(
      'file:///root/jwt.ts',
      'export function verifyJwt() { return process.env.JWT_SECRET }',
    );
    const ts = e.extract(a, intent);
    const reads = ts.filter((t) => t.predicate === `${C}#reads`);
    expect(reads).toHaveLength(1);
    expect(reads[0]!.subject).toBe(`${C}/jwt.ts#verifyJwt`);
    expect((reads[0]!.object as { value: string }).value).toBe(`${C}/env/JWT_SECRET`);
    expect(reads[0]!.confidence).toBe(0.6);
    expect(reads[0]!.method).toBe('regex-env-near-fn');
  });
});
