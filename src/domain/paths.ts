function normalizedPath(value: string): string | undefined {
  const text = value.replaceAll('\\', '/').toLocaleLowerCase();
  if (!/^(?:[a-z]:\/|\/\/[^/]+\/[^/]+)/.test(text)) return undefined;
  const parts: string[] = [];
  for (const part of text.split('/')) {
    if (part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/').replace(/\/+$/, '');
}
export function withinFolder(value: string, folder: string): boolean {
  const actual = normalizedPath(value),
    parent = normalizedPath(folder);
  return Boolean(actual && parent && actual.startsWith(parent + '/'));
}

export function validFolder(value: string): boolean {
  return normalizedPath(value) !== undefined;
}
