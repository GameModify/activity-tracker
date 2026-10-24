import { videoLabelReplySchema } from './video-label-model.ts';
import type { VideoLabelMessage } from './video-label-model.ts';
import type { VideoIdentity, VideoLabels } from '../src/domain/contracts.ts';
interface Pending {
  resolve(value: VideoLabels): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}
export interface VideoLabelPort {
  postMessage(message: VideoLabelMessage): void;
  onMessage: {
    addListener(callback: (value: unknown) => void): void;
    removeListener(callback: (value: unknown) => void): void;
  };
}
export class VideoLabelClient {
  port: VideoLabelPort;
  pending = new Map<string, Pending>();
  constructor(port: VideoLabelPort) {
    this.port = port;
    port.onMessage.addListener(this.receive);
  }
  receive = (value: unknown): void => {
    const reply = videoLabelReplySchema.safeParse(value);
    if (!reply.success) return;
    const pending = this.pending.get(reply.data.request_id);
    if (!pending) return;
    this.pending.delete(reply.data.request_id);
    clearTimeout(pending.timer);
    if (reply.data.state) pending.resolve(reply.data.state);
    else pending.reject(new Error(reply.data.error ?? 'Нет ответа трекера'));
  };
  request(input: VideoIdentity, choice?: VideoLabelMessage['choice']): Promise<VideoLabels> {
    const request_id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(request_id, new Error('Трекер не ответил'));
      }, 5000);
      this.pending.set(request_id, { resolve, reject, timer });
      try {
        this.port.postMessage({ type: 'video-labels', request_id, input, choice });
      } catch {
        this.fail(request_id, new Error('Расширение отключено. Обнови вкладку'));
      }
    });
  }
  fail(id: string, error: Error): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.reject(error);
  }
  stop(): void {
    try {
      this.port.onMessage.removeListener(this.receive);
    } catch {
      /* Retired context. */
    }
    for (const id of this.pending.keys()) this.fail(id, new Error('Сборщик отключён'));
  }
}
