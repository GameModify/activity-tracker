import { potentialGame } from '../../domain/screen.ts';
import type { DesktopProbe } from './desktop-probe.ts';
import { windowResource } from './resource.ts';
import type { ForegroundWindow } from './resource.ts';
import type { WindowEvent } from './foreground-events.ts';
import { randomUUID } from 'node:crypto';
import type { Observation } from '../../domain/contracts.ts';
import type { DesktopCollector } from '../../application/ports.ts';
interface WindowsApi {
  isProcessRunning(pid: number): boolean;
  idleMilliseconds(): number;
  recordingApplication(): 'ChatGPT.exe' | 'Codex.exe' | undefined;
  foregroundWindow(): ForegroundWindow | undefined;
}
export async function windowsCollector(
  probe?: DesktopProbe,
): Promise<DesktopCollector | undefined> {
  if (process.platform !== 'win32') return undefined;
  const api: WindowsApi = await import('./native.ts');
  const { watchForeground, flushForeground } = await import('./foreground-events.ts');
  return {
    sample: () => {
      flushForeground();
      return sample(api, probe);
    },
    processRunning: (pid) => api.isProcessRunning(pid),
    subscribe: (listener) => subscribeDesktop(api, probe, watchForeground, listener),
  };
}
function sample(api: WindowsApi, probe?: DesktopProbe, event?: WindowEvent): Observation {
  const window = event ? event.window : api.foregroundWindow();
  const recording = api.recordingApplication();
  return {
    ...windowObservation(window, event?.timestamp ?? Date.now()),
    recording: Boolean(recording && window?.app.toLowerCase() === recording.toLowerCase()),
    recording_app: recording,
    ...windowResource(window, probe?.current()?.word),
    idle_ms: api.idleMilliseconds(),
  };
}
function windowObservation(window: ForegroundWindow | undefined, timestamp: number): Observation {
  return {
    event_id: randomUUID(),
    channel: 'windows:focus',
    timestamp,
    source: 'windows',
    kind: 'focus',
    app: window?.app ?? '',
    title: window?.title ?? '',
    url: '',
    active: Boolean(window),
    playing: false,
    process_id: window?.process_id,
    fullscreen: window?.fullscreen,
    monitor: window?.monitor,
    game_candidate: Boolean(window?.fullscreen && potentialGame(window.app)),
    idle_timeout_ms: 300000,
    idle_ms: 0,
  };
}

function watchRecording(api: WindowsApi, listener: () => void): () => void {
  let previous = api.recordingApplication();
  const timer = setInterval(() => {
    const current = api.recordingApplication();
    if (current === previous) return;
    previous = current;
    listener();
  }, 500);
  return () => {
    clearInterval(timer);
  };
}
function subscribeDesktop(
  api: WindowsApi,
  probe: DesktopProbe | undefined,
  watch: (listener: (event: WindowEvent) => void) => () => void,
  listener: (sample: Observation) => void,
): () => void {
  const stopFocus = watch((event) => {
    listener(sample(api, probe, event));
  });
  const stopRecording = watchRecording(api, () => {
    listener(sample(api, probe));
  });
  return () => {
    stopRecording();
    stopFocus();
  };
}
