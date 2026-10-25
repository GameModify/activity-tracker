import koffi from 'koffi';
import { notify, notification } from './tray-native.ts';
import type { NotificationIcon } from './tray-types.ts';
export const trayMessage = 0x8001;
export function tooltip(paused: boolean): Uint16Array {
  const text = 'Activity Tracker · ' + (paused ? 'Учёт приостановлен' : 'Учёт включён');
  const result = new Uint16Array(128);
  for (let index = 0; index < Math.min(text.length, 127); index++)
    result[index] = text.charCodeAt(index);
  return result;
}
export function iconData(window: number, icon: number, paused: boolean): NotificationIcon {
  return {
    cbSize: koffi.sizeof(notification),
    hWnd: window,
    uID: 1,
    uFlags: 1 | 2 | 4 | 128,
    uCallbackMessage: trayMessage,
    hIcon: icon,
    szTip: tooltip(paused),
    dwState: 0,
    dwStateMask: 0,
    szInfo: new Uint16Array(256),
    uVersion: 4,
    szInfoTitle: new Uint16Array(64),
    dwInfoFlags: 0,
    guidItem: new Uint8Array(16),
    hBalloonIcon: 0,
  };
}
export function addIcon(data: NotificationIcon): void {
  if (!notify(0, data)) throw new Error('Не удалось добавить значок в трей');
  notify(4, data);
}
