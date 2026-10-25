export interface DesktopShell {
  update(paused: boolean): void;
  stop(): void | Promise<void>;
}
export interface ShellActions {
  toggle: () => void;
  settings: () => void;
  website: () => void;
  directory: () => void;
  extension: () => void;
  exit: () => void;
}
export type ShellCommand = keyof ShellActions;
export interface ShellMenuItem {
  id: number;
  label: string;
  command?: ShellCommand;
}
export function shellMenu(paused: boolean): ShellMenuItem[] {
  return [
    { id: 1, label: paused ? 'Учёт приостановлен' : 'Учёт включён' },
    { id: 2, label: paused ? 'Продолжить учёт' : 'Приостановить учёт', command: 'toggle' },
    { id: 3, label: 'Открыть Time & Games', command: 'website' },
    { id: 4, label: 'Настройки трекера', command: 'settings' },
    { id: 5, label: 'Папка данных и журнал', command: 'directory' },
    { id: 6, label: 'Браузерное расширение', command: 'extension' },
    { id: 7, label: 'Выйти из Activity Tracker', command: 'exit' },
  ];
}
