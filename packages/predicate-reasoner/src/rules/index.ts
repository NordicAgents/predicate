import type { Rule } from './types.js';
import { r01 } from './r01-subclassof-transitivity.js';
import { r02 } from './r02-subpropertyof-transitivity.js';
import { r03 } from './r03-transitive-property.js';
import { r04 } from './r04-inverse-of.js';
import { r05 } from './r05-property-chain.js';

export const RULES: Rule[] = [r01, r02, r03, r04, r05];

export type { Rule, RuleConfig } from './types.js';
