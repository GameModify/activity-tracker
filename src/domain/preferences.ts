import { z } from 'zod';
import type { Observation } from './contracts.ts';
export const idleTimeoutSchema = z.number().int().min(60000).max(1800000).multipleOf(60000);
export const trackingPreferencesSchema = z.object({
  idle_timeout_ms: idleTimeoutSchema.default(300000),
});
export type TrackingPreferences = z.infer<typeof trackingPreferencesSchema>;
export function applyIdleTimeout(
  sample: Observation,
  preferences: TrackingPreferences,
): Observation {
  return sample.kind === 'focus'
    ? { ...sample, idle_timeout_ms: preferences.idle_timeout_ms }
    : sample;
}
