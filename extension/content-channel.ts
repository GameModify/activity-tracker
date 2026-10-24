import type { TabDetails } from './diagnostic-model.ts';
import { diagnosticCommand } from './collector-diagnostics.ts';
import { interactionCommand } from './interaction-command.ts';
import { mediaCommand } from './media-command.ts';
import { contentChannel } from './content-channel-name.ts';
export interface ContentPort {
  name: string;
  sender?: Pick<chrome.runtime.MessageSender, 'id' | 'frameId' | 'url'> & { tab?: TabDetails };
  onMessage: { addListener(callback: (message: unknown) => void): void };
}
function accept(port: ContentPort, message: unknown): void {
  const sender = port.sender;
  if (!sender) return;
  const reply = () => undefined;
  if (diagnosticCommand(message, sender, reply)) return;
  if (interactionCommand(message, sender, reply)) return;
  mediaCommand(message, sender, reply);
}
export function connectContent(port: ContentPort): void {
  if (
    port.name !== contentChannel ||
    port.sender?.id !== chrome.runtime.id ||
    !port.sender.tab ||
    port.sender.tab.incognito
  )
    return;
  port.onMessage.addListener((message: unknown) => {
    accept(port, message);
  });
}
