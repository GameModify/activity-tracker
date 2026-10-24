import { readInteraction } from './interaction-diagnostics.ts';
import { pendingSites } from './site-access.ts';
import { collectorStateSchema } from './collector-client.ts';
import { frames } from './diagnostics.ts';
import { freshFrames, playback } from './diagnostic-model.ts';
import type { FrameStatus } from './diagnostic-model.ts';
import { settings } from './model.ts';
import type { ExtensionSettings } from './model.ts';
import { deliverySchema } from './http.ts';
import { sitePattern } from './sites.ts';
async function popupMedia(tab: chrome.tabs.Tab | undefined, config: ExtensionSettings) {
  const visible = config.enabled && !tab?.incognito ? freshFrames(await frames()) : [];
  const current = visible.filter((frame) => frame.tab_id === tab?.id);
  const patterns = [sitePattern(tab?.url ?? ''), ...current.flatMap((frame) => frame.frames)];
  return { current, playing: playback(visible), missing: await pendingSites(patterns) };
}
async function popupDiagnostics() {
  const delivery = deliverySchema.parse(
    await chrome.storage.local.get(Object.keys(deliverySchema.shape)),
  );
  const collector = collectorStateSchema.parse(
    await chrome.storage.session.get(Object.keys(collectorStateSchema.shape)),
  );
  return { delivery, collector };
}
export async function popupState() {
  const config = await settings();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    config,
    tab,
    ...(await popupMedia(tab, config)),
    ...(await popupDiagnostics()),
    interaction: await readInteraction(tab, config),
  };
}
export type PopupState = Awaited<ReturnType<typeof popupState>>;
export function deliveryText(state: PopupState, now = Date.now()): string {
  if (!state.config.enabled) return 'Сбор в Chrome выключен';
  if (!/^[a-f0-9]{64}$/.test(state.config.token)) return 'В настройках нужен ключ отправки событий';
  if (state.delivery.connection_error) return state.delivery.connection_error;
  if (now - state.delivery.last_sent > 30000) return 'Ожидаем подтверждение от локального сервиса';
  return state.delivery.server_paused
    ? 'Сбор приостановлен в сервисе'
    : 'События доставляются в локальный сервис';
}
export function elapsed(frame: FrameStatus, now = Date.now()): string {
  const end = frame.playing ? now : frame.observed_at;
  const seconds = Math.max(0, Math.floor((end - frame.started_at) / 1000));
  return String(Math.floor(seconds / 60)) + ':' + String(seconds % 60).padStart(2, '0');
}
export function probeText(state: PopupState): string {
  if (!state.config.enabled) return 'Включи сбор в настройках расширения';
  if (state.tab?.incognito) return 'Содержимое инкогнито не собирается';
  if (state.collector.collector_error) return 'Ошибка сборщика: ' + state.collector.collector_error;
  if (!state.collector.collector_ready) return 'Сборщик плееров ещё не запущен';
  if (state.missing.length) return 'Сбор для сайта или встроенного плеера не включён';
  if (state.current.some((frame) => frame.media_count > 0)) return 'Плеер обнаружен';
  if (state.current.length)
    return 'Страница отвечает, но встроенный плеер пока не прислал состояние';
  return 'Сбор включён, но ответа страницы пока нет';
}

export function canRepair(state: PopupState): boolean {
  if (state.interaction)
    return state.config.enabled && state.interaction.selected && state.interaction.permitted;
  return (
    state.config.enabled &&
    !state.tab?.incognito &&
    sitePattern(state.tab?.url ?? '') !== null &&
    !state.current.some((frame) => frame.media_count > 0)
  );
}

export function contentVersionText(state: PopupState, expected: string): string {
  const samples = [
    ...(state.interaction?.state ? [state.interaction.state] : []),
    ...state.current,
  ];
  if (!samples.length) return 'Сборщик вкладки пока не ответил';
  const versions = [...new Set(samples.map((sample) => sample.content_version ?? 'неизвестна'))];
  const current = versions.every((version) => version === expected);
  return (
    'Сборщик вкладки: ' +
    versions.join(', ') +
    (current ? ' · актуален' : ' · требуется обновление')
  );
}
