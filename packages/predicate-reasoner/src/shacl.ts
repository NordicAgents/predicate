import { Parser, Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import type { ShaclViolation } from './types.js';

export interface ShaclResult {
  ok: boolean;
  violations: ShaclViolation[];
}

function parseTurtle(ttl: string): Store {
  const store = new Store();
  store.addQuads(new Parser().parse(ttl));
  return store;
}

export async function runShacl(dataTtl: string, shapesTtl: string): Promise<ShaclResult> {
  const data = parseTurtle(dataTtl);
  const shapes = parseTurtle(shapesTtl);
  const validator = new SHACLValidator(shapes, {});
  const report = validator.validate(data);
  const violations: ShaclViolation[] = report.results.map((r) => ({
    focusNode: r.focusNode?.value ?? '',
    resultPath: r.path?.value,
    message: r.message?.[0]?.value ?? '(no message)',
    sourceShape: r.sourceShape?.value,
  }));
  return { ok: report.conforms, violations };
}
