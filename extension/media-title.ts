export function mediaTitle(title: string, url: string): string {
  const host = URL.parse(url)?.hostname ?? '';
  if (!/(^|\.)youtube\.com$|^youtu\.be$/i.test(host)) return title.slice(0, 500);
  const name = title.replace(/\s*[-–—|]\s*YouTube\s*$/i, '').trim();
  return ('YouTube: ' + name).slice(0, 500);
}
