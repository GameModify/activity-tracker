import { idleTimeout } from './idle-timeout.ts';
import type { TabDetails } from './diagnostic-model.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { mediaTitle } from './media-title.ts';
import { safeUrl, settings } from './model.ts';
function details(tab: TabDetails, kind: Observation['kind'], timeout: number) {
  const title =
    kind === 'media' ? mediaTitle(tab.title ?? '', tab.url ?? '') : (tab.title ?? '').slice(0, 500);
  return {
    collector_version: chrome.runtime.getManifest().version,
    app: 'chrome.exe',
    title: tab.incognito ? '' : title,
    url: tab.incognito ? '' : safeUrl(tab.url ?? ''),
    idle_timeout_ms: timeout,
  };
}
export async function observation(
  tab: TabDetails,
  kind: Observation['kind'],
  active: boolean,
  timestamp = Date.now(),
): Promise<Observation> {
  const config = await settings(),
    timeout = await idleTimeout();
  const state = await chrome.idle.queryState(timeout / 1000);
  const suffix = kind === 'media' ? ':' + String(tab.id) : '';
  return {
    ...details(tab, kind, timeout),
    event_id: crypto.randomUUID(),
    channel: 'chrome:' + config.instance + ':' + kind + suffix,
    timestamp,
    source: 'chrome',
    kind,
    ...activityState(tab, kind, active, state, timeout),
  };
}

function activityState(
  tab: TabDetails,
  kind: Observation['kind'],
  active: boolean,
  state: 'active' | 'idle' | 'locked',
  timeout: number,
) {
  return {
    active: active && state !== 'locked' && !tab.incognito,
    web_active: active && state !== 'locked' && !tab.incognito,
    playing: kind === 'media' && active,
    idle_ms: state === 'active' ? 0 : timeout,
  };
}
