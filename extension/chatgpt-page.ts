import type { Observation } from '../src/domain/contracts.ts';
const projectPath = /^\/g\/(g-p-[a-f0-9]{32})(?:-([^/]+))?(?:\/|$)/i;
export function chatGPTUrl(value: string): URL | undefined {
  const url = URL.parse(value);
  return url?.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(url.hostname)
    ? url
    : undefined;
}
function projectLink(document: Document, id: string): HTMLAnchorElement | undefined {
  const links = document.querySelectorAll<HTMLAnchorElement>(
    'nav a[href], aside a[href], [data-testid="sidebar"] a[href]',
  );
  return Array.from(links).find(
    (item) =>
      projectPath.exec(URL.parse(item.href)?.pathname ?? '')?.[1]?.toLowerCase() === id &&
      !/\/c\//.test(item.pathname),
  );
}
export function chatGPTProjectContext(
  document: Document,
  value: string,
): Observation['chatgpt_project'] {
  const url = chatGPTUrl(value);
  const id = url && projectPath.exec(url.pathname)?.[1]?.toLowerCase();
  if (!id) return undefined;
  const name = (projectLink(document, id)?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return name ? { id, name } : undefined;
}
export function chatGPTRecording(document: Document, value: string): boolean {
  if (!chatGPTUrl(value)) return false;
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]')).some(
    (button) =>
      /^(stop|cancel) (recording|dictation)$|^(остановить|завершить|отменить) (запись|диктовку)$/i.test(
        button.getAttribute('aria-label') ?? '',
      ) &&
      !button.disabled &&
      button.getClientRects().length > 0,
  );
}

export function chatGPTLabel(
  value: string,
  project?: Observation['chatgpt_project'],
): string | undefined {
  const url = chatGPTUrl(value);
  if (!url) return undefined;
  const match = projectPath.exec(url.pathname);
  if (!match?.[1]) return 'Общаюсь с ChatGPT';
  let name = match[2] ?? 'Без названия';
  try {
    name = decodeURIComponent(name);
  } catch {
    name = 'Без названия';
  }
  return (
    'Проект ChatGPT: ' +
    (project?.id === match[1].toLowerCase() ? project.name : name.replaceAll('-', ' '))
  );
}

export function chatGPTMetadata(
  document: Document,
  value: string,
): Pick<Observation, 'chatgpt_project' | 'recording'> {
  return chatGPTUrl(value)
    ? {
        chatgpt_project: chatGPTProjectContext(document, value),
        recording: chatGPTRecording(document, value),
      }
    : {};
}
