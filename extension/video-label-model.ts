import { z } from 'zod';
import {
  videoIdentitySchema,
  videoChoiceSchema,
  videoLabelsSchema,
} from '../src/domain/contracts.ts';
export const videoLabelMessageSchema = z.object({
  type: z.literal('video-labels'),
  request_id: z.uuid(),
  input: videoIdentitySchema,
  choice: videoChoiceSchema.pick({ target: true, label_id: true }).optional(),
});
export const videoLabelReplySchema = z.object({
  type: z.literal('video-labels-result'),
  request_id: z.uuid(),
  state: videoLabelsSchema.optional(),
  error: z.string().max(300).optional(),
});
export type VideoLabelMessage = z.infer<typeof videoLabelMessageSchema>;
export type VideoLabelReply = z.infer<typeof videoLabelReplySchema>;
