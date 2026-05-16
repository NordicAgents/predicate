export type TermType = 'uri' | 'literal' | 'bnode';

export interface Term {
  type: TermType;
  value: string;
  datatype?: string;
  'xml:lang'?: string;
}

export type Binding = Record<string, Term>;

export interface SelectResult {
  head: { vars: string[] };
  results: { bindings: Binding[] };
}

export interface AskResult {
  head: Record<string, never>;
  boolean: boolean;
}

export interface SparqlError extends Error {
  status: number;
  body: string;
}
