import { showMedia } from './popup-interaction.ts';
import { restoreCollector } from './collector-client.ts';
import type { FrameStatus } from './diagnostic-model.ts';
import type { PopupState } from './popup-model.ts';
import { elapsed, probeText } from './popup-model.ts';
import { element, text } from './ui.ts';
import { grantSite } from './permissions.ts';
function playbackItem(frame: FrameStatus): HTMLLIElement {
  const item = document.createElement('li'),
    title = document.createElement('strong');
  title.textContent = frame.title || 'Видео без названия';
  const detail = document.createElement('span');
  const position =
    frame.position_seconds === undefined
      ? ''
      : ' · На отметке ' + videoPosition(frame.position_seconds);
  detail.textContent = (frame.playing ? 'Просмотр · ' + elapsed(frame) : 'На паузе') + position;
  item.append(title, detail);
  return item;
}
function videoPosition(value: number): string {
  const seconds = Math.floor(value);
  return String(Math.floor(seconds / 60)) + ':' + String(seconds % 60).padStart(2, '0');
}
export function renderPlayback(state: PopupState): void {
  const paused = state.current.find((frame) => frame.media_count > 0 && !frame.playing);
  const items =
    state.playing.some((frame) => frame.tab_id === state.tab?.id) || !paused
      ? state.playing
      : [paused, ...state.playing];
  element('playing', HTMLUListElement).replaceChildren(...items.map(playbackItem));
  text(
    'playback',
    state.playing.length
      ? 'Обнаружено воспроизведение'
      : paused
        ? 'Видео на паузе'
        : 'Воспроизведение не обнаружено',
  );
}
function permissionButton(pattern: string, tab: number | undefined): HTMLLIElement {
  const item = document.createElement('li'),
    button = document.createElement('button');
  button.className = 'permission';
  button.textContent = 'Включить сбор: ' + new URL(pattern).hostname;
  button.addEventListener('click', () => {
    void grantSite(pattern)
      .then(async (granted) => {
        if (granted && tab !== undefined) await restoreCollector(tab);
      })
      .catch((error: unknown) => {
        text('notice', error instanceof Error ? error.message : 'Не удалось разрешить доступ');
      });
  });
  item.append(button);
  return item;
}

function permissionList(missing: string[], tab: number | undefined): void {
  const list = element('permissions', HTMLUListElement);
  const signature = String(tab) + '|' + missing.join('|');
  if (list.dataset.signature === signature) return;
  list.replaceChildren(...missing.map((pattern) => permissionButton(pattern, tab)));
  list.dataset.signature = signature;
}
export function renderPermissions(state: PopupState): void {
  const blocked = !state.config.enabled || state.tab?.incognito || !showMedia(state);
  const missing = blocked ? [] : state.missing;
  permissionList(missing, state.tab?.id);
  text(
    'permission-note',
    missing.length
      ? 'Включи сбор отдельно для сайта и домена плеера. Chrome запросит доступ, если он ещё не выдан.'
      : '',
  );
  text('probe', probeText(state));
}
