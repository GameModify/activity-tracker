import { z } from 'zod';
export const collectorStateSchema = z.object({
  collector_ready: z.boolean().default(false),
  collector_error: z.string().default(''),
  registered_sites: z.string().array().default([]),
});
export const collectorCommandSchema = z.object({
  type: z.literal('restore-media'),
  tab_id: z.number().int().nonnegative().optional(),
});
export type CollectorState = z.infer<typeof collectorStateSchema>;
export async function restoreCollector(tab_id?: number): Promise<CollectorState> {
  const response: unknown = await chrome.runtime.sendMessage({ type: 'restore-media', tab_id });
  return collectorStateSchema.parse(response);
}
