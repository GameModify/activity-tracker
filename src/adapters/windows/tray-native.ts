import koffi from 'koffi';
import type { NotificationIcon, TrayWindowClass, ScreenPoint } from './tray-types.ts';
const user = koffi.load('user32.dll'),
  kernel = koffi.load('kernel32.dll'),
  shell = koffi.load('shell32.dll');
export const procedure = koffi.proto(
  'intptr_t __stdcall TrackerTrayWindowProc(uintptr_t,uint32,uintptr_t,intptr_t)',
);
koffi.struct('TrackerTrayWindowClass', {
  style: 'uint32',
  lpfnWndProc: koffi.pointer(procedure),
  cbClsExtra: 'int32',
  cbWndExtra: 'int32',
  hInstance: 'uintptr_t',
  hIcon: 'uintptr_t',
  hCursor: 'uintptr_t',
  hbrBackground: 'uintptr_t',
  lpszMenuName: 'str16',
  lpszClassName: 'str16',
});
export const notification = koffi.struct('TrackerNotificationIcon', {
  cbSize: 'uint32',
  hWnd: 'uintptr_t',
  uID: 'uint32',
  uFlags: 'uint32',
  uCallbackMessage: 'uint32',
  hIcon: 'uintptr_t',
  szTip: koffi.array('uint16', 128),
  dwState: 'uint32',
  dwStateMask: 'uint32',
  szInfo: koffi.array('uint16', 256),
  uVersion: 'uint32',
  szInfoTitle: koffi.array('uint16', 64),
  dwInfoFlags: 'uint32',
  guidItem: koffi.array('uint8', 16),
  hBalloonIcon: 'uintptr_t',
});
export const registerClass = user.func(
  'uint16 __stdcall RegisterClassW(const TrackerTrayWindowClass *)',
) as (value: TrayWindowClass) => number;
export const createWindow = user.func(
  'uintptr_t __stdcall CreateWindowExW(uint32,str16,str16,uint32,int32,int32,int32,int32,uintptr_t,uintptr_t,uintptr_t,void *)',
) as (
  ex: number,
  cls: string,
  title: string,
  style: number,
  x: number,
  y: number,
  w: number,
  h: number,
  parent: number,
  menu: number,
  instance: number,
  param: null,
) => number;
export const defaultProcedure = user.func(
  'intptr_t __stdcall DefWindowProcW(uintptr_t,uint32,uintptr_t,intptr_t)',
) as (window: number, message: number, wparam: number, lparam: number) => number;
export const destroyWindow = user.func('bool __stdcall DestroyWindow(uintptr_t)') as (
  window: number,
) => boolean;
export const unregisterClass = user.func('bool __stdcall UnregisterClassW(str16,uintptr_t)') as (
  name: string,
  instance: number,
) => boolean;
export const moduleHandle = kernel.func('uintptr_t __stdcall GetModuleHandleW(str16)') as (
  name: null,
) => number;
export const notify = shell.func(
  'bool __stdcall Shell_NotifyIconW(uint32,const TrackerNotificationIcon *)',
) as (action: number, data: NotificationIcon) => boolean;
export const registerMessage = user.func('uint32 __stdcall RegisterWindowMessageW(str16)') as (
  name: string,
) => number;
export const loadIcon = user.func(
  'uintptr_t __stdcall LoadImageW(uintptr_t,str16,uint32,int32,int32,uint32)',
) as (instance: number, file: string, type: number, w: number, h: number, flags: number) => number;
export const destroyIcon = user.func('bool __stdcall DestroyIcon(uintptr_t)') as (
  icon: number,
) => boolean;
export const menuCreate = user.func('uintptr_t __stdcall CreatePopupMenu()') as () => number;
export const menuAppend = user.func(
  'bool __stdcall AppendMenuW(uintptr_t,uint32,uintptr_t,str16)',
) as (menu: number, flags: number, id: number, text: string) => boolean;
export const menuDestroy = user.func('bool __stdcall DestroyMenu(uintptr_t)') as (
  menu: number,
) => boolean;
export const foreground = user.func('bool __stdcall SetForegroundWindow(uintptr_t)') as (
  window: number,
) => boolean;
export const postMessage = user.func(
  'bool __stdcall PostMessageW(uintptr_t,uint32,uintptr_t,intptr_t)',
) as (window: number, message: number, wparam: number, lparam: number) => boolean;
koffi.struct('TrackerTrayPoint', { x: 'int32', y: 'int32' });
export const cursor = user.func('bool __stdcall GetCursorPos(_Out_ TrackerTrayPoint *)') as (
  value: ScreenPoint,
) => boolean;
export const trackMenu = user.func(
  'uint32 __stdcall TrackPopupMenuEx(uintptr_t,uint32,int32,int32,uintptr_t,void *)',
) as (menu: number, flags: number, x: number, y: number, window: number, options: null) => number;
export const endMenu = user.func('bool __stdcall EndMenu()') as () => boolean;
export const openTarget = shell.func(
  'intptr_t __stdcall ShellExecuteW(uintptr_t,str16,str16,str16,str16,int32)',
) as (
  window: number,
  operation: string,
  target: string,
  args: null,
  directory: null,
  show: number,
) => number;
export function openShellTarget(target: string): void {
  if (openTarget(0, 'open', target, null, null, 1) <= 32)
    throw new Error('Не удалось открыть выбранный адрес или папку');
}

export const findWindow = user.func('uintptr_t __stdcall FindWindowW(str16,str16)') as (
  name: string,
  title: null,
) => number;
export function requestTrayExit(port: number): boolean {
  const window = findWindow('GameModify.ActivityTracker.' + String(port), null);
  return Boolean(window && postMessage(window, 0x10, 0, 0));
}
