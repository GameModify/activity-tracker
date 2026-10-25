import koffi from 'koffi';
const user = koffi.load('user32.dll');
const peek = user.func(
  'bool __stdcall PeekMessageW(_Out_ void *,uintptr_t,uint32,uint32,uint32)',
) as (message: Buffer, window: number, from: number, to: number, remove: number) => boolean;
const translate = user.func('bool __stdcall TranslateMessage(const void *)') as (
  message: Buffer,
) => boolean;
const dispatch = user.func('intptr_t __stdcall DispatchMessageW(const void *)') as (
  message: Buffer,
) => number;
const message = Buffer.alloc(process.arch === 'ia32' ? 28 : 48),
  watchers = new Set<symbol>();
let timer: ReturnType<typeof setInterval> | undefined;
export function flushMessages(): void {
  for (let count = 0; count < 100 && peek(message, 0, 0, 0, 1); count++) {
    translate(message);
    dispatch(message);
  }
}
export function watchMessages(): () => void {
  const key = Symbol();
  watchers.add(key);
  timer ??= setInterval(flushMessages, 25);
  return () => {
    watchers.delete(key);
    if (!watchers.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
