import { recordingProcessIds } from './audio.ts';
import { windowPresentation } from './presentation.ts';
import type { ForegroundWindow } from './resource.ts';
import koffi from 'koffi';
import path from 'node:path';
const user = koffi.load('user32.dll'),
  kernel = koffi.load('kernel32.dll');
koffi.struct('LASTINPUTINFO', { cbSize: 'uint32', dwTime: 'uint32' });
const foreground = user.func('uintptr_t __stdcall GetForegroundWindow()') as () => number;
const windowText = user.func('int __stdcall GetWindowTextW(uintptr_t, _Out_ uint16_t *, int)') as (
  handle: number,
  text: Buffer,
  size: number,
) => number;
const windowPid = user.func(
  'uint32 __stdcall GetWindowThreadProcessId(uintptr_t, _Out_ uint32_t *)',
) as (handle: number, pid: number[]) => number;
const lastInput = user.func('bool __stdcall GetLastInputInfo(_Inout_ LASTINPUTINFO *)') as (info: {
  cbSize: number;
  dwTime: number;
}) => boolean;
const ticks = kernel.func('uint32 __stdcall GetTickCount()') as () => number;
const openProcess = kernel.func('uintptr_t __stdcall OpenProcess(uint32, bool, uint32)') as (
  access: number,
  inherit: boolean,
  pid: number,
) => number;
const processImage = kernel.func(
  'bool __stdcall QueryFullProcessImageNameW(uintptr_t, uint32, _Out_ uint16_t *, _Inout_ uint32_t *)',
) as (handle: number, flags: number, text: Buffer, size: number[]) => boolean;
const closeHandle = kernel.func('bool __stdcall CloseHandle(uintptr_t)') as (
  handle: number,
) => boolean;
const waitForProcess = kernel.func('uint32 __stdcall WaitForSingleObject(uintptr_t, uint32)') as (
  handle: number,
  timeout: number,
) => number;
export function isProcessRunning(pid: number): boolean {
  const handle = openProcess(0x100000, false, pid);
  if (!handle) return false;
  try {
    return waitForProcess(handle, 0) === 0x102;
  } finally {
    closeHandle(handle);
  }
}
function processId(window: number): number {
  const pid = [0];
  return windowPid(window, pid) ? (pid[0] ?? 0) : 0;
}
export function idleMilliseconds(): number {
  const info = { cbSize: 8, dwTime: 0 };
  if (!lastInput(info)) throw new Error('Cannot query user input state');
  return (ticks() - info.dwTime) >>> 0;
}
export function processExecutable(pid: number): string {
  const handle = openProcess(0x1000, false, pid);
  if (!handle) return '';
  try {
    const text = Buffer.alloc(65536),
      size = [32768];
    return processImage(handle, 0, text, size)
      ? text.toString('utf16le', 0, (size[0] ?? 0) * 2)
      : '';
  } finally {
    closeHandle(handle);
  }
}
function processPath(window: number): string {
  const pid = [0];
  return windowPid(window, pid) && pid[0] ? processExecutable(pid[0]) : '';
}
export function isRecording(app: string): boolean {
  if (!/^(chatgpt|codex)\.exe$/i.test(app)) return false;
  return recordingProcessIds().some(
    (pid) => path.win32.basename(processExecutable(pid)).toLowerCase() === app.toLowerCase(),
  );
}
export function foregroundWindow(): ForegroundWindow | undefined {
  const handle = foreground();
  if (!handle) return undefined;
  const text = Buffer.alloc(2048),
    length = windowText(handle, text, 1024);
  const app_path = processPath(handle),
    app = path.win32.basename(app_path);
  if (!app || ['logonui.exe', 'lockapp.exe'].includes(app.toLowerCase())) return undefined;
  return {
    app,
    app_path,
    process_id: processId(handle),
    ...windowPresentation(handle),
    handle,
    title: text.toString('utf16le', 0, Math.max(0, length) * 2).slice(0, 500),
  };
}
