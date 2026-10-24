import { inspectInteractions } from './interaction-registration.ts';
import { inspectTab } from './inspection.ts';
export async function restoreOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || tab.incognito || tab.discarded || !/^https?:/.test(tab.url ?? ''))
      continue;
    await Promise.allSettled([inspectTab(tab.id), inspectInteractions(tab.id)]);
  }
}
