import { updateSettings } from './model.ts';
import type { ExtensionSettings } from './model.ts';
import type { CollectorPurpose } from './site-selection.ts';
import { exclusions } from './site-selection.ts';
import { allSites, validPattern } from './sites.ts';
import { restoreCollector } from './collector-client.ts';
function selectionPatch(
  config: ExtensionSettings,
  site: string,
  purpose: CollectorPurpose,
  enabled: boolean,
): Partial<ExtensionSettings> {
  const key = purpose === 'sites' ? 'media_exclusions' : 'interaction_exclusions';
  const blocked = exclusions(config, purpose).filter((value) => value !== site);
  const selected = config[purpose].filter((value) => value !== site);
  return {
    [purpose]: enabled ? [...selected, site] : selected,
    [key]: enabled || allSites.includes(site) ? blocked : [...blocked, site],
  };
}
export async function setCollection(
  site: string,
  purpose: CollectorPurpose,
  enabled: boolean,
): Promise<void> {
  if (!validPattern(site)) throw new Error('Некорректный адрес сайта');
  if (enabled && !(await chrome.permissions.request({ origins: [site] }))) return;
  await updateSettings((config) => selectionPatch(config, site, purpose, enabled));
  await restoreCollector();
}
function allSitesPatch(config: ExtensionSettings): Partial<ExtensionSettings> {
  return {
    sites: [...new Set([...config.sites, ...allSites])],
    interaction_sites: [...new Set([...config.interaction_sites, ...allSites])],
    media_exclusions: config.media_exclusions.filter((site) => !allSites.includes(site)),
    interaction_exclusions: config.interaction_exclusions.filter(
      (site) => !allSites.includes(site),
    ),
  };
}
export async function grantAllSites(): Promise<boolean> {
  if (!(await chrome.permissions.request({ origins: allSites }))) return false;
  await updateSettings(allSitesPatch);
  await restoreCollector();
  return true;
}
export async function revokeSite(site: string): Promise<void> {
  if (!validPattern(site)) throw new Error('Некорректный адрес сайта');
  await updateSettings((config) => ({
    sites: config.sites.filter((value) => value !== site),
    interaction_sites: config.interaction_sites.filter((value) => value !== site),
    media_exclusions: [...new Set([...config.media_exclusions, site])],
    interaction_exclusions: [...new Set([...config.interaction_exclusions, site])],
  }));
  await chrome.permissions.remove({ origins: [site] });
  await restoreCollector();
}
