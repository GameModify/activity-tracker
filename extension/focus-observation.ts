import type { TabDetails } from './diagnostic-model.ts';
import { interactionStateSchema, interactionKey, chatSite } from './interaction-model.ts';
import { settings } from './model.ts';
import { sitePattern } from './sites.ts';
import { observation } from './observations.ts';
import { chatGPTUrl } from './chatgpt-page.ts';
async function selectedSite(url: string): Promise<boolean> {
  const site = sitePattern(url) ?? '';
  return (
    (await settings()).interaction_sites.includes(site) &&
    (await chrome.permissions.contains({ origins: [site] }))
  );
}
export async function focusObservation(tab: TabDetails, active: boolean) {
  const sample = await observation(tab, 'focus', active),
    selected = await selectedSite(tab.url ?? '');
  if (!selected && (!chatSite(tab.url ?? '') || chatGPTUrl(tab.url ?? ''))) return sample;
  const key = interactionKey(tab.id ?? -1);
  const state = interactionStateSchema.safeParse((await chrome.storage.session.get(key))[key]).data;
  const current =
    selected && state && state.url === tab.url && Date.now() - state.observed_at < 15000;
  return {
    ...sample,
    active: sample.active && Boolean(current && state.focused),
    interaction_at: current ? state.interaction_at : 0,
    chatgpt_project: current ? state.chatgpt_project : undefined,
    recording: Boolean(current && state.recording),
    idle_timeout_ms: 300000 as const,
  };
}
