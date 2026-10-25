import { randomUUID } from 'node:crypto';
import type { Observation } from '../domain/contracts.ts';
export function dictationObservation(sample: Observation): Observation {
  const recording = sample.recording_app;
  const ownWindow = /^(chatgpt|codex)\.exe$/i.test(sample.app);
  return {
    ...sample,
    event_id: randomUUID(),
    channel: 'windows:dictation',
    app: recording ?? 'ChatGPT.exe',
    title: 'Работа с Codex',
    url: '',
    resource_kind: 'app',
    resource_id: 'codex:desktop',
    active: Boolean(recording && (!ownWindow || !sample.active)),
    recording: Boolean(recording),
    idle_ms: 0,
  };
}
