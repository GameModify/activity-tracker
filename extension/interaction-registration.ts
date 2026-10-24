import { settings } from './model.ts';
import { sitePattern } from './sites.ts';
async function selectedSites(): Promise<string[]> {
  const config = await settings(),
    sites: string[] = [];
  if (!config.enabled) return sites;
  for (const site of new Set(config.interaction_sites))
    if (sitePattern(site) === site && (await chrome.permissions.contains({ origins: [site] })))
      sites.push(site);
  return sites;
}
export async function registerInteractions(): Promise<void> {
  const sites = await selectedSites();
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: ['interaction'] });
  const exists = registered.some((script) => script.id === 'interaction');
  if (!sites.length) {
    if (exists) await chrome.scripting.unregisterContentScripts({ ids: ['interaction'] });
    return;
  }
  const script: chrome.scripting.RegisteredContentScript = {
    id: 'interaction',
    matches: sites,
    js: ['interaction-content.js'],
    allFrames: false,
    runAt: 'document_idle',
    persistAcrossSessions: true,
  };
  if (exists) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

export async function inspectInteractions(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  const site = sitePattern(tab.url ?? '');
  if (tab.incognito || !site || !(await selectedSites()).includes(site)) return;
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: ['interaction-content.js'],
  });
}
