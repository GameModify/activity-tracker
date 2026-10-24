import type { TabDetails } from './diagnostic-model.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { mediaTitle } from './media-title.ts';
import { safeUrl, settings } from './model.ts';
function details(tab: TabDetails, kind: Observation['kind']) {
  const title =
    kind === 'media' ? mediaTitle(tab.title ?? '', tab.url ?? '') : (tab.title ?? '').slice(0, 500);
  return {
    app: 'chrome.exe',
    title,
    url: safeUrl(tab.url ?? ''),
    idle_timeout_ms: 300000 as const,
  };
}
export async function observation(
  tab: TabDetails,
  kind: Observation['kind'],
  active: boolean,
): Promise<Observation> {
  const config = await settings(),
    state = await chrome.idle.queryState(300);
  const suffix = kind === 'media' ? ':' + String(tab.id) : '';
  return {
    ...details(tab, kind),
    event_id: crypto.randomUUID(),
    channel: 'chrome:' + config.instance + ':' + kind + suffix,
    timestamp: Date.now(),
    source: 'chrome',
    kind,
    active: active && state !== 'locked' && !tab.incognito,
    playing: kind === 'media' && active,
    idle_ms: state === 'active' ? 0 : 300000,
  };
}
