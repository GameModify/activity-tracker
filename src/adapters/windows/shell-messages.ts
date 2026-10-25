import { z } from 'zod';
export const shellCommandSchema = z.enum([
  'toggle',
  'website',
  'settings',
  'directory',
  'extension',
  'exit',
]);
export const shellEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('command'), command: shellCommandSchema }),
]);
export const shellUpdateSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state'), paused: z.boolean() }),
  z.object({ type: z.literal('stop') }),
]);
export const shellConfigurationSchema = z.object({
  assets: z.string(),
  paused: z.boolean(),
  port: z.number().int(),
});
export type ShellEvent = z.infer<typeof shellEventSchema>;
export type ShellUpdate = z.infer<typeof shellUpdateSchema>;
export type WorkerConfiguration = z.infer<typeof shellConfigurationSchema>;
