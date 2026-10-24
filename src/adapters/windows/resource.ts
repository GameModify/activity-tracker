import path from 'node:path';
export interface ForegroundWindow {
  process_id?: number;
  app: string;
  title: string;
  app_path?: string;
  handle?: number;
  fullscreen?: boolean;
  monitor?: 'primary' | 'secondary';
}
export interface WordDocument {
  name: string;
  path: string;
  window_handle: number;
}
function wordResource(window: ForegroundWindow, document?: WordDocument | null) {
  const known = document && document.window_handle === window.handle ? document : null;
  const name =
    known?.name ??
    window.title
      .replace(/\s*[-–—]\s*(Microsoft )?Word.*$/i, '')
      .replace(/^\*+/, '')
      .trim();
  return {
    resource_kind: 'document' as const,
    resource_id: known?.path
      ? path.win32.normalize(known.path)
      : 'word-title:' + name.toLocaleLowerCase(),
    title: name,
  };
}
export function windowResource(window?: ForegroundWindow, document?: WordDocument | null) {
  if (!window) return {};
  const folder = window.app_path?.match(/[\\/]steamapps[\\/]common[\\/]([^\\/]+)/i)?.[1];
  if (folder)
    return {
      resource_kind: 'game' as const,
      resource_id: 'steam-folder:' + folder.toLocaleLowerCase(),
      title: folder,
    };
  if (window.app.toLocaleLowerCase() === 'winword.exe') return wordResource(window, document);
  return {
    resource_kind: 'app' as const,
    resource_id: 'app:' + path.win32.basename(window.app).toLocaleLowerCase(),
  };
}
