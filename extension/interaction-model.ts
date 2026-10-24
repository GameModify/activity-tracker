import { observationSchema } from '../src/domain/contracts.ts';
import { z } from 'zod';
export const interactionMessageSchema = z.object({
  type: z.literal('interaction'),
  recording: z.boolean().optional(),
  chatgpt_project: observationSchema.shape.chatgpt_project,
  url: z.string().max(8192),
  interaction_at: z.number().int().nonnegative(),
  focused: z.boolean(),
});
export const interactionStateSchema = interactionMessageSchema.extend({ observed_at: z.number() });
export type InteractionState = z.infer<typeof interactionStateSchema>;
export type InteractionMessage = z.infer<typeof interactionMessageSchema>;
export function chatSite(url: string): boolean {
  const host = URL.parse(url)?.hostname ?? '';
  return /(^|\.)vk\.(com|ru)$|^web\.telegram\.org$|^(chatgpt\.com|chat\.openai\.com)$/i.test(host);
}
export function interactionKey(tab: number): string {
  return 'interaction:' + String(tab);
}
