import { diagnosticCommand } from './collector-diagnostics.ts';
import { collectorCommand, installCollector } from './collector-runtime.ts';
import { settings } from './model.ts';
import { mediaCommand } from './media-command.ts';
import { removeTab } from './diagnostics.ts';
import { focusObservation } from './focus-observation.ts';
import { interactionCommand } from './interaction-command.ts';
import { send } from './http.ts';
let collecting = false;
async function collectFocus(): Promise<void> {
  if (collecting) return;
  collecting = true;
  try {
    if (!(await settings()).enabled) return;
    const window = await chrome.windows.getLastFocused({ populate: true });
    const tab = window.tabs?.find((item) => item.active);
    if (tab) send([await focusObservation(tab, window.focused)]);
  } catch {
    /* Closing Chrome can invalidate the last focused window. */
  } finally {
    collecting = false;
  }
}
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  return (
    diagnosticCommand(message, sender, reply) ||
    collectorCommand(message, sender, reply) ||
    interactionCommand(message, sender, reply) ||
    mediaCommand(message, sender, reply)
  );
});
installCollector();
chrome.alarms.onAlarm.addListener(() => {
  void collectFocus();
});
chrome.runtime.onStartup.addListener(() => {
  void collectFocus();
});
chrome.tabs.onActivated.addListener(() => {
  void collectFocus();
});
chrome.windows.onFocusChanged.addListener(() => {
  void collectFocus();
});
chrome.tabs.onUpdated.addListener(() => {
  void collectFocus();
});
void chrome.alarms.create('focus', { periodInMinutes: 0.5 });
setInterval(() => {
  void collectFocus();
}, 5000);
void collectFocus();
chrome.tabs.onRemoved.addListener((id) => {
  void removeTab(id).catch(() => undefined);
});
