import koffi from 'koffi';
const kernel = koffi.load('kernel32.dll');
type Handle = number | bigint;
const open = kernel.func(
  'uintptr_t __stdcall CreateFileW(str16,uint32,uint32,void *,uint32,uint32,uintptr_t)',
) as (
  path: string,
  access: number,
  share: number,
  security: null,
  creation: number,
  flags: number,
  template: number,
) => Handle;
const close = kernel.func('bool __stdcall CloseHandle(uintptr_t)') as (handle: Handle) => boolean;
const finalPath = kernel.func(
  'uint32 __stdcall GetFinalPathNameByHandleW(uintptr_t,void *,uint32,uint32)',
) as (handle: Handle, output: Buffer, size: number, flags: number) => number;
export function physicalDirectory(directory: string): string {
  const handle = open(directory, 0, 7, null, 3, 0x02000000, 0);
  if (handle === 0 || handle === 0xffffffffffffffffn)
    throw new Error('Не удалось открыть каталог данных');
  try {
    const buffer = Buffer.alloc(65536);
    const count = finalPath(handle, buffer, buffer.length / 2, 0);
    if (!count || count >= buffer.length / 2)
      throw new Error('Не удалось определить физический каталог');
    return buffer.toString('utf16le', 0, count * 2);
  } finally {
    close(handle);
  }
}
