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
  disconnectListeners = new Set<() => void>();
  connections = 0;
  disconnected = false;
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
  disconnect = (): void => {
    this.disconnected = true;
    for (const listener of this.disconnectListeners) listener();
  };
  connect = () => {
    this.connections++;
    this.disconnected = false;
    return {
      postMessage: (message: T) => {
        if (this.rejected) {
          this.disconnect();
          return;
        }
        void this.send(message);
      },
      disconnect: this.disconnect,
      onDisconnect: {
        addListener: (listener: () => void) => this.disconnectListeners.add(listener),
        removeListener: (listener: () => void) => this.disconnectListeners.delete(listener),
      },
    };
  };
  chrome() {
    const current = () =>
      this.missing
        ? undefined
        : {
            id: 'tracker-test',
            getManifest: this.manifest,
            sendMessage: this.send,
            connect: this.connect,
          };
    return {
      get runtime() {
        return current();
      },
    };
  }
}
