import { assistantActivity } from './assistant.ts';
import { isWebsiteObservation } from './browser.ts';
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
    .filter((rule) => rule.enabled && (!rule.scope || rule.scope === sample.kind))
    .sort((a, b) => ruleRank(b, sample.kind) - ruleRank(a, sample.kind))
    .find((rule) => {
      const actual = ruleValue(rule.field, fieldValue(sample, rule.field));
      const expected = ruleValue(rule.field, rule.value);
      if (rule.operator === 'within')
        return rule.field === 'resource_id' && withinFolder(actual, expected);
      return rule.operator === 'equals' ? actual === expected : actual.includes(expected);
    });
}
export function isTracked(sample: Observation): boolean {
  if (!sample.active) return false;
  if (sample.kind === 'voice') return sample.voice_connected === true;
  if (sample.kind === 'media') return sample.playing;
  if (isWebsiteObservation(sample)) return engaged(sample);
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
    rule?.activity ?? '',
    rule?.project ?? '',
  ].join('\u001f');
}

function chatResource(value: string): boolean {
  const host = URL.parse(value)?.hostname ?? '';
  return /(^|\.)vk\.(com|ru)$|^web\.telegram\.org$/i.test(host);
}

export function shouldTrack(sample: Observation, rule?: Rule): boolean {
  const generic =
    sample.source === 'chrome' &&
    sample.kind === 'focus' &&
    sample.web_enabled &&
    !isWebsiteObservation(sample) &&
    !rule &&
    !assistantActivity(sample);
  return (
    !generic &&
    isTracked(sample) &&
    (isWebsiteObservation(sample) ||
      !requiresChatRule(sample) ||
      Boolean(vkChat(sample.url) && rule))
  );
}

export function ruleValue(field: Rule['field'], value: string): string {
  return field === 'media_id' ? value : value.toLocaleLowerCase();
}

function ruleRank(rule: Rule, kind: Observation['kind']): number {
  if (kind !== 'media' || rule.operator !== 'equals') return rule.priority;
  if (rule.field === 'media_id') return 10000 + rule.priority;
  return rule.field === 'media_creator' ? 5000 + rule.priority : rule.priority;
}
