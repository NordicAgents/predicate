import { basename } from 'node:path';
import type { CandidateTriple, ResearchArtifact, SubQuestionIntent } from './types.js';

const C = 'https://industriagents.com/predicate/codebase';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function fileIri(uri: string): { iri: string; basename: string } {
  const path = uri.replace(/^file:\/\//, '');
  const name = basename(path);
  return { iri: `${C}/${name}`, basename: name };
}

function fnIri(fileUri: string, sym: string): string {
  const { iri } = fileIri(fileUri);
  return `${iri}#${sym}`;
}

function envIri(name: string): string {
  return `${C}/env/${name}`;
}

export interface Extractor {
  readonly name: string;
  supports(kind: SubQuestionIntent['kind']): boolean;
  extract(artifact: ResearchArtifact, intent: SubQuestionIntent): CandidateTriple[];
}

const IMPORT_RE = /import\s+\{[^}]*\}\s+from\s+['"]\.\/([\w-]+)['"]/g;
const FN_RE     = /export\s+function\s+(\w+)\s*\(/g;
const ENV_RE    = /process\.env\.([A-Z0-9_]+)/g;

export class ImportExtractor implements Extractor {
  readonly name = 'ImportExtractor';
  supports(kind: SubQuestionIntent['kind']): boolean {
    return kind === 'find-dependencies';
  }
  extract(artifact: ResearchArtifact, _intent: SubQuestionIntent): CandidateTriple[] {
    const { iri: fIri, basename: bn } = fileIri(artifact.uri);
    const out: CandidateTriple[] = [
      {
        subject: fIri, predicate: RDF_TYPE,
        object: { type: 'uri', value: `${C}#File` },
        source: artifact.uri, confidence: 1, method: 'fs-read',
      },
      {
        subject: fIri, predicate: `${C}#path`,
        object: { type: 'literal', value: bn },
        source: artifact.uri, confidence: 1, method: 'fs-read',
      },
    ];
    for (const m of artifact.content.matchAll(IMPORT_RE)) {
      const target = `${C}/${m[1]!}.ts`;
      out.push({
        subject: fIri, predicate: `${C}#imports`,
        object: { type: 'uri', value: target },
        source: artifact.uri, confidence: 0.95, method: 'regex-import',
      });
    }
    return out;
  }
}

export class FunctionDeclExtractor implements Extractor {
  readonly name = 'FunctionDeclExtractor';
  supports(kind: SubQuestionIntent['kind']): boolean {
    return kind === 'find-symbol-in-file' || kind === 'find-dependencies';
  }
  extract(artifact: ResearchArtifact, _intent: SubQuestionIntent): CandidateTriple[] {
    const { iri: fIri } = fileIri(artifact.uri);
    const out: CandidateTriple[] = [];
    for (const m of artifact.content.matchAll(FN_RE)) {
      const sym = m[1]!;
      const symIri = fnIri(artifact.uri, sym);
      out.push({
        subject: symIri, predicate: RDF_TYPE,
        object: { type: 'uri', value: `${C}#Function` },
        source: artifact.uri, confidence: 1, method: 'regex-fn',
      });
      out.push({
        subject: symIri, predicate: `${C}#declaredIn`,
        object: { type: 'uri', value: fIri },
        source: artifact.uri, confidence: 1, method: 'regex-fn',
      });
    }
    return out;
  }
}

export class EnvVarExtractor implements Extractor {
  readonly name = 'EnvVarExtractor';
  supports(kind: SubQuestionIntent['kind']): boolean {
    return kind === 'find-readers-of' || kind === 'find-dependencies';
  }
  extract(artifact: ResearchArtifact, _intent: SubQuestionIntent): CandidateTriple[] {
    const out: CandidateTriple[] = [];
    const fns: string[] = [];
    for (const m of artifact.content.matchAll(FN_RE)) fns.push(m[1]!);
    const envs: string[] = [];
    for (const m of artifact.content.matchAll(ENV_RE)) envs.push(m[1]!);
    for (const env of envs) {
      out.push({
        subject: envIri(env), predicate: RDF_TYPE,
        object: { type: 'uri', value: `${C}#EnvVar` },
        source: artifact.uri, confidence: 1, method: 'regex-env',
      });
      for (const fn of fns) {
        out.push({
          subject: fnIri(artifact.uri, fn), predicate: `${C}#reads`,
          object: { type: 'uri', value: envIri(env) },
          source: artifact.uri, confidence: 0.6, method: 'regex-env-near-fn',
        });
      }
    }
    return out;
  }
}
