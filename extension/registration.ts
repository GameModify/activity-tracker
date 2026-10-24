import { registerInteractions } from './interaction-registration.ts';
import { settings } from './model.ts';
import { sitePattern } from './sites.ts';
export async function grantedSites(): Promise<string[]> {
  const config = await settings();
  if (!config.enabled) return [];
  const granted: string[] = [];
  for (const site of new Set(config.sites)) {
    if (sitePattern(site) === site && (await chrome.permissions.contains({ origins: [site] })))
      granted.push(site);
  }
  return granted;
}
export async function registerSites(sites: string[]): Promise<void> {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: ['media'] });
  if (!sites.length) {
    if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: ['media'] });
    return;
  }
  const script: chrome.scripting.RegisteredContentScript = {
    id: 'media',
    matches: sites,
    js: ['content.js'],
    allFrames: true,
    runAt: 'document_idle',
    persistAcrossSessions: true,
    matchOriginAsFallback: true,
  };
  if (registered.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}
export async function reconcileSites(): Promise<string[]> {
  const sites = await grantedSites();
  await registerSites(sites);
  await registerInteractions();
  return sites;
}
