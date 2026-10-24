import { z } from 'zod';
import { validFolder } from './paths.ts';
export const resourceSchema = z.object({
  website: z.string().max(253).optional(),
  project: z.string().trim().min(1).max(100).optional(),
  resource_id: z.string().max(1000).optional(),
  resource_kind: z.enum(['app', 'document', 'game', 'voice']).optional(),
});
export const observationSchema = z.object({
  web_enabled: z.boolean().optional(),
  media_creator: z.string().max(200).optional(),
  media_id: z.string().max(100).optional(),
  collector_version: z.string().max(30).optional(),
  recording: z.boolean().optional(),
  chatgpt_project: z
    .object({ id: z.string().regex(/^g-p-[a-f0-9]{32}$/), name: z.string().trim().min(1).max(100) })
    .optional(),
  fullscreen: z.boolean().optional(),
  game_candidate: z.boolean().optional(),
  monitor: z.enum(['primary', 'secondary']).optional(),
  event_id: z.uuid(),
  channel: z.string().min(1).max(120),
  timestamp: z.number().int().positive(),
  source: z.enum(['windows', 'chrome']),
  kind: z.enum(['focus', 'media', 'voice']),
  app: z.string().max(200),
  title: z.string().max(500),
  url: z.string().max(2048),
  active: z.boolean(),
  playing: z.boolean(),
  voice_connected: z.boolean().optional(),
  media_count: z.number().int().min(0).max(1000).optional(),
  position_seconds: z.number().nonnegative().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  interaction_at: z.number().int().nonnegative().optional(),
  idle_timeout_ms: z.literal(300000).optional(),
  website: resourceSchema.shape.website,
  resource_id: resourceSchema.shape.resource_id,
  resource_kind: resourceSchema.shape.resource_kind,
  idle_ms: z.number().int().nonnegative().max(4294967295),
});
export const ruleSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean(),
    field: z.enum([
      'app',
      'title',
      'url',
      'host',
      'kind',
      'resource_id',
      'media_creator',
      'media_id',
    ]),
    operator: z.enum(['equals', 'contains', 'within']),
    value: z.string().trim().min(1).max(200),
    activity: z.string().trim().min(1).max(80),
    scope: z.enum(['focus', 'media', 'voice']).optional(),
    project: resourceSchema.shape.project,
    priority: z.number().int().min(0).max(1000),
  })
  .refine(
    (rule) =>
      rule.operator !== 'within' || (rule.field === 'resource_id' && validFolder(rule.value)),
    'Для правила папки нужен полный путь Windows',
  );
export const intervalSchema = resourceSchema.extend({
  app: z.string().optional(),
  id: z.uuid(),
  sequence: z.number().int().positive(),
  channel: z.string(),
  source: z.enum(['windows', 'chrome']),
  activity: z.string().nullable(),
  title: z.string(),
  start_at: z.number().int(),
  end_at: z.number().int(),
  rule_id: z.uuid().nullable(),
  closed: z.boolean(),
});
export const intervalPageSchema = z.object({
  api_version: z.literal(1),
  device_id: z.uuid(),
  cursor: z.number().int().nonnegative(),
  has_more: z.boolean(),
  intervals: intervalSchema.array(),
});
export type Observation = z.infer<typeof observationSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type ActivityInterval = z.infer<typeof intervalSchema>;
export type IntervalPage = z.infer<typeof intervalPageSchema>;

export const collectorDiagnosticSchema = z.object({
  id: z.uuid(),
  timestamp: z.number().int().positive(),
  severity: z.enum(['info', 'error']),
  version: z.string().max(30),
  message: z.string().max(1000),
  script: z.string().max(100),
  origin: z.string().max(300),
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
});
export type CollectorDiagnostic = z.infer<typeof collectorDiagnosticSchema>;

export const browserPreferencesSchema = z.object({
  science_chat_id: z
    .string()
    .regex(/^(?:-?\d{1,20})?$/)
    .default(''),
});
export type BrowserPreferences = z.infer<typeof browserPreferencesSchema>;
