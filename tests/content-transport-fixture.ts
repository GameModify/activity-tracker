import type { MediaMessage } from '../extension/diagnostic-model.ts';
import type { InteractionMessage } from '../extension/interaction-model.ts';
export class TestTransport<T extends MediaMessage | InteractionMessage> {
  version = 'test';
  invalidated = false;
  missing = false;
  synchronousFailure = false;
  rejected = false;
  attempts = 0;
  messages: T[] = [];
  manifest = () => {
    if (this.invalidated) throw new Error('Extension context invalidated.');
    return { version: this.version };
  };
  send = (message: T): Promise<void> => {
    this.attempts++;
    if (this.synchronousFailure) throw new Error('Extension context invalidated.');
    if (this.rejected) return Promise.reject(new Error('Receiving end does not exist.'));
    this.messages.push(message);
    return Promise.resolve();
  };
  chrome() {
    const current = () =>
      this.missing
        ? undefined
        : { id: 'tracker-test', getManifest: this.manifest, sendMessage: this.send };
    return {
      get runtime() {
        return current();
      },
    };
  }
}
