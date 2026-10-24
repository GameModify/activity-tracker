import { z } from 'zod';
export const settingsSchema = z.object({
  token: z.string().default(''),
  enabled: z.boolean().default(false),
  instance: z.string().default(''),
  sites: z.string().array().default([]),
  interaction_sites: z.string().array().default([]),
  media_exclusions: z.string().array().default([]),
  interaction_exclusions: z.string().array().default([]),
});
export type ExtensionSettings = z.infer<typeof settingsSchema>;
export async function settings(): Promise<ExtensionSettings> {
  const data: unknown = await chrome.storage.local.get([
    'token',
    'enabled',
    'instance',
    'sites',
    'interaction_sites',
    'media_exclusions',
    'interaction_exclusions',
  ]);
  const parsed = settingsSchema.parse(data);
  if (parsed.instance) return parsed;
  parsed.instance = crypto.randomUUID();
  await chrome.storage.local.set({ instance: parsed.instance });
  return parsed;
}
export function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const dialog = /(^|\.)vk\.(com|ru)$/.test(url.hostname) ? url.searchParams.get('sel') : null;
    return url.origin + url.pathname + (dialog ? '?sel=' + encodeURIComponent(dialog) : '');
  } catch {
    return '';
  }
}

let saving: Promise<void> = Promise.resolve();
export function updateSettings(
  change: (config: ExtensionSettings) => Partial<ExtensionSettings>,
): Promise<void> {
  const operation = saving.then(async () => {
    await chrome.storage.local.set(change(await settings()));
  });
  saving = operation.catch(() => undefined);
  return operation;
}
