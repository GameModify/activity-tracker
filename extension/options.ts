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
  element('interaction-sites', HTMLUListElement).replaceChildren(
    ...config.interaction_sites.map(siteItem),
  );
  element('sites', HTMLUListElement).replaceChildren(
    ...config.sites.map((site) => {
      const item = document.createElement('li');
      item.textContent = site;
      return item;
    }),
  );
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
handle(load);

element('interaction-permissions', HTMLFormElement).addEventListener('submit', (event) => {
  event.preventDefault();
  handle(() => grant('interaction_sites'));
});

function siteItem(site: string): HTMLLIElement {
  const item = document.createElement('li');
  item.textContent = site;
  return item;
}
