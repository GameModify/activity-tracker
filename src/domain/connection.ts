import { z } from 'zod';
export const connectionSchema = z.object({
  endpoint: z.url(),
  read: z.string().regex(/^[a-f0-9]{64}$/),
  ingest: z.string().regex(/^[a-f0-9]{64}$/),
  directory: z.string(),
});
export type ConnectionInformation = z.infer<typeof connectionSchema>;
