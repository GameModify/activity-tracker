import { settings } from './model.ts';
export async function pendingSites(patterns: (string | null)[]): Promise<string[]> {
  const config = await settings(),
    missing: string[] = [];
  for (const pattern of new Set(patterns)) {
    if (!pattern) continue;
    const selected = config.sites.includes(pattern);
    if (!selected || !(await chrome.permissions.contains({ origins: [pattern] })))
      missing.push(pattern);
  }
  return missing;
}
