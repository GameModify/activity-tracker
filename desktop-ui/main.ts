import {
  initializeKey,
  setKey,
  status,
  connection,
  preferences,
  pause,
  saveMinutes,
} from './http.ts';
import { element, text, notice } from './ui.ts';
import type { ConnectionInformation } from '../src/domain/contracts.ts';
let paused = false,
  info: ConnectionInformation | undefined;
async function refresh(): Promise<void> {
  const current = await status();
  paused = current.paused;
  text('state', paused ? 'Сбор приостановлен' : 'Сбор включён');
  text('pause', paused ? 'Продолжить сбор' : 'Приостановить сбор');
  text(
    'collectors',
    (current.desktop_available ? 'Windows: работает' : 'Windows: недоступен') +
      ' · Chrome: ' +
      (current.browser_version ?? 'ожидаем расширение'),
  );
}
async function load(): Promise<void> {
  try {
    await refresh();
    info = await connection();
    element('minutes', HTMLInputElement).value = String(
      (await preferences()).idle_timeout_ms / 60000,
    );
    element('auth', HTMLFormElement).hidden = true;
    element('settings', HTMLElement).hidden = false;
    element('endpoint', HTMLInputElement).value = info.endpoint;
    text('directory', info.directory);
    text('notice', '');
  } catch (error) {
    notice(error);
  }
}
async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    notice(error);
  }
}
element('auth', HTMLFormElement).onsubmit = (event) => {
  event.preventDefault();
  void run(async () => {
    setKey(element('key', HTMLInputElement).value);
    await load();
  });
};
element('pause', HTMLButtonElement).onclick = () => {
  void run(async () => {
    await pause(!paused);
    await refresh();
    text('notice', 'Состояние сбора сохранено');
  });
};
element('idle', HTMLFormElement).onsubmit = (event) => {
  event.preventDefault();
  void run(async () => {
    await saveMinutes(Number(element('minutes', HTMLInputElement).value));
    text('notice', 'Время бездействия сохранено');
  });
};
function copy(id: 'read' | 'ingest'): void {
  void run(async () => {
    if (!info) throw new Error('Сначала подключись к сервису');
    await navigator.clipboard.writeText(info[id]);
    text('notice', 'Ключ скопирован');
  });
}
element('copy-read', HTMLButtonElement).onclick = () => {
  copy('read');
};
element('copy-ingest', HTMLButtonElement).onclick = () => {
  copy('ingest');
};
initializeKey();
void load();
setInterval(() => {
  if (!document.hidden && info) void refresh().catch(notice);
}, 5000);
