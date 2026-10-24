import type { Observation } from './contracts.ts';
import { assistantObservation } from './assistant.ts';
export function browserObservation(input: Observation): Observation {
  const sample = assistantObservation(input);
  if (sample.source !== 'chrome' || sample.kind !== 'focus' || !sample.web_enabled) return sample;
  const url = URL.parse(sample.url);
  if (!url || !['http:', 'https:'].includes(url.protocol)) return sample;
  return { ...sample, website: url.hostname };
}
export function webActivity(sample: Observation): string | undefined {
  return sample.source === 'chrome' && sample.kind === 'focus' && sample.web_enabled
    ? 'web'
    : undefined;
}
