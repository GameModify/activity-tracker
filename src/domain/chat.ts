import type { Observation, Rule } from './contracts.ts';
export function vkChat(value: string): string | undefined {
  const url = URL.parse(value);
  if (!url || !/(^|\.)vk\.(com|ru)$/i.test(url.hostname)) return undefined;
  const path = /^\/im\/convo\/(-?\d+)\/?$/.exec(url.pathname)?.[1];
  const legacy = /^\/im\/?$/.test(url.pathname) ? url.searchParams.get('sel') : null;
  const id = path ?? legacy;
  return id && /^-?\d+$/.test(id) ? id : undefined;
}
export function requiresChatRule(sample: Observation): boolean {
  const host = URL.parse(sample.url)?.hostname ?? '';
  return sample.source === 'chrome' && sample.kind === 'focus' && /(^|\.)vk\.(com|ru)$/i.test(host);
}
export function chatContext(sample: Observation, rule?: Rule) {
  const id = requiresChatRule(sample) ? vkChat(sample.url) : undefined;
  return {
    resource_id: id ? 'vk-chat:' + id : sample.resource_id,
    title: id && rule ? rule.name : sample.title,
  };
}
