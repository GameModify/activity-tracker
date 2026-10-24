import { settings } from './model.ts';
import type { ExtensionSettings } from './model.ts';
import { selectedSite } from './site-selection.ts';
import type { CollectorPurpose } from './site-selection.ts';
import { allSites } from './sites.ts';
import { setCollection, revokeSite } from './site-controls.ts';
import { element } from './ui.ts';
function report(error: unknown): void {
  element('status', HTMLParagraphElement).textContent =
    error instanceof Error ? error.message : 'Не удалось изменить доступ';
}
function bindToggle(
  input: HTMLInputElement,
  site: string,
  purpose: CollectorPurpose,
  refresh: () => void,
): void {
  input.addEventListener('change', () => {
    input.disabled = true;
    void setCollection(site, purpose, input.checked)
      .then(refresh)
      .catch(report)
      .finally(() => {
        input.disabled = false;
      });
  });
}
function collectionToggle(
  site: string,
  purpose: CollectorPurpose,
  config: ExtensionSettings,
  refresh: () => void,
): HTMLElement {
  const label = document.createElement('label'),
    input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = allSites.includes(site)
    ? config[purpose].includes(site)
    : selectedSite(config, purpose, site);
  bindToggle(input, site, purpose, refresh);
  label.className = 'check';
  label.append(input, purpose === 'sites' ? 'Видео' : 'Действия');
  return label;
}
function revokeButton(site: string, refresh: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = 'Отозвать доступ';
  button.type = 'button';
  button.className = 'secondary';
  button.addEventListener('click', () => {
    void revokeSite(site).then(refresh).catch(report);
  });
  return button;
}
function siteName(site: string, granted: boolean): HTMLDivElement {
  const name = document.createElement('div');
  const label = allSites.includes(site)
    ? 'Все сайты ' + (site.startsWith('https:') ? 'HTTPS' : 'HTTP')
    : site;
  name.textContent = label + (granted ? ' · доступ дан' : ' · нет доступа');
  return name;
}
function siteRow(
  site: string,
  granted: boolean,
  config: ExtensionSettings,
  refresh: () => void,
): HTMLElement {
  const row = document.createElement('li');
  row.append(
    siteName(site, granted),
    collectionToggle(site, 'sites', config, refresh),
    collectionToggle(site, 'interaction_sites', config, refresh),
    revokeButton(site, refresh),
  );
  return row;
}
export async function renderSites(refresh: () => void): Promise<void> {
  const config = await settings(),
    permissions = await chrome.permissions.getAll();
  const origins = (permissions.origins ?? []).filter((site) => site !== 'http://127.0.0.1:3536/*');
  const sites = configuredSites(config, origins);
  const rows = await Promise.all(
    sites.map(async (site) =>
      siteRow(site, await chrome.permissions.contains({ origins: [site] }), config, refresh),
    ),
  );
  const list = element('site-access', HTMLUListElement);
  list.replaceChildren(...rows);
  if (!sites.length) list.textContent = 'Дополнительные разрешения пока не выданы.';
}

function configuredSites(config: ExtensionSettings, origins: string[]): string[] {
  return [
    ...new Set([
      ...origins,
      ...config.sites,
      ...config.interaction_sites,
      ...config.media_exclusions,
      ...config.interaction_exclusions,
    ]),
  ].sort();
}
