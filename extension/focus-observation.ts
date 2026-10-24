import type { TabDetails } from './diagnostic-model.ts';
import { interactionStateSchema, interactionKey, chatSite } from './interaction-model.ts';
import type { InteractionState } from './interaction-model.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { settings } from './model.ts';
import { includesSite, sitePattern } from './sites.ts';
import { selectedSite as configuredSite } from './site-selection.ts';
import { observation } from './observations.ts';
import { chatGPTUrl } from './chatgpt-page.ts';
async function selectedSite(url: string): Promise<boolean> {
  const site = sitePattern(url) ?? '';
  return (
    configuredSite(await settings(), 'interaction_sites', url) &&
    (await chrome.permissions.contains({ origins: [site] }))
  );
}
async function currentState(
  tab: TabDetails,
  selected: boolean,
): Promise<InteractionState | undefined> {
  if (!selected) return undefined;
  const key = interactionKey(tab.id ?? -1);
  const state = interactionStateSchema.safeParse((await chrome.storage.session.get(key))[key]).data;
  const age = Date.now() - (state?.observed_at ?? 0);
  return state && state.url === tab.url && age >= 0 && age < 15000 ? state : undefined;
}
function readingObservation(sample: Observation, state?: InteractionState): Observation {
  return {
    ...sample,
    active: sample.active && (state?.focused ?? true),
    chatgpt_project: state?.chatgpt_project,
    recording: Boolean(state?.recording),
    web_enabled: true,
    interaction_at: state?.recording ? 0 : undefined,
  };
}
export async function focusObservation(tab: TabDetails, active: boolean): Promise<Observation> {
  const sample = await observation(tab, 'focus', active),
    selected = await selectedSite(tab.url ?? '');
  if (includesSite((await settings()).interaction_exclusions, tab.url ?? ''))
    return { ...sample, active: false, url: '', title: '' };
  if (!selected && (!chatSite(tab.url ?? '') || chatGPTUrl(tab.url ?? ''))) return sample;
  const state = await currentState(tab, selected);
  if ((chatGPTUrl(tab.url ?? '') || !chatSite(tab.url ?? '')) && !state?.interaction_at)
    return readingObservation(sample, state);
  return {
    ...sample,
    web_enabled: selected,
    active: sample.active && Boolean(state?.focused),
    interaction_at: state?.interaction_at ?? 0,
    chatgpt_project: state?.chatgpt_project,
    recording: Boolean(state?.recording),
    idle_timeout_ms: 300000,
  };
}
