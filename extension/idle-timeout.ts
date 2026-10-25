import { idleTimeoutSchema } from '../src/domain/contracts.ts';
export async function idleTimeout(): Promise<number> {
  const saved = await chrome.storage.local.get('server_idle_timeout_ms');
  return idleTimeoutSchema.catch(300000).parse(saved.server_idle_timeout_ms);
}

export function idleMinutes(timeout: number): string {
  const minutes = timeout / 60000;
  const ending = new Intl.PluralRules('ru').select(minutes);
  const word = ending === 'one' ? 'минута' : ending === 'few' ? 'минуты' : 'минут';
  return String(minutes) + ' ' + word;
}
