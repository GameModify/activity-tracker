import { z } from 'zod';
import type { ZodType } from 'zod';
import { connectionSchema, trackingPreferencesSchema } from '../src/domain/contracts.ts';
const statusSchema = z.object({
  paused: z.boolean(),
  desktop_available: z.boolean(),
  browser_version: z.string().nullable().optional(),
});
let key = '';
export function initializeKey(): void {
  key =
    new URLSearchParams(location.hash.slice(1)).get('key') ??
    sessionStorage.getItem('tracker-control-key') ??
    '';
  history.replaceState(null, '', location.pathname);
  if (/^[a-f0-9]{64}$/.test(key)) sessionStorage.setItem('tracker-control-key', key);
}
export function setKey(value: string): void {
  key = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(value.trim());
  sessionStorage.setItem('tracker-control-key', key);
}
async function request<T>(
  route: string,
  schema: ZodType<T>,
  body?: { paused: boolean } | { idle_timeout_ms: number },
): Promise<T> {
  const response = await fetch('/v1' + route, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Открой настройки через значок в трее или введи ключ read.'
        : 'Не удалось выполнить действие',
    );
  return schema.parse(await response.json());
}
export const status = () => request('/status', statusSchema);
export const connection = () => request('/connection', connectionSchema);
export const preferences = () => request('/preferences', trackingPreferencesSchema);
export const pause = (paused: boolean) => request('/pause', statusSchema, { paused });
export const saveMinutes = (minutes: number) =>
  request('/preferences', trackingPreferencesSchema, { idle_timeout_ms: minutes * 60000 });
