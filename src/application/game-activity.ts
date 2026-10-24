import { randomUUID } from 'node:crypto';
import type { Observation } from '../domain/contracts.ts';
import { interactionTimeout } from '../domain/engagement.ts';
export class GameActivity {
  lastGame: Observation | undefined;
  lastPoll = 0;
  current: Observation | undefined;
  observe(sample: Observation): Observation[] {
    if (sample.timestamp - this.lastPoll > 15000) this.reset();
    this.lastPoll = sample.timestamp;
    if (sample.resource_kind === 'game') this.lastGame = sample;
    this.current = this.heldGame(sample.timestamp);
    const foreground = { ...sample, active: sample.active && sample.resource_kind !== 'game' };
    return this.current ? [foreground, this.current] : [foreground];
  }
  heldGame(now: number): Observation | undefined {
    const game = this.lastGame;
    if (!game) return undefined;
    const idle = game.idle_ms + Math.max(0, now - game.timestamp);
    return {
      ...game,
      event_id: randomUUID(),
      channel: 'windows:game',
      timestamp: now,
      idle_ms: idle,
      idle_timeout_ms: interactionTimeout,
      active: game.active && idle < interactionTimeout,
    };
  }
  reset(): void {
    this.lastGame = undefined;
    this.current = undefined;
    this.lastPoll = 0;
  }
}
