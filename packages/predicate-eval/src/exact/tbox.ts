import { OWL_HASKEY, RDF_TYPE, J_SINGLE_VALUED, J_VALID_FROM, J_VALID_TO, J_SOURCE_SCOPE } from './contract.js';

/**
 * Minimal Turtle TBox reader for the tiny, regular world.ttl fixtures.
 * Extracts exactly the two schema facts the exact baselines need:
 *   - owl:hasKey lists per class (which property is an identifying key), and
 *   - which properties are typed j:SingleValued.
 * Scope (documented limitations, all safe for the frozen fixtures): single-line
 * double-quoted literals only, no blank-node property lists, no base IRIs.
 */
export interface TBoxSchema {
  prefixes: Record<string, string>;
  /** class IRI -> key property IRIs from its owl:hasKey ( ... ) list. */
  keyedClasses: Map<string, string[]>;
  /** property IRIs declared `a j:SingleValued`. */
  singleValued: Set<string>;
  /** record-level valid-time start property (`a j:ValidFrom`), if declared. */
  validFromProp: string | null;
  /** record-level valid-time end property (`a j:ValidTo`), if declared. */
  validToProp: string | null;
  /** record-level scope property (`a j:SourceScope`), if declared. */
  scopeProp: string | null;
}

interface Token { kind: 'iri' | 'pname' | 'literal' | 'punct'; text: string }

function tokenize(stmt: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < stmt.length) {
    const c = stmt[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (c === '<') {
      const end = stmt.indexOf('>', i);
      if (end < 0) throw new Error(`unterminated IRI in TBox statement: ${stmt}`);
      out.push({ kind: 'iri', text: stmt.slice(i + 1, end) });
      i = end + 1;
    } else if (c === '"') {
      let j = i + 1;
      while (j < stmt.length && !(stmt[j] === '"' && stmt[j - 1] !== '\\')) j++;
      if (j >= stmt.length) throw new Error(`unterminated literal in TBox statement: ${stmt}`);
      // Skip any trailing lang tag / datatype; the parser never uses literals.
      let k = j + 1;
      while (k < stmt.length && !/[\s;,()]/.test(stmt[k]!)) k++;
      out.push({ kind: 'literal', text: stmt.slice(i + 1, j) });
      i = k;
    } else if (c === ';' || c === ',' || c === '(' || c === ')') {
      out.push({ kind: 'punct', text: c });
      i++;
    } else {
      let j = i;
      while (j < stmt.length && !/[\s;,()]/.test(stmt[j]!)) j++;
      out.push({ kind: 'pname', text: stmt.slice(i, j) });
      i = j;
    }
  }
  return out;
}

/** Split Turtle text into '.'-terminated statements (dot outside strings/IRIs). */
function splitStatements(ttl: string): string[] {
  const stmts: string[] = [];
  let buf = '';
  let inString = false;
  let inIri = false;
  for (let i = 0; i < ttl.length; i++) {
    const c = ttl[i]!;
    if (inString) {
      buf += c;
      if (c === '"' && ttl[i - 1] !== '\\') inString = false;
    } else if (inIri) {
      buf += c;
      if (c === '>') inIri = false;
    } else if (c === '"') { buf += c; inString = true; }
    else if (c === '<') { buf += c; inIri = true; }
    else if (c === '#') { while (i < ttl.length && ttl[i] !== '\n') i++; buf += '\n'; }
    else if (c === '.' && (i + 1 >= ttl.length || /\s/.test(ttl[i + 1]!))) {
      if (buf.trim()) stmts.push(buf.trim());
      buf = '';
    } else buf += c;
  }
  if (buf.trim()) stmts.push(buf.trim());
  return stmts;
}

export function parseTBoxSchema(ttl: string): TBoxSchema {
  const prefixes: Record<string, string> = {};
  const keyedClasses = new Map<string, string[]>();
  const singleValued = new Set<string>();
  let validFromProp: string | null = null;
  let validToProp: string | null = null;
  let scopeProp: string | null = null;

  const expand = (t: Token): string => {
    if (t.kind === 'iri') return t.text;
    if (t.kind !== 'pname') throw new Error(`expected IRI or prefixed name, got ${t.kind} "${t.text}"`);
    if (t.text === 'a') return RDF_TYPE;
    const m = /^([^:]*):(.*)$/.exec(t.text);
    if (!m) throw new Error(`not a prefixed name: "${t.text}"`);
    const ns = prefixes[m[1]!];
    if (ns === undefined) throw new Error(`undeclared prefix "${m[1]}" in "${t.text}"`);
    return ns + m[2]!;
  };

  for (const stmt of splitStatements(ttl)) {
    if (/^@prefix\b/i.test(stmt)) {
      const m = /^@prefix\s+([A-Za-z0-9_-]*):\s*<([^>]*)>\s*$/i.exec(stmt);
      if (!m) throw new Error(`unparseable @prefix statement: ${stmt}`);
      prefixes[m[1]!] = m[2]!;
      continue;
    }
    const tokens = tokenize(stmt);
    if (tokens.length < 3) continue;
    const subject = expand(tokens[0]!);

    // Split the remainder into ';'-separated predicate clauses.
    const clauses: Token[][] = [[]];
    for (const t of tokens.slice(1)) {
      if (t.kind === 'punct' && t.text === ';') clauses.push([]);
      else clauses[clauses.length - 1]!.push(t);
    }
    for (const clause of clauses) {
      if (clause.length < 2) continue;
      const pred = expand(clause[0]!);
      if (pred === RDF_TYPE) {
        for (const t of clause.slice(1)) {
          if (t.kind === 'punct') continue; // ',' separators
          const cls = expand(t);
          if (cls === J_SINGLE_VALUED) singleValued.add(subject);
          else if (cls === J_VALID_FROM) validFromProp = subject;
          else if (cls === J_VALID_TO) validToProp = subject;
          else if (cls === J_SOURCE_SCOPE) scopeProp = subject;
        }
      } else if (pred === OWL_HASKEY) {
        const keys: string[] = [];
        let inList = false;
        for (const t of clause.slice(1)) {
          if (t.kind === 'punct' && t.text === '(') { inList = true; continue; }
          if (t.kind === 'punct' && t.text === ')') { inList = false; continue; }
          if (t.kind === 'punct') continue;
          if (inList) keys.push(expand(t));
        }
        if (keys.length === 0) throw new Error(`owl:hasKey with empty key list on <${subject}>`);
        keyedClasses.set(subject, keys);
      }
    }
  }
  return { prefixes, keyedClasses, singleValued, validFromProp, validToProp, scopeProp };
}
