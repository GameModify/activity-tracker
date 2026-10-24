import type { FrameStatus } from './diagnostic-model.ts';
import type { PopupState } from './popup-model.ts';
import { element } from './ui.ts';
function describeFrame(frame: FrameStatus): string {
  const name = frame.frame_origin
    ? new URL(frame.frame_origin).hostname
    : frame.frame_id === 0
      ? 'Основная страница'
      : 'Встроенный кадр';
  const state = frame.playing
    ? 'воспроизводится'
    : frame.media_count > 0
      ? 'плеер найден, воспроизведение приостановлено'
      : 'видео не найдено';
  return name + ': ' + state;
}
export function renderFrames(state: PopupState): void {
  const descriptions = state.current.map(describeFrame);
  if (!descriptions.length) descriptions.push('Пока нет ответа ни от одного кадра страницы');
  element('frames', HTMLUListElement).replaceChildren(
    ...descriptions.map((description) => {
      const item = document.createElement('li');
      item.textContent = description;
      return item;
    }),
  );
}
