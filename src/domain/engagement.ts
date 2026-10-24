import type { Observation } from './contracts.ts';
export const interactionTimeout = 300000;
export function engaged(sample: Observation): boolean {
  if (sample.recording && sample.active) return true;
  if (sample.interaction_at !== undefined)
    return (
      sample.interaction_at > 0 &&
      sample.timestamp >= sample.interaction_at &&
      sample.timestamp - sample.interaction_at < interactionTimeout
    );
  return sample.idle_ms < (sample.idle_timeout_ms ?? 90000);
}
export function idleEnd(sample: Observation): number | undefined {
  if (sample.kind !== 'focus' || sample.recording) return undefined;
  if (sample.interaction_at !== undefined && !engaged(sample))
    return sample.interaction_at ? sample.interaction_at + interactionTimeout : sample.timestamp;
  if (sample.idle_ms >= (sample.idle_timeout_ms ?? 90000))
    return sample.timestamp - sample.idle_ms + (sample.idle_timeout_ms ?? 0);
  return undefined;
}
