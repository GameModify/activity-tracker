import { vkChat } from '../domain/chat.ts';
import type { BrowserPreferences, Rule } from '../domain/contracts.ts';
import type { TrackingStore } from './ports.ts';
function scienceRule(rule: Rule): boolean {
  return (
    rule.activity === 'science' &&
    rule.field === 'url' &&
    rule.operator === 'equals' &&
    Boolean(vkChat(rule.value))
  );
}
export function browserPreferences(store: TrackingStore): BrowserPreferences {
  const rule = store.rules().find(scienceRule);
  return { science_chat_id: rule ? (vkChat(rule.value) ?? '') : '' };
}
export function configureBrowser(
  store: TrackingStore,
  input: BrowserPreferences,
  uuid: () => string,
): void {
  const rules = store.rules().filter((rule) => !scienceRule(rule));
  store.replaceRules([...rules, ...chatRules(input.science_chat_id, uuid)]);
}

function chatRules(id: string, uuid: () => string): Rule[] {
  if (!id) return [];
  return ['vk.com', 'vk.ru'].flatMap((host) =>
    ['/im/convo/', '/im?sel='].map((path) => ({
      id: uuid(),
      name: 'Научный руководитель',
      field: 'url' as const,
      operator: 'equals' as const,
      enabled: true,
      value: 'https://' + host + path + id,
      activity: 'science',
      priority: 200,
      scope: 'focus' as const,
    })),
  );
}
