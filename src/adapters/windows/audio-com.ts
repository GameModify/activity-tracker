import koffi from 'koffi';
import { z } from 'zod';
import type { TypeObject } from 'koffi';
const ole = koffi.load('ole32.dll');
const initialize = ole.func('int32_t __stdcall CoInitializeEx(uintptr_t, uint32_t)') as (
  reserved: bigint,
  mode: number,
) => number;
const uninitialize = ole.func('void __stdcall CoUninitialize()') as () => void;
const create = ole.func(
  'int32_t __stdcall CoCreateInstance(const uint8_t *, uintptr_t, uint32_t, const uint8_t *, _Out_ uint64_t *)',
) as (clsid: Buffer, outer: bigint, context: number, iid: Buffer, output: Buffer) => number;
const prototypes = new Map<string, TypeObject>();
type Argument = bigint | number | Buffer;
export function guid(value: string): Buffer {
  const bytes = Buffer.from(value.replaceAll('-', ''), 'hex');
  return Buffer.concat([
    bytes.subarray(0, 4).reverse(),
    bytes.subarray(4, 6).reverse(),
    bytes.subarray(6, 8).reverse(),
    bytes.subarray(8),
  ]);
}
export function check(result: number): void {
  if (result < 0) throw new Error('Core Audio call failed: ' + String(result));
}
export function comCall(
  pointer: bigint,
  index: number,
  declaration: string,
  args: Argument[] = [],
): number {
  const table = z.coerce.bigint().parse(koffi.decode(pointer, 'uintptr_t'));
  const method = z.coerce.bigint().parse(koffi.decode(table, index * 8, 'uintptr_t'));
  let prototype = prototypes.get(declaration);
  if (!prototype) {
    prototype = koffi.proto(declaration);
    prototypes.set(declaration, prototype);
  }
  return z.number().parse(koffi.call(method, prototype, pointer, ...args));
}
export function comPointer(
  pointer: bigint,
  index: number,
  declaration: string,
  args: Argument[] = [],
): bigint {
  const output = Buffer.alloc(8);
  check(comCall(pointer, index, declaration, [...args, output]));
  const result = output.readBigUInt64LE();
  if (!result) throw new Error('Core Audio returned a null interface');
  return result;
}
export function comNumber(pointer: bigint, index: number): number {
  const output = Buffer.alloc(4);
  check(
    comCall(pointer, index, 'int32_t __stdcall CaptureNumber(uintptr_t, _Out_ uint32_t *)', [
      output,
    ]),
  );
  return output.readUInt32LE();
}
export function usingCom<T>(pointer: bigint, operation: (pointer: bigint) => T): T {
  try {
    return operation(pointer);
  } finally {
    comCall(pointer, 2, 'uint32_t __stdcall CaptureRelease(uintptr_t)');
  }
}
export function createEnumerator(): bigint {
  const output = Buffer.alloc(8);
  check(
    create(
      guid('BCDE0395-E52F-467C-8E3D-C4579291692E'),
      0n,
      1,
      guid('A95664D2-9614-4F35-A746-DE8DB63617E6'),
      output,
    ),
  );
  return output.readBigUInt64LE();
}
export function withAudio<T>(operation: () => T): T {
  if (koffi.sizeof('void *') !== 8) throw new Error('Core Audio requires a 64-bit runtime');
  const initialized = initialize(0n, 0);
  if (initialized !== -2147417850) check(initialized);
  try {
    return operation();
  } finally {
    if (initialized >= 0) uninitialize();
  }
}
