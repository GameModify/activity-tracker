import { renderInteraction, showMedia } from './popup-interaction.ts';
import { renderFrames } from './popup-frames.ts';
import { restoreCollector } from './collector-client.ts';
import type { PopupState } from './popup-model.ts';
import { popupState, deliveryText, canRepair } from './popup-model.ts';
import { renderPermissions, renderPlayback } from './popup-view.ts';
import { element, text } from './ui.ts';
let rendering = false;
function renderState(state: PopupState): void {
  text('connection', deliveryText(state));
  renderTab(state);
  renderPlayback(state);
  renderFrames(state);
  renderPermissions(state);
  renderInteraction(state);
  element('media-section', HTMLElement).hidden = !showMedia(state);
  element('media-details', HTMLElement).hidden = !showMedia(state);
  element('repair', HTMLButtonElement).hidden = !canRepair(state);
}
function renderTab(state: PopupState): void {
  text('version', 'Activity Tracker ' + chrome.runtime.getManifest().version);
  text(
    'tab-title',
    state.tab?.incognito
      ? 'Инкогнито не отслеживается'
      : (state.tab?.title ?? 'Нет активной вкладки'),
  );
  text(
    'tab-state',
    state.config.enabled ? 'Активная вкладка' : 'Предпросмотр вкладки, сбор выключен',
  );
}
async function render(): Promise<void> {
  if (rendering) return;
  rendering = true;
  try {
    renderState(await popupState());
  } catch (error) {
    text('notice', error instanceof Error ? error.message : 'Не удалось загрузить состояние');
  } finally {
    rendering = false;
  }
}
element('settings', HTMLButtonElement).addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});
setInterval(() => {
  void render();
}, 1000);
void render();

async function repair(): Promise<void> {
  const state = await popupState();
  const result = await restoreCollector(state.tab?.id);
  if (result.collector_error) throw new Error(result.collector_error);
  await render();
}
element('repair', HTMLButtonElement).addEventListener('click', () => {
  void repair().catch((error: unknown) => {
    text('notice', error instanceof Error ? error.message : 'Не удалось восстановить сбор');
  });
});
async function inspectCurrent(): Promise<void> {
  const state = await popupState();
  await restoreCollector(state.tab?.id);
  await render();
}
void inspectCurrent().catch((error: unknown) => {
  text('notice', error instanceof Error ? error.message : 'Не удалось проверить вкладку');
});
