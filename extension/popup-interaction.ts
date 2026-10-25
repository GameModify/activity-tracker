import { chatGPTLabel } from './chatgpt-page.ts';
import type { PopupState } from './popup-model.ts';
import { interactionView } from './interaction-status.ts';
import { element, text } from './ui.ts';
import { grantSite } from './permissions.ts';
import { restoreCollector } from './collector-client.ts';
export function renderInteraction(state: PopupState): void {
  const diagnostic = state.interaction;
  element('interaction-section', HTMLElement).hidden = !diagnostic;
  if (!diagnostic) return;
  renderStatus(state);
  const button = element('interaction-enable', HTMLButtonElement);
  button.hidden = !state.config.enabled || (diagnostic.selected && diagnostic.permitted);
  button.textContent = 'Включить учёт действий: ' + new URL(diagnostic.site).hostname;
  button.onclick = () => {
    void enable(diagnostic.site, state.tab?.id).catch((error: unknown) => {
      text('notice', error instanceof Error ? error.message : 'Не удалось включить учёт действий');
    });
  };
}
function renderStatus(state: PopupState): void {
  const view = interactionView(
    state.interaction,
    state.config.enabled,
    state.delivery.server_paused,
    Date.now(),
    state.delivery.server_idle_timeout_ms,
  );
  text(
    'interaction-status',
    chatGPTLabel(state.tab?.url ?? '', state.interaction?.state?.chatgpt_project) ?? view.heading,
  );
  text('interaction-detail', view.detail);
}
async function enable(site: string, tab: number | undefined): Promise<void> {
  if (await grantSite(site, 'interaction_sites')) await restoreCollector(tab);
}
export function hasMedia(state: PopupState): boolean {
  return state.playing.length > 0 || state.current.some((frame) => frame.media_count > 0);
}
export function showMedia(state: PopupState): boolean {
  return !state.interaction || hasMedia(state);
}
