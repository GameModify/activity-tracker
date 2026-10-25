import type { Observation } from './contracts.ts';
import { assistantObservation } from './assistant.ts';
export function browserObservation(input: Observation): Observation {
  const sample = assistantObservation(input);
  if (sample.source !== 'chrome' || sample.kind !== 'focus' || !sample.web_enabled) return sample;
  const url = URL.parse(sample.url);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return sample;
  return { ...sample, website: url.hostname };
}
export function websiteObservation(sample: Observation): Observation | undefined {
  if (sample.source !== 'chrome' || sample.kind !== 'focus') return undefined;
  const url = URL.parse(sample.url);
  const allowed = sample.web_enabled && url && ['http:', 'https:'].includes(url.protocol);
  return {
    ...sample,
    channel: sample.channel + ':web',
    title: allowed ? url.hostname : '',
    resource_id: allowed ? 'website:' + url.hostname : '',
    resource_kind: 'app',
    website: allowed ? url.hostname : undefined,
    recording: false,
    interaction_at: undefined,
    chatgpt_project: undefined,
    active: Boolean(allowed && (sample.web_active ?? sample.active)),
  };
}
export function isWebsiteObservation(sample: Observation): boolean {
  return sample.source === 'chrome' && sample.channel.endsWith(':focus:web');
}
export function webActivity(sample: Observation): string | undefined {
  return sample.source === 'chrome' && sample.kind === 'focus' && sample.web_enabled
    ? 'web'
    : undefined;
}
