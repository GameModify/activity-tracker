import type { Observation, Rule } from '../domain/contracts.ts';
import { matchingRule } from '../domain/classify.ts';
export function desktopActivity(sample: Observation, rules: Rule[]): Observation {
  const rule = matchingRule(sample, rules);
  if (sample.resource_kind === 'game' || rule?.activity !== 'games') return sample;
  return {
    ...sample,
    resource_kind: 'game',
    resource_id: sample.resource_id ?? 'app:' + sample.app.toLowerCase(),
    title: rule.name,
    game_candidate: false,
  };
}
