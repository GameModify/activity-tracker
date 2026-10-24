import { z } from 'zod';
export const mediaMessageSchema = z.object({
  type: z.literal('media'),
  position_seconds: z.number().nonnegative().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  playing: z.boolean(),
  media_count: z.number().int().nonnegative().max(1000),
  frames: z.url().array().max(50),
});
export const frameStatusSchema = mediaMessageSchema.omit({ type: true }).extend({
  tab_id: z.number().int(),
  frame_id: z.number().int(),
  frame_origin: z.string().optional(),
  title: z.string(),
  url: z.string(),
  observed_at: z.number(),
  started_at: z.number(),
});
export type MediaMessage = z.infer<typeof mediaMessageSchema>;
export type FrameStatus = z.infer<typeof frameStatusSchema>;
export function freshFrames(frames: FrameStatus[], now = Date.now()): FrameStatus[] {
  return frames.filter((frame) => now >= frame.observed_at && now - frame.observed_at < 15000);
}
export function playback(frames: FrameStatus[], now = Date.now()): FrameStatus[] {
  const active = freshFrames(frames, now).filter((frame) => frame.playing);
  return [...new Set(active.map((frame) => frame.tab_id))].flatMap((tab) => {
    const items = active.filter((frame) => frame.tab_id === tab);
    return items.sort((a, b) => a.started_at - b.started_at).slice(0, 1);
  });
}
export interface TabDetails {
  id?: number;
  title?: string;
  url?: string;
  incognito: boolean;
}
