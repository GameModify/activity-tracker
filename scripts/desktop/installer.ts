import { existsSync } from 'node:fs';
import path from 'node:path';
import { execute } from './commands.ts';
export async function installer(directory: string, version: string): Promise<string> {
  const compiler = compilerPath();
  const result = await execute(
    compiler,
    [
      '/Qp',
      '/DAppVersion=' + version,
      '/DAppSource=' + directory,
      path.resolve('packaging/windows.iss'),
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.stdout.trim()) console.log(result.stdout.trim());
  return 'ActivityTracker-' + version + '-windows-x64-setup.exe';
}

function compilerPath(): string {
  const candidates = [
    process.env.ISCC_PATH,
    path.resolve('.qa/tools/inno/ISCC.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)',
      'Inno Setup 6/ISCC.exe',
    ),
  ];
  const compiler = candidates.find((file) => file && existsSync(file));
  if (!compiler) throw new Error('Run npm run prepare:installer or set ISCC_PATH');
  return compiler;
}
