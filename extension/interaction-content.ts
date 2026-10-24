import { chatGPTMetadata } from './chatgpt-page.ts';
import type { InteractionMessage } from './interaction-model.ts';
let currentUrl = location.href,
  interactionAt = 0,
  lastMove = 0,
  lastReport = 0;
function synchronizeLocation(): void {
  if (location.href === currentUrl) return;
  currentUrl = location.href;
  interactionAt = 0;
}
function focusedPage(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}
function snapshot(): InteractionMessage {
  synchronizeLocation();
  return {
    type: 'interaction',
    ...chatGPTMetadata(document, currentUrl),
    url: currentUrl,
    interaction_at: interactionAt,
    focused: focusedPage(),
  };
}
function report(): void {
  lastReport = Date.now();
  void chrome.runtime.sendMessage(snapshot()).catch(() => undefined);
}
function interaction(event: Event): void {
  if (!event.isTrusted || !focusedPage()) return;
  synchronizeLocation();
  const now = Date.now();
  if (event.type === 'pointermove' && now - lastMove < 5000) return;
  const initial = interactionAt === 0;
  interactionAt = now;
  if (event.type === 'pointermove') lastMove = now;
  if (initial || now - lastReport >= 5000) report();
}
function start(): void {
  for (const event of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'input', 'scroll'])
    document.addEventListener(event, interaction, { capture: true, passive: true });
  for (const event of ['focus', 'blur', 'pagehide']) window.addEventListener(event, report);
  document.addEventListener('visibilitychange', report);
  setInterval(report, 5000);
  report();
}
if (!window.activityTrackerInteractionVersion) {
  window.activityTrackerInteractionVersion = chrome.runtime.getManifest().version;
  start();
}
declare global {
  interface Window {
    activityTrackerInteractionVersion?: string;
  }
}
