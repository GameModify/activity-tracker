import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { discordEvidenceSchema } from './discord-state.ts';
import { desktopProbeScript } from './desktop-probe-script.ts';
const probeSchema = z.object({
  observed_at: z.number(),
  word: z.object({ name: z.string(), path: z.string(), window_handle: z.number() }).nullable(),
  discord: discordEvidenceSchema,
});
export type DesktopProbeState = z.infer<typeof probeSchema>;
export class DesktopProbe {
  value: DesktopProbeState | undefined;
  child: ChildProcess | undefined;
  launchedAt = 0;
  start(): void {
    if (process.platform !== 'win32') return;
    this.launchedAt = Date.now();
    this.child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(desktopProbeScript, 'utf16le').toString('base64'),
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    this.child.on('error', () => {
      this.value = undefined;
    });
    if (this.child.stdout) createInterface({ input: this.child.stdout }).on('line', this.accept);
  }
  accept = (line: string) => {
    try {
      const sample = probeSchema.parse(JSON.parse(line));
      if (Math.abs(Date.now() - sample.observed_at) < 15000) this.value = sample;
    } catch {
      this.value = undefined;
    }
  };
  current(): DesktopProbeState | undefined {
    const now = Date.now();
    if (now - this.launchedAt > 30000 && (!this.value || now - this.value.observed_at > 20000)) {
      this.stop();
      this.start();
    }
    return this.value && now - this.value.observed_at < 15000 ? this.value : undefined;
  }
  stop(): void {
    this.child?.kill();
    this.child = undefined;
    this.value = undefined;
  }
}
