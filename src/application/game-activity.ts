import { randomUUID } from 'node:crypto';
import type { Observation } from '../domain/contracts.ts';
export const gameIdleTimeout = 120000;
export class GameActivity {
  lastGame: Observation | undefined;
  lastPoll = 0;
  current: Observation | undefined;
  observe(sample: Observation, running = true): Observation[] {
    if (sample.timestamp - this.lastPoll > 15000) this.reset();
    this.lastPoll = sample.timestamp;
    if (sample.resource_kind === 'game') this.lastGame = sample;
    const game = this.heldGame(sample.timestamp);
    const stopped = !running && sample.resource_kind !== 'game';
    this.current = stopped ? undefined : game;
    if (stopped) this.lastGame = undefined;
    const foreground = { ...sample, active: sample.active && sample.resource_kind !== 'game' };
    return game ? [foreground, { ...game, active: game.active && !stopped }] : [foreground];
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
      idle_timeout_ms: gameIdleTimeout,
      active: game.active && idle < gameIdleTimeout,
    };
  }
  reset(): void {
    this.lastGame = undefined;
    this.current = undefined;
    this.lastPoll = 0;
  }
}
