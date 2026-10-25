import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
export const execute = promisify(execFile);
export async function nodeCommand(args: string[]): Promise<void> {
  const result = await execute(process.execPath, args, { maxBuffer: 8 * 1024 * 1024 });
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
}
export async function zip(directory: string, output: string): Promise<void> {
  const quote = (value: string): string => "'" + path.resolve(value).replaceAll("'", "''") + "'";
  const command =
    'Compress-Archive -Path ' +
    quote(directory) +
    ' -DestinationPath ' +
    quote(output) +
    ' -CompressionLevel Optimal -Force';
  await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
}
