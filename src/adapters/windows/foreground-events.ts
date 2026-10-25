import { flushMessages, watchMessages } from './message-loop.ts';
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
const ticks = kernel.func('uint32 __stdcall GetTickCount()') as () => number;
export interface WindowEvent {
  window: ForegroundWindow | undefined;
  timestamp: number;
}
export function flushForeground(): void {
  flushMessages();
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
  const stopMessages = watchMessages();
  return () => {
    stopMessages();
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
