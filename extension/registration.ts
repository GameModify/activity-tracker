import { registerInteractions } from './interaction-registration.ts';
import { settings } from './model.ts';
import { exclusions, selectedPatterns } from './site-selection.ts';
export async function grantedSites(): Promise<string[]> {
  return selectedPatterns('sites');
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
    js: ['content-diagnostics.js', 'content.js'],
    excludeMatches: exclusions(await settings(), 'sites'),
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
