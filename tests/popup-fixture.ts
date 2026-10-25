import { deliverySchema } from '../extension/http.ts';
import { settingsSchema } from '../extension/model.ts';
import type { FrameStatus } from '../extension/diagnostic-model.ts';
import type { PopupState } from '../extension/popup-model.ts';
export const timestamp = 100000;
export function frame(patch: Partial<FrameStatus> = {}): FrameStatus {
  return {
    tab_id: 1,
    frame_id: 0,
    title: 'Test series',
    url: 'https://catalog.example/series/1',
    playing: true,
    media_count: 1,
    frames: [],
    observed_at: timestamp,
    started_at: timestamp - 5000,
    ...patch,
  };
}
export function popup(patch: Partial<PopupState> = {}): PopupState {
  return {
    config: settingsSchema.parse({
      enabled: true,
      token: 'a'.repeat(64),
      instance: 'test',
      interaction_sites: [],
      sites: [],
    }),
    tab: undefined,
    interaction: null,
    collector: { collector_ready: true, collector_error: '', registered_sites: [] },
    current: [],
    playing: [],
    missing: [],
    delivery: deliverySchema.parse({ last_sent: timestamp }),
    ...patch,
  };
}
