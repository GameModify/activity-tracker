import { settings } from './model.ts';
import type { ExtensionSettings } from './model.ts';
import { includesSite, validPattern } from './sites.ts';
export type CollectorPurpose = 'sites' | 'interaction_sites';
export function exclusions(config: ExtensionSettings, purpose: CollectorPurpose): string[] {
  return purpose === 'sites' ? config.media_exclusions : config.interaction_exclusions;
}
export function selectedSite(
  config: ExtensionSettings,
  purpose: CollectorPurpose,
  url: string,
): boolean {
  return includesSite(config[purpose], url) && !includesSite(exclusions(config, purpose), url);
}
export async function selectedPatterns(purpose: CollectorPurpose): Promise<string[]> {
  const config = await settings(),
    result: string[] = [];
  if (!config.enabled) return result;
  for (const site of new Set(config[purpose]))
    if (validPattern(site) && (await chrome.permissions.contains({ origins: [site] })))
      result.push(site);
  return result;
}
