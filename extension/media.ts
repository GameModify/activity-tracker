export class MediaFrames {
  frames = new Map<number, Map<number, number>>();
  update(tab: number, frame: number, playing: boolean, now = Date.now()): boolean {
    const active = this.frames.get(tab) ?? new Map<number, number>();
    if (playing) active.set(frame, now);
    else active.delete(frame);
    for (const [id, last] of active) {
      if (now - last > 15000) active.delete(id);
    }
    if (active.size) this.frames.set(tab, active);
    else this.frames.delete(tab);
    return active.size > 0;
  }
  remove(tab: number): void {
    this.frames.delete(tab);
  }
}
