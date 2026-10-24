import type { ExtensionSettings } from './model.ts';
import type { TabDetails } from './diagnostic-model.ts';
import { sitePattern } from './sites.ts';
import { selectedSite } from './site-selection.ts';
import { chatSite, interactionKey, interactionStateSchema } from './interaction-model.ts';
import type { InteractionState } from './interaction-model.ts';
export interface InteractionDiagnostic {
  site: string;
  selected: boolean;
  permitted: boolean;
  state: InteractionState | undefined;
}
function freshState(
  value: unknown,
  url: string | undefined,
  now: number,
): InteractionState | undefined {
  const state = interactionStateSchema.safeParse(value).data;
  return state && state.url === url && now >= state.observed_at && now - state.observed_at < 15000
    ? state
    : undefined;
}
export async function readInteraction(
  tab: TabDetails | undefined,
  config: ExtensionSettings,
): Promise<InteractionDiagnostic | null> {
  const site = sitePattern(tab?.url ?? '');
  if (!tab || tab.incognito || !site) return null;
  const selected = selectedSite(config, 'interaction_sites', tab.url ?? '');
  if (!chatSite(tab.url ?? '') && !selected) return null;
  const key = interactionKey(tab.id ?? -1);
  const saved = await chrome.storage.session.get(key);
  return {
    site,
    selected,
    permitted: await chrome.permissions.contains({ origins: [site] }),
    state: freshState(saved[key], tab.url, Date.now()),
  };
}
