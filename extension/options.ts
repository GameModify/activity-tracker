import { loadChat, saveChat } from './options-chat.ts';
import { renderSites } from './options-sites.ts';
import { renderDiagnostics } from './options-diagnostics.ts';
import { grantAllSites } from './site-controls.ts';
import { settings } from './model.ts';
import { element } from './ui.ts';
import { grantSite } from './permissions.ts';
import { sitePattern } from './sites.ts';
const token = element('token', HTMLInputElement),
  enabled = element('enabled', HTMLInputElement);
const status = element('status', HTMLParagraphElement);
async function load(): Promise<void> {
  const config = await settings();
  token.value = config.token;
  enabled.checked = config.enabled;
  await renderSites(() => {
    handle(load);
  });
  await renderDiagnostics();
  await loadChat();
}
async function save(): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(token.value)) throw new Error('Нужен ключ из 64 символов');
  await chrome.storage.local.set({ token: token.value, enabled: enabled.checked });
  if (!enabled.checked) await chrome.storage.session.clear();
  status.textContent = 'Подключение сохранено';
}
async function grant(purpose: 'sites' | 'interaction_sites' = 'sites'): Promise<void> {
  const pattern = sitePattern(
    element(purpose === 'sites' ? 'site' : 'interaction-site', HTMLInputElement).value,
  );
  if (!pattern) throw new Error('Укажи адрес http или https');
  if (!(await grantSite(pattern, purpose))) return;
  status.textContent = 'Доступ разрешён. Обнови открытые вкладки этого сайта.';
  await load();
}
function handle(action: () => Promise<void>): void {
  void action().catch((error: unknown) => {
    status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить';
  });
}
element('connection', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault();
  handle(save);
});
element('permissions', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault();
  handle(() => grant());
});
element('allow-all', HTMLButtonElement).addEventListener('click', () => {
  handle(async () => {
    if (await grantAllSites()) {
      status.textContent = 'Сбор разрешён на всех сайтах. Исключения в списке сохранены.';
      await load();
    }
  });
});
element('refresh-diagnostics', HTMLButtonElement).addEventListener('click', () => {
  handle(renderDiagnostics);
});
handle(load);

element('interaction-permissions', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault();
  handle(() => grant('interaction_sites'));
});

element('science-chat-form', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault();
  handle(saveChat);
});
