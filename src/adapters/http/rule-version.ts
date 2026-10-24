import { createHash } from 'node:crypto';
import type { Rule } from '../../domain/contracts.ts';
export function ruleVersion(rules: Rule[]): string {
  return '"' + createHash('sha256').update(JSON.stringify(rules)).digest('hex') + '"';
}
