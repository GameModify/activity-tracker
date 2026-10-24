export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export function coversMonitor(client: ScreenRect, monitor: ScreenRect): boolean {
  if (client.right <= client.left || client.bottom <= client.top) return false;
  return (['left', 'top', 'right', 'bottom'] as const).every(
    (edge) => Math.abs(client[edge] - monitor[edge]) <= 2,
  );
}
const excluded = new Set([
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  'discord.exe',
  'explorer.exe',
  'winword.exe',
  'excel.exe',
  'powerpnt.exe',
  'soffice.bin',
  'code.exe',
  'codex.exe',
  'windowsterminal.exe',
  'powershell.exe',
  'pwsh.exe',
  'cmd.exe',
  'vlc.exe',
]);
export function potentialGame(app: string): boolean {
  return app.toLowerCase().endsWith('.exe') && !excluded.has(app.toLowerCase());
}
