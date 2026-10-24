import { z } from 'zod';
const evidenceSchema = z.object({
  available: z.boolean(),
  disconnect: z.boolean(),
  reconnect: z.boolean(),
});
type VoiceState = 'connected' | 'disconnected' | 'unknown';
function connectionState(evidence: z.infer<typeof evidenceSchema>): VoiceState {
  if (!evidence.available || evidence.reconnect) return 'disconnected';
  return evidence.disconnect ? 'connected' : 'unknown';
}
export const discordEvidenceSchema = evidenceSchema.transform((evidence) => ({
  state: connectionState(evidence),
}));
