import koffi from 'koffi';
import { coversMonitor } from '../../domain/screen.ts';
import type { ScreenRect } from '../../domain/screen.ts';
const user = koffi.load('user32.dll');
const rectType = koffi.struct('TRACKER_RECT', {
  left: 'int32',
  top: 'int32',
  right: 'int32',
  bottom: 'int32',
});
const pointType = koffi.struct('TRACKER_POINT', { x: 'int32', y: 'int32' });
const monitorType = koffi.struct('TRACKER_MONITORINFO', {
  cbSize: 'uint32',
  rcMonitor: rectType,
  rcWork: rectType,
  dwFlags: 'uint32',
});
interface MonitorInfo {
  cbSize: number;
  rcMonitor: ScreenRect;
  rcWork: ScreenRect;
  dwFlags: number;
}
const clientRect = user.func('GetClientRect', 'bool', [
  'uintptr_t',
  koffi.out(koffi.pointer(rectType)),
]) as (handle: number, rect: ScreenRect) => boolean;
const toScreen = user.func('ClientToScreen', 'bool', [
  'uintptr_t',
  koffi.inout(koffi.pointer(pointType)),
]) as (handle: number, point: { x: number; y: number }) => boolean;
const monitorFromWindow = user.func('uintptr_t __stdcall MonitorFromWindow(uintptr_t, uint32)') as (
  handle: number,
  flags: number,
) => number;
const monitorInfo = user.func('GetMonitorInfoW', 'bool', [
  'uintptr_t',
  koffi.inout(koffi.pointer(monitorType)),
]) as (handle: number, info: MonitorInfo) => boolean;
const dpiContext = user.func('intptr_t __stdcall SetThreadDpiAwarenessContext(intptr_t)') as (
  context: number,
) => number;
const emptyRect = (): ScreenRect => ({ left: 0, top: 0, right: 0, bottom: 0 });
function clientBounds(handle: number): ScreenRect | undefined {
  const rect = emptyRect(),
    origin = { x: 0, y: 0 };
  if (!clientRect(handle, rect) || !toScreen(handle, origin)) return undefined;
  return {
    left: origin.x,
    top: origin.y,
    right: origin.x + rect.right,
    bottom: origin.y + rect.bottom,
  };
}
function presentation(handle: number) {
  const info: MonitorInfo = { cbSize: 40, rcMonitor: emptyRect(), rcWork: emptyRect(), dwFlags: 0 };
  const monitor = monitorFromWindow(handle, 2),
    rect = clientBounds(handle);
  if (!monitor || !rect || !monitorInfo(monitor, info)) return { fullscreen: false };
  return {
    fullscreen: coversMonitor(rect, info.rcMonitor),
    monitor: info.dwFlags & 1 ? ('primary' as const) : ('secondary' as const),
  };
}
export function windowPresentation(handle: number) {
  const previous = dpiContext(-4);
  try {
    return presentation(handle);
  } finally {
    if (previous) dpiContext(previous);
  }
}
