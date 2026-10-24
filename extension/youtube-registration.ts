import { contentFiles } from './content-build.ts';
import { settings } from './model.ts';
import { selectedSite } from './site-selection.ts';
import { sitePattern } from './sites.ts';
const hosts = ['https://www.youtube.com/*', 'https://youtube.com/*'];
async function youtubeSites(): Promise<string[]> {
  const config = await settings(),
    sites: string[] = [];
  if (!config.enabled) return sites;
  for (const host of hosts)
    if (
      selectedSite(config, 'sites', host) &&
      (await chrome.permissions.contains({ origins: [host] }))
    )
      sites.push(host);
  return sites;
}
export async function registerYouTube(): Promise<void> {
  const matches = await youtubeSites();
  const exists =
    (await chrome.scripting.getRegisteredContentScripts({ ids: ['youtube-category'] })).length > 0;
  if (!matches.length) {
    if (exists) await chrome.scripting.unregisterContentScripts({ ids: ['youtube-category'] });
    return;
  }
  const script: chrome.scripting.RegisteredContentScript = {
    id: 'youtube-category',
    matches,
    js: contentFiles('youtube-content'),
    allFrames: false,
    runAt: 'document_idle',
    persistAcrossSessions: true,
  };
  if (exists) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}
export async function inspectYouTube(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId),
    pattern = sitePattern(tab.url ?? '');
  if (tab.incognito || !pattern || !(await youtubeSites()).includes(pattern)) return;
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    files: contentFiles('youtube-content'),
  });
}
