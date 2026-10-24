import { potentialGame } from '../../domain/screen.ts';
import type { DesktopProbe } from './desktop-probe.ts';
import { windowResource } from './resource.ts';
import type { ForegroundWindow } from './resource.ts';
import { randomUUID } from 'node:crypto';
import type { Observation } from '../../domain/contracts.ts';
import type { DesktopCollector } from '../../application/ports.ts';
interface WindowsApi {
  isProcessRunning(pid: number): boolean;
  idleMilliseconds(): number;
  isRecording(app: string): boolean;
  foregroundWindow(): ForegroundWindow | undefined;
}
export async function windowsCollector(
  probe?: DesktopProbe,
): Promise<DesktopCollector | undefined> {
  if (process.platform !== 'win32') return undefined;
  const api: WindowsApi = await import('./native.ts');
  return { sample: () => sample(api, probe), processRunning: (pid) => api.isProcessRunning(pid) };
}
function sample(api: WindowsApi, probe?: DesktopProbe): Observation {
  const window = api.foregroundWindow();
  return {
    event_id: randomUUID(),
    ...presentationMetadata(window),
    recording: Boolean(window && api.isRecording(window.app)),
    channel: 'windows:focus',
    timestamp: Date.now(),
    source: 'windows',
    kind: 'focus',
    app: window?.app ?? '',
    title: window?.title ?? '',
    url: '',
    active: Boolean(window),
    playing: false,
    ...windowResource(window, probe?.current()?.word),
    idle_timeout_ms: 300000,
    idle_ms: api.idleMilliseconds(),
  };
}

function presentationMetadata(window?: ForegroundWindow) {
  return {
    process_id: window?.process_id,
    fullscreen: window?.fullscreen,
    monitor: window?.monitor,
    game_candidate: Boolean(window?.fullscreen && potentialGame(window.app)),
  };
}
