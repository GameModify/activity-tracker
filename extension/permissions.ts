import { settings } from './model.ts';
import { restoreCollector } from './collector-client.ts';
export async function grantSite(
  pattern: string,
  purpose: 'sites' | 'interaction_sites' = 'sites',
): Promise<boolean> {
  if (!(await chrome.permissions.request({ origins: [pattern] }))) return false;
  const config = await settings();
  await chrome.storage.local.set({ [purpose]: [...new Set([...config[purpose], pattern])] });
  const result = await restoreCollector();
  if (result.collector_error) throw new Error(result.collector_error);
  return true;
}
