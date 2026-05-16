const ILLEGAL_IRI = /[\s<>"{}|^`\\]/;

export function escapeIRI(iri: string): string {
  if (ILLEGAL_IRI.test(iri)) {
    throw new Error(`Illegal characters in IRI: ${JSON.stringify(iri)}`);
  }
  return `<${iri}>`;
}

export function escapeLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}
