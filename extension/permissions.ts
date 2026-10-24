import { updateSettings } from './model.ts';
import { exclusions } from './site-selection.ts';
import type { CollectorPurpose } from './site-selection.ts';
import { restoreCollector } from './collector-client.ts';
export async function grantSite(
  pattern: string,
  purpose: CollectorPurpose = 'sites',
): Promise<boolean> {
  if (!(await chrome.permissions.request({ origins: [pattern] }))) return false;
  await updateSettings((config) => ({
    [purpose]: [...new Set([...config[purpose], pattern])],
    [purpose === 'sites' ? 'media_exclusions' : 'interaction_exclusions']: exclusions(
      config,
      purpose,
    ).filter((site) => site !== pattern),
  }));
  const result = await restoreCollector();
  if (result.collector_error) throw new Error(result.collector_error);
  return true;
}
