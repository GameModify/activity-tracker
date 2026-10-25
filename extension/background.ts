import { connectContent } from './content-channel.ts';
import { diagnosticCommand } from './collector-diagnostics.ts';
import { collectorCommand, installCollector } from './collector-runtime.ts';
import { activateTab, collectFocus, closeTab, focusWindow, updateTab } from './focus-collector.ts';
import { mediaCommand } from './media-command.ts';
import { removeTab } from './diagnostics.ts';
import { interactionCommand } from './interaction-command.ts';
chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  return (
    diagnosticCommand(message, sender, reply) ||
    collectorCommand(message, sender, reply) ||
    interactionCommand(message, sender, reply) ||
    mediaCommand(message, sender, reply)
  );
});
chrome.runtime.onConnect.addListener(connectContent);
installCollector();
chrome.alarms.onAlarm.addListener(() => {
  void collectFocus();
});
chrome.runtime.onStartup.addListener(() => {
  void collectFocus();
});
chrome.tabs.onActivated.addListener(activateTab);
chrome.windows.onFocusChanged.addListener(focusWindow);
chrome.tabs.onUpdated.addListener(updateTab);
void chrome.alarms.create('focus', { periodInMinutes: 0.5 });
setInterval(() => {
  void collectFocus();
}, 5000);
void collectFocus();
chrome.tabs.onRemoved.addListener((id) => {
  closeTab(id);
  void removeTab(id).catch(() => undefined);
});
