import koffi from 'koffi';
import { foregroundWindow } from './native.ts';
import type { ForegroundWindow } from './resource.ts';
import { eventWallTime } from './event-time.ts';
const user = koffi.load('user32.dll'),
  kernel = koffi.load('kernel32.dll');
const callbackType = koffi.proto(
  'void __stdcall ActivityForegroundCallback(uintptr_t,uint32,uintptr_t,int32,int32,uint32,uint32)',
);
const install = user.func(
  'uintptr_t __stdcall SetWinEventHook(uint32,uint32,uintptr_t,ActivityForegroundCallback *,uint32,uint32,uint32)',
) as (
  from: number,
  to: number,
  module: number,
  callback: bigint,
  process: number,
  thread: number,
  flags: number,
) => number;
const unhook = user.func('bool __stdcall UnhookWinEvent(uintptr_t)') as (handle: number) => boolean;
const peek = user.func(
  'bool __stdcall PeekMessageW(_Out_ void *,uintptr_t,uint32,uint32,uint32)',
) as (message: Buffer, window: number, from: number, to: number, remove: number) => boolean;
const translate = user.func('bool __stdcall TranslateMessage(const void *)') as (
  message: Buffer,
) => boolean;
const dispatch = user.func('intptr_t __stdcall DispatchMessageW(const void *)') as (
  message: Buffer,
) => number;
const ticks = kernel.func('uint32 __stdcall GetTickCount()') as () => number;
export interface WindowEvent {
  window: ForegroundWindow | undefined;
  timestamp: number;
}
const messages = new Set<Buffer>();
export function flushForeground(): void {
  for (const message of messages) pump(message);
}
function pump(message: Buffer): void {
  for (let count = 0; count < 100 && peek(message, 0, 0, 0, 1); count++) {
    translate(message);
    dispatch(message);
  }
}
function receive(listener: (event: WindowEvent) => void, window: number, time: number): void {
  try {
    listener({
      window: foregroundWindow(window),
      timestamp: eventWallTime(time, ticks(), Date.now()),
    });
  } catch {
    // The periodic desktop sample reconciles a window that disappeared during delivery.
  }
}
export function watchForeground(listener: (event: WindowEvent) => void): () => void {
  const callback = registerForeground(listener);
  const handle = install(3, 3, 0, callback, 0, 0, 0);
  if (!handle) {
    koffi.unregister(callback);
    throw new Error('Cannot observe foreground events');
  }
  const message = Buffer.alloc(process.arch === 'ia32' ? 28 : 48);
  messages.add(message);
  const timer = setInterval(() => {
    pump(message);
  }, 25);
  return () => {
    clearInterval(timer);
    messages.delete(message);
    unhook(handle);
    koffi.unregister(callback);
  };
}

function registerForeground(listener: (event: WindowEvent) => void): bigint {
  return koffi.register(
    (
      _hook: number,
      _event: number,
      window: number,
      _object: number,
      _child: number,
      _thread: number,
      time: number,
    ) => {
      receive(listener, window, time);
    },
    koffi.pointer(callbackType),
  );
}
