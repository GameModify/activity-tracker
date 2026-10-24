import { contentFiles } from './content-build.ts';
import { sitePattern } from './sites.ts';
import { settings } from './model.ts';
import { selectedPatterns, selectedSite, exclusions } from './site-selection.ts';
async function selectedSites(): Promise<string[]> {
  return selectedPatterns('interaction_sites');
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
    js: contentFiles('interaction-content'),
    excludeMatches: exclusions(await settings(), 'interaction_sites'),
    allFrames: false,
    runAt: 'document_idle',
    persistAcrossSessions: true,
  };
  if (exists) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

export async function inspectInteractions(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.incognito || !selectedSite(await settings(), 'interaction_sites', tab.url ?? '')) return;
  if (!(await chrome.permissions.contains({ origins: [sitePattern(tab.url ?? '') ?? ''] }))) return;
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: contentFiles('interaction-content'),
  });
}
