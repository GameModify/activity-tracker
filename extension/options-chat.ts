import { browserPreferencesSchema } from '../src/domain/contracts.ts';
import { browserPreferencesRequest } from './http.ts';
import { settings } from './model.ts';
import { element } from './ui.ts';
export async function loadChat(): Promise<void> {
  if (!(await settings()).token) return;
  element('science-chat', HTMLInputElement).value = (
    await browserPreferencesRequest()
  ).science_chat_id;
}
export async function saveChat(): Promise<void> {
  const input = browserPreferencesSchema.parse({
    science_chat_id: element('science-chat', HTMLInputElement).value.trim(),
  });
  await browserPreferencesRequest(input);
  element('status', HTMLParagraphElement).textContent =
    'Научный чат сохранён. Другие чаты не будут считаться наукой.';
}
