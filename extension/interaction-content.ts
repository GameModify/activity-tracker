import { installContent } from './content-runtime.ts';
import type { ContentRuntime } from './content-runtime.ts';
import { chatGPTMetadata } from './chatgpt-page.ts';
import type { InteractionMessage } from './interaction-model.ts';
let currentUrl = location.href,
  interactionAt = 0,
  lastMove = 0,
  lastReport = 0;
let runtime: ContentRuntime;
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
  runtime.send(snapshot);
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
function start(collector: ContentRuntime): void {
  runtime = collector;
  for (const event of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'input', 'scroll'])
    runtime.listen(document, event, interaction);
  for (const event of ['focus', 'blur', 'pagehide']) runtime.listen(window, event, report);
  runtime.listen(document, 'visibilitychange', report);
  runtime.heartbeat(report);
  report();
}
installContent('activityTrackerInteraction', start);
