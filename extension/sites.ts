export const allSites = ['https://*/*', 'http://*/*'];
export function sitePattern(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.origin + '/*' : null;
  } catch {
    return null;
  }
}
export function validPattern(value: string): boolean {
  return allSites.includes(value) || sitePattern(value) === value;
}
export function includesSite(patterns: string[], value: string): boolean {
  const site = sitePattern(value);
  return Boolean(
    site &&
    (patterns.includes(site) ||
      patterns.includes(site.startsWith('https:') ? (allSites[0] ?? '') : (allSites[1] ?? ''))),
  );
}
