export function eventWallTime(eventTicks: number, currentTicks: number, now: number): number {
  return now - ((currentTicks - eventTicks) >>> 0);
}
