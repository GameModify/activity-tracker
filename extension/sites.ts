export function sitePattern(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.origin + '/*' : null;
  } catch {
    return null;
  }
}
