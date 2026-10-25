import koffi from 'koffi';
const kernel = koffi.load('kernel32.dll');
const create = kernel.func('uintptr_t __stdcall CreateMutexW(void *,bool,str16)') as (
  security: null,
  owner: boolean,
  name: string,
) => number;
const lastError = kernel.func('uint32 __stdcall GetLastError()') as () => number;
const close = kernel.func('bool __stdcall CloseHandle(uintptr_t)') as (handle: number) => boolean;
export function desktopInstance(port: number): (() => void) | undefined {
  const handle = create(null, false, 'Local\\GameModify.ActivityTracker.' + String(port));
  const exists = lastError() === 183;
  if (!handle) throw new Error('Не удалось проверить запущенный трекер');
  if (exists) {
    close(handle);
    return undefined;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    close(handle);
  };
}
