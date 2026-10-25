import type { TabDetails } from './diagnostic-model.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { settings } from './model.ts';
import { focusObservation } from './focus-observation.ts';
import { send } from './http.ts';
interface FocusRequest {
  at: number;
  tab?: TabDetails;
  tabId?: number;
  windowId?: number;
  active?: boolean;
}
let pending: Promise<void> = Promise.resolve();
let previous: Observation | undefined;
let previousTab: number | undefined;
let focusedWindow: number | undefined;
async function snapshot(input: FocusRequest) {
  if (input.active === false) return undefined;
  const window =
    input.windowId === undefined
      ? await chrome.windows.getLastFocused({ populate: true })
      : await chrome.windows.get(input.windowId, { populate: true });
  const tab =
    input.tab ??
    (input.tabId === undefined
      ? window.tabs?.find((item) => item.active)
      : await chrome.tabs.get(input.tabId));
  if (!tab) return undefined;
  return { tab, sample: await focusObservation(tab, input.active ?? window.focused, input.at) };
}
async function capture(input: FocusRequest): Promise<void> {
  if (!(await settings()).enabled) return;
  try {
    const result = await snapshot(input);
    if (result) {
      previous = result.sample;
      previousTab = result.tab.id;
      send([previous]);
    } else stop(input.at);
  } catch {
    stop(input.at);
  }
}
function stop(at: number): void {
  if (previous) {
    previous = {
      ...previous,
      event_id: crypto.randomUUID(),
      timestamp: at,
      active: false,
      web_active: false,
      recording: false,
    };
    send([previous]);
  }
}
export function collectFocus(input: Omit<FocusRequest, 'at'> = {}): Promise<void> {
  const request = { ...input, at: Date.now() };
  pending = pending
    .then(() => capture(request))
    .catch(() => {
      stop(request.at);
    });
  return pending;
}
export function focusWindow(windowId: number): void {
  focusedWindow = windowId;
  void collectFocus({ windowId: windowId < 0 ? undefined : windowId, active: windowId >= 0 });
}
export function activateTab(info: { tabId: number; windowId: number }): void {
  if (focusedWindow !== undefined && focusedWindow !== info.windowId) return;
  void collectFocus({ ...info, active: true });
}
export function updateTab(
  _id: number,
  change: chrome.tabs.OnUpdatedInfo,
  tab: TabDetails & Pick<chrome.tabs.Tab, 'active' | 'windowId'>,
): void {
  if (
    tab.active &&
    (focusedWindow === undefined || focusedWindow === tab.windowId) &&
    (change.url !== undefined || change.status === 'complete')
  )
    void collectFocus({
      tab,
      windowId: tab.windowId,
      active: focusedWindow === undefined || focusedWindow === tab.windowId,
    });
}
export function closeTab(id: number): void {
  const at = Date.now();
  pending = pending.then(() => {
    if (id === previousTab) stop(at);
  });
}
