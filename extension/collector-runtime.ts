import { inspectInteractions } from './interaction-registration.ts';
import { inspectTab } from './inspection.ts';
import { reconcileSites } from './registration.ts';
import { collectorCommandSchema } from './collector-client.ts';
import type { CollectorState } from './collector-client.ts';
let restoring: Promise<CollectorState> | null = null;
async function performRestore(): Promise<CollectorState> {
  try {
    const registered_sites = await reconcileSites();
    const state = { collector_ready: true, collector_error: '', registered_sites };
    await chrome.storage.session.set(state);
    return state;
  } catch (error) {
    const state = {
      collector_ready: false,
      registered_sites: [],
      collector_error: error instanceof Error ? error.message : 'Не удалось запустить сборщик',
    };
    await chrome.storage.session.set(state);
    return state;
  }
}
export function restoreMedia(): Promise<CollectorState> {
  restoring = (restoring ?? Promise.resolve()).then(performRestore, performRestore);
  return restoring;
}
export function restoreInBackground(): void {
  void restoreMedia().catch(() => undefined);
}
function failedState(error: unknown): CollectorState {
  return {
    collector_ready: false,
    registered_sites: [],
    collector_error: error instanceof Error ? error.message : 'Ошибка восстановления сборщика',
  };
}
export function collectorCommand(
  value: unknown,
  sender: chrome.runtime.MessageSender,
  reply: (state: CollectorState) => void,
): boolean {
  if (
    !collectorCommandSchema.safeParse(value).success ||
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL(''))
  )
    return false;
  void executeCollectorCommand(value)
    .then(reply)
    .catch((error: unknown) => {
      reply(failedState(error));
    });
  return true;
}
export function installCollector(): void {
  chrome.runtime.onInstalled.addListener(restoreInBackground);
  chrome.runtime.onStartup.addListener(restoreInBackground);
  chrome.permissions.onAdded.addListener(restoreInBackground);
  chrome.permissions.onRemoved.addListener(restoreInBackground);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (
      area === 'local' &&
      ['sites', 'interaction_sites', 'enabled', 'media_exclusions', 'interaction_exclusions'].some(
        (key) => key in changes,
      )
    )
      restoreInBackground();
  });
  restoreInBackground();
}
export async function reportCollectorError(error: unknown): Promise<void> {
  await chrome.storage.session.set({
    collector_error: error instanceof Error ? error.message : 'Ошибка обработки сигнала плеера',
  });
}

async function executeCollectorCommand(value: unknown): Promise<CollectorState> {
  const command = collectorCommandSchema.parse(value);
  const state = await restoreMedia();
  if (!state.collector_ready || command.tab_id === undefined) return state;
  try {
    await inspectTab(command.tab_id);
    await inspectInteractions(command.tab_id);
    return state;
  } catch (error) {
    await reportCollectorError(error);
    return {
      ...state,
      collector_error: error instanceof Error ? error.message : 'Ошибка проверки вкладки',
    };
  }
}
