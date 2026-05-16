import type { Rule } from './types.js';
import { r01 } from './r01-subclassof-transitivity.js';
import { r02 } from './r02-subpropertyof-transitivity.js';
import { r03 } from './r03-transitive-property.js';
import { r04 } from './r04-inverse-of.js';
import { r05 } from './r05-property-chain.js';
import { r06 } from './r06-domain.js';
import { r07 } from './r07-range.js';
import { r08 } from './r08-functional-sameas.js';
import { r09 } from './r09-inverse-functional.js';
import { r10 } from './r10-symmetric.js';
import { r12 } from './r12-equivalent-class.js';
import { r13 } from './r13-equivalent-property.js';
import { r14 } from './r14-has-key.js';
import { r15 } from './r15-type-propagation.js';
import { r16 } from './r16-subpropertyof-instance.js';

export const RULES: Rule[] = [
  r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r12, r13, r14, r15, r16,
];
export { r11 } from './r11-disjoint-with.js';
export type { Rule, RuleConfig } from './types.js';
