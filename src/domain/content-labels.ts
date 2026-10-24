import { z } from 'zod';
export const contentLabelSchema = z.object({
  aliases: z.string().min(1).max(80).array().max(100).default([]),
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  activity: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[a-f0-9]{6}$/i),
});
export const videoIdentitySchema = z.object({
  video_id: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  creator: z
    .string()
    .min(3)
    .max(200)
    .regex(/^\/(?:@[^/?#\s]+|channel\/[a-zA-Z0-9_-]+)$/u)
    .optional(),
});
export const videoChoiceSchema = videoIdentitySchema.extend({
  target: z.enum(['video', 'channel']),
  label_id: z.string().min(1).max(80).nullable(),
});
export const videoLabelsSchema = z.object({
  labels: contentLabelSchema.array().max(200),
  video_label: z.string().nullable(),
  channel_label: z.string().nullable(),
});
export type ContentLabel = z.infer<typeof contentLabelSchema>;
export type VideoIdentity = z.infer<typeof videoIdentitySchema>;
export type VideoChoice = z.infer<typeof videoChoiceSchema>;
export type VideoLabels = z.infer<typeof videoLabelsSchema>;
