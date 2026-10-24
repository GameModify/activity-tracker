import { randomUUID } from 'node:crypto';
import type { DesktopCollector } from '../../application/ports.ts';
import type { Observation } from '../../domain/contracts.ts';
import type { DesktopProbe } from './desktop-probe.ts';
export function discordCollector(probe: DesktopProbe): DesktopCollector {
  return {
    sample: () => voiceSample(probe),
    status: () => ({
      state: probe.current()?.discord.state ?? 'unknown',
      observed_at: probe.current()?.observed_at ?? 0,
    }),
  };
}
function voiceSample(probe: DesktopProbe): Observation | undefined {
  const snapshot = probe.current();
  if (!snapshot || snapshot.discord.state === 'unknown') return undefined;
  const connected = snapshot.discord.state === 'connected';
  return {
    event_id: randomUUID(),
    channel: 'windows:discord:voice',
    timestamp: snapshot.observed_at,
    source: 'windows',
    kind: 'voice',
    ...voiceIdentity(),
    title: 'Discord: голосовой канал',
    url: '',
    active: connected,
    playing: false,
    voice_connected: connected,
    idle_ms: 0,
  };
}

function voiceIdentity() {
  return { app: 'Discord.exe', resource_kind: 'voice' as const, resource_id: 'discord:voice' };
}
