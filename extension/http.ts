import type { CollectorDiagnostic } from '../src/domain/contracts.ts';
import { z } from 'zod';
import { browserPreferencesSchema } from '../src/domain/contracts.ts';
import type { BrowserPreferences } from '../src/domain/contracts.ts';
import { observationSchema } from '../src/domain/contracts.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { settings } from './model.ts';
const receiptSchema = z.object({ ok: z.literal(true), paused: z.boolean().default(false) });
export const deliverySchema = z.object({
  last_sent: z.number().default(0),
  connection_error: z.string().default(''),
  server_paused: z.boolean().default(false),
});
let sending: Promise<void> = Promise.resolve();
async function deliver(queue: Observation[], token: string): Promise<void> {
  if (!queue.length) return;
  const response = await fetch('http://127.0.0.1:3536/v1/observations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(queue.slice(0, 40)),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('Сервис отклонил запрос: ' + String(response.status));
  const receipt = receiptSchema.parse(await response.json());
  await chrome.storage.local.set({
    queue: queue.slice(40),
    connection_error: '',
    last_sent: Date.now(),
    server_paused: receipt.paused,
  });
}
async function flush(samples: Observation[]): Promise<void> {
  const config = await settings();
  if (!config.enabled || !/^[a-f0-9]{64}$/.test(config.token)) return;
  const saved: unknown = (await chrome.storage.local.get('queue')).queue;
  const queue = [...(observationSchema.array().safeParse(saved).data ?? []), ...samples]
    .filter((sample) => sample.timestamp > Date.now() - 3000000)
    .slice(-200);
  await chrome.storage.local.set({ queue });
  await deliver(queue, config.token);
}
export function send(samples: Observation[]): void {
  sending = sending
    .then(() => flush(samples))
    .catch(async (error: unknown) => {
      await chrome.storage.local.set({
        connection_error: error instanceof Error ? error.message : 'Не удалось отправить события',
      });
    });
}

export async function deliverDiagnostic(
  diagnostic: CollectorDiagnostic,
  token: string,
): Promise<void> {
  const response = await fetch('http://127.0.0.1:3536/v1/diagnostics', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(diagnostic),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('Не удалось передать диагностику');
}

export async function browserPreferencesRequest(
  input?: BrowserPreferences,
): Promise<BrowserPreferences> {
  const config = await settings();
  const response = await fetch('http://127.0.0.1:3536/v1/browser-preferences', {
    method: input ? 'PUT' : 'GET',
    headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' },
    body: input ? JSON.stringify(input) : undefined,
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok)
    throw new Error('Не удалось получить настройки чата. Проверь ключ и подключение.');
  return browserPreferencesSchema.parse(await response.json());
}
