import { z } from 'zod';
import { collectorDiagnosticSchema } from '../src/domain/contracts.ts';
import type { CollectorDiagnostic } from '../src/domain/contracts.ts';
import { settings } from './model.ts';
import { deliverDiagnostic } from './http.ts';
const messageSchema = z.object({
  type: z.literal('collector-diagnostic'),
  diagnostic: collectorDiagnosticSchema,
});
export async function readCollectorDiagnostics(): Promise<CollectorDiagnostic[]> {
  const saved = (await chrome.storage.local.get('collector_diagnostics')).collector_diagnostics;
  return collectorDiagnosticSchema.array().safeParse(saved).data ?? [];
}
export async function saveCollectorDiagnostic(item: CollectorDiagnostic): Promise<void> {
  const diagnostics = await readCollectorDiagnostics();
  await chrome.storage.local.set({ collector_diagnostics: [item, ...diagnostics].slice(0, 30) });
  const config = await settings();
  if (config.enabled && config.token)
    await deliverDiagnostic(item, config.token).catch(() => undefined);
}
export function diagnosticCommand(
  value: unknown,
  sender: Pick<chrome.runtime.MessageSender, 'id' | 'url'> & { tab?: { incognito: boolean } },
  reply: (result: { ok: boolean }) => void,
): boolean {
  const input = messageSchema.safeParse(value);
  if (!input.success || sender.id !== chrome.runtime.id || !sender.tab || sender.tab.incognito)
    return false;
  const item = { ...input.data.diagnostic, origin: URL.parse(sender.url ?? '')?.origin ?? '' };
  void saveCollectorDiagnostic(item)
    .then(() => {
      reply({ ok: true });
    })
    .catch(() => {
      reply({ ok: false });
    });
  return true;
}
