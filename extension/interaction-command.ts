import { interactionMessageSchema, interactionKey } from './interaction-model.ts';
import { settings } from './model.ts';
import { sitePattern } from './sites.ts';
import { selectedSite } from './site-selection.ts';
import { focusObservation } from './focus-observation.ts';
import { send } from './http.ts';
type InteractionSender = Pick<chrome.runtime.MessageSender, 'id' | 'frameId'> & {
  tab?: Pick<chrome.tabs.Tab, 'id'>;
};
async function accept(message: unknown, tabId: number): Promise<void> {
  const input = interactionMessageSchema.parse(message),
    config = await settings();
  const tab = await chrome.tabs.get(tabId),
    site = sitePattern(tab.url ?? '');
  if (
    !config.enabled ||
    tab.incognito ||
    !site ||
    !selectedSite(config, 'interaction_sites', tab.url ?? '')
  )
    return;
  if (input.url !== tab.url || input.interaction_at > Date.now()) return;
  if (!(await chrome.permissions.contains({ origins: [site] }))) return;
  const window = await chrome.windows.get(tab.windowId);
  await chrome.storage.session.set({
    [interactionKey(tabId)]: { ...input, observed_at: Date.now() },
  });
  if (tab.active && window.focused) send([await focusObservation(tab, true)]);
}
function validSender(sender: InteractionSender): boolean {
  return sender.id === chrome.runtime.id && sender.tab?.id !== undefined && sender.frameId === 0;
}
export function interactionCommand(
  value: unknown,
  sender: InteractionSender,
  reply: (value: { ok: boolean }) => void,
): boolean {
  if (
    !interactionMessageSchema.safeParse(value).success ||
    !validSender(sender) ||
    sender.tab?.id === undefined
  )
    return false;
  void accept(value, sender.tab.id)
    .then(() => {
      reply({ ok: true });
    })
    .catch(() => {
      reply({ ok: false });
    });
  return true;
}
