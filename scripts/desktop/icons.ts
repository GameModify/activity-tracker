import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
function pixel(x: number, y: number, size: number, paused: boolean): number[] {
  const dx = (x + 0.5) / size - 0.5,
    dy = (y + 0.5) / size - 0.5;
  const radius = Math.hypot(dx, dy);
  if (radius > 0.47) return [0, 0, 0, 0];
  const ring = radius > 0.36;
  const hand = paused
    ? Math.abs(dx) > 0.045 && Math.abs(dx) < 0.14 && Math.abs(dy) < 0.18
    : (Math.abs(dx) < 0.035 && dy > -0.24 && dy < 0.035) ||
      (dx > -0.02 && dx < 0.21 && Math.abs(dy - dx * 0.6) < 0.035);
  return ring || hand ? [255, 255, 255, 255] : paused ? [65, 133, 217, 255] : [213, 109, 126, 255];
}
function bitmap(size: number, paused: boolean): Buffer {
  const mask = Math.ceil(size / 32) * 4 * size;
  const data = Buffer.alloc(40 + size * size * 4 + mask);
  data.writeUInt32LE(40, 0);
  data.writeInt32LE(size, 4);
  data.writeInt32LE(size * 2, 8);
  data.writeUInt16LE(1, 12);
  data.writeUInt16LE(32, 14);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const rgba = pixel(x, y, size, paused);
      data.set(rgba, 40 + ((size - y - 1) * size + x) * 4);
    }
  return data;
}
export function iconFile(paused: boolean): Buffer {
  const sizes = [16, 32, 48, 64],
    images = sizes.map((size) => bitmap(size, paused));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + index * 16,
      size = sizes[index] ?? 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
}
export async function buildIcons(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'tracker.ico'), iconFile(false));
  await writeFile(path.join(directory, 'tracker-paused.ico'), iconFile(true));
}
