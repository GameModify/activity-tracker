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
    const focused = sample.resource_kind === 'game';
    const valid = focused || (running && this.recent(sample.timestamp));
    this.current = valid && game ? { ...game, active: game.active && focused } : undefined;
    if (!valid) this.lastGame = undefined;
    const foreground = { ...sample, active: sample.active && sample.resource_kind !== 'game' };
    return game ? [foreground, { ...game, active: game.active && valid && focused }] : [foreground];
  }
  recent(now: number): boolean {
    return Boolean(this.lastGame && now - this.lastGame.timestamp < gameIdleTimeout);
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
