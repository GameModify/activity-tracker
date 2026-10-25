import path from 'node:path';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { format } from 'node:util';
export function desktopLogging(directory: string): void {
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'service.log');
  const write = (...values: unknown[]): void => {
    try {
      if (existsSync(file) && statSync(file).size > 1024 * 1024)
        renameSync(file, file + '.previous');
      appendFileSync(file, new Date().toISOString() + ' ' + format(...values) + '\n', {
        mode: 0o600,
      });
    } catch {
      /* The tracker must not stop when the log cannot be written. */
    }
  };
  console.log = write;
  console.warn = write;
  console.error = write;
}
