export interface VideoContext {
  media_creator?: string;
  media_id?: string;
}
export function videoContext(document: Document, value: string): VideoContext {
  const url = URL.parse(value);
  if (!url || !/(^|\.)youtube\.com$/.test(url.hostname)) return {};
  const channel = document.querySelector<HTMLAnchorElement>(
    'ytd-watch-metadata #owner a[href^="/@"], ytd-watch-metadata #owner a[href^="/channel/"]',
  );
  const creator = channel ? URL.parse(channel.href)?.pathname : undefined;
  return {
    media_creator: creator?.slice(0, 200),
    media_id: url.searchParams.get('v')?.slice(0, 100),
  };
}
