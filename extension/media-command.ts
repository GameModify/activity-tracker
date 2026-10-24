import { mediaMessageSchema } from './diagnostic-model.ts';
import type { MediaMessage, TabDetails } from './diagnostic-model.ts';
import { recordFrame } from './diagnostics.ts';
import { mediaObservation } from './media-observation.ts';
import { send } from './http.ts';
import { settings } from './model.ts';
import { reportCollectorError } from './collector-runtime.ts';
type MediaSender = Pick<chrome.runtime.MessageSender, 'id' | 'frameId' | 'url'> & {
  tab?: TabDetails;
};
interface MediaReceipt {
  ok: boolean;
}
async function acceptMedia(
  sample: MediaMessage,
  sender: MediaSender,
  tabId: number,
): Promise<void> {
  if (!(await settings()).enabled) return;
  const tab = await chrome.tabs.get(tabId);
  if (tab.incognito) return;
  const playing = await recordFrame(sample, { frameId: sender.frameId, url: sender.url }, tab);
  send([await mediaObservation(tab, playing)]);
}

function mediaInput(value: unknown, sender: MediaSender) {
  const message = mediaMessageSchema.safeParse(value);
  if (
    !message.success ||
    sender.id !== chrome.runtime.id ||
    sender.tab?.id === undefined ||
    sender.tab.incognito
  )
    return null;
  return { sample: message.data, tabId: sender.tab.id };
}
export function mediaCommand(
  value: unknown,
  sender: MediaSender,
  reply: (receipt: MediaReceipt) => void,
): boolean {
  const input = mediaInput(value, sender);
  if (!input) return false;
  void acceptMedia(input.sample, sender, input.tabId)
    .then(() => {
      reply({ ok: true });
    })
    .catch((error: unknown) => {
      void reportCollectorError(error);
      reply({ ok: false });
    });
  return true;
}
