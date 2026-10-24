import { comNumber, comPointer, createEnumerator, guid, usingCom, withAudio } from './audio-com.ts';
const managerId = guid('77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F');
const controlId = guid('BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D');
function sessionProcess(control: bigint): number[] {
  const extended = comPointer(
    control,
    0,
    'int32_t __stdcall CaptureQuery(uintptr_t, const uint8_t *, _Out_ uint64_t *)',
    [controlId],
  );
  return usingCom(extended, (session) =>
    comNumber(session, 3) === 1 ? [comNumber(session, 14)] : [],
  );
}
function sessionProcesses(enumerator: bigint): number[] {
  const result: number[] = [],
    count = comNumber(enumerator, 3);
  for (let index = 0; index < count; index++) {
    const session = comPointer(
      enumerator,
      4,
      'int32_t __stdcall CaptureSession(uintptr_t, int32_t, _Out_ uint64_t *)',
      [index],
    );
    result.push(...usingCom(session, sessionProcess));
  }
  return result;
}
function deviceProcesses(device: bigint): number[] {
  const manager = comPointer(
    device,
    3,
    'int32_t __stdcall CaptureActivate(uintptr_t, const uint8_t *, uint32_t, uintptr_t, _Out_ uint64_t *)',
    [managerId, 23, 0n],
  );
  return usingCom(manager, (audio) => {
    const enumerator = comPointer(
      audio,
      5,
      'int32_t __stdcall CaptureEnumerate(uintptr_t, _Out_ uint64_t *)',
    );
    return usingCom(enumerator, sessionProcesses);
  });
}
function collectionProcesses(devices: bigint): number[] {
  const result: number[] = [],
    count = comNumber(devices, 3);
  for (let index = 0; index < count; index++) {
    const device = comPointer(
      devices,
      4,
      'int32_t __stdcall CaptureDevice(uintptr_t, uint32_t, _Out_ uint64_t *)',
      [index],
    );
    result.push(...usingCom(device, deviceProcesses));
  }
  return result;
}
function endpointProcesses(enumerator: bigint): number[] {
  const collection = comPointer(
    enumerator,
    3,
    'int32_t __stdcall CaptureEndpoints(uintptr_t, int32_t, uint32_t, _Out_ uint64_t *)',
    [1, 1],
  );
  return usingCom(collection, collectionProcesses);
}
export function captureSnapshot(): { available: boolean; processIds: number[] } {
  try {
    return {
      available: true,
      processIds: withAudio(() => usingCom(createEnumerator(), endpointProcesses)),
    };
  } catch {
    return { available: false, processIds: [] };
  }
}
export function recordingProcessIds(): number[] {
  return captureSnapshot().processIds;
}
