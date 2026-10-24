import { requiresChatRule, vkChat } from './chat.ts';
import { withinFolder } from './paths.ts';
import { engaged } from './engagement.ts';
import type { Observation, Rule } from './contracts.ts';
function fieldValue(sample: Observation, field: Rule['field']): string {
  if (field !== 'host') return sample[field] ?? '';
  try {
    return new URL(sample.url).hostname;
  } catch {
    return '';
  }
}
export function matchingRule(sample: Observation, rules: Rule[]): Rule | undefined {
  return rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => {
      const actual = fieldValue(sample, rule.field).toLocaleLowerCase();
      const expected = rule.value.toLocaleLowerCase();
      if (rule.operator === 'within')
        return rule.field === 'resource_id' && withinFolder(actual, expected);
      return rule.operator === 'equals' ? actual === expected : actual.includes(expected);
    });
}
export function isTracked(sample: Observation): boolean {
  if (!sample.active) return false;
  if (sample.kind === 'voice') return sample.voice_connected === true;
  if (sample.kind === 'media') return sample.playing;
  if (sample.source === 'chrome' && chatResource(sample.url) && !sample.interaction_at)
    return false;
  return engaged(sample);
}
export function signature(sample: Observation, rule?: Rule): string {
  return [
    sample.source,
    sample.kind,
    sample.app,
    sample.title,
    sample.url,
    sample.resource_id ?? '',
    rule?.id ?? '',
  ].join('\u001f');
}

function chatResource(value: string): boolean {
  const host = URL.parse(value)?.hostname ?? '';
  return /(^|\.)vk\.(com|ru)$|^web\.telegram\.org$/i.test(host);
}

export function shouldTrack(sample: Observation, rule?: Rule): boolean {
  return isTracked(sample) && (!requiresChatRule(sample) || Boolean(vkChat(sample.url) && rule));
}
