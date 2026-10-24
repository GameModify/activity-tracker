import type { Observation, Rule } from './contracts.ts';
export interface ChatGPTProject {
  id: string;
  name: string;
}
export function chatGPTSite(value: string): boolean {
  const url = URL.parse(value);
  return Boolean(
    url && url.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(url.hostname),
  );
}
export function chatGPTProject(value: string): ChatGPTProject | undefined {
  if (!chatGPTSite(value)) return undefined;
  const path = URL.parse(value)?.pathname ?? '';
  const match = /^\/g\/(g-p-[a-f0-9]{32})(?:-([^/]+))?(?:\/|$)/i.exec(path);
  if (!match?.[1]) return undefined;
  let name = match[2] ?? '';
  try {
    name = decodeURIComponent(name);
  } catch {
    name = match[2] ?? '';
  }
  return {
    id: match[1].toLowerCase(),
    name: name.replaceAll('-', ' ').trim().slice(0, 100) || 'Без названия',
  };
}
function browserAssistant(sample: Observation): Observation {
  const project = chatGPTProject(sample.url);
  const name =
    project && sample.chatgpt_project?.id === project.id
      ? sample.chatgpt_project.name
      : project?.name;
  return {
    ...sample,
    title: project ? 'Проект ChatGPT: ' + (name ?? 'Без названия') : 'Общаюсь с ChatGPT',
    resource_kind: 'app',
    resource_id: project ? 'chatgpt:project:' + project.id : 'chatgpt:chat',
    recording: sample.recording === true && sample.interaction_at !== undefined,
  };
}
export function assistantObservation(sample: Observation): Observation {
  if (sample.kind !== 'focus') return sample;
  if (sample.source === 'windows' && /^(chatgpt|codex)\.exe$/i.test(sample.app))
    return {
      ...sample,
      title: 'Работа с Codex',
      resource_kind: 'app',
      resource_id: 'codex:desktop',
    };
  return sample.source === 'chrome' && chatGPTSite(sample.url) ? browserAssistant(sample) : sample;
}
export function assistantActivity(sample: Observation): string | undefined {
  if (sample.source === 'windows' && sample.resource_id === 'codex:desktop') return 'projects';
  if (sample.source !== 'chrome' || !chatGPTSite(sample.url)) return undefined;
  return chatGPTProject(sample.url) ? 'projects' : 'communication';
}
export function assistantTitle(sample: Observation, rule?: Rule): string {
  if (
    sample.resource_id?.startsWith('chatgpt:project:') &&
    rule?.field === 'resource_id' &&
    rule.operator === 'equals'
  )
    return 'Проект ChatGPT: ' + rule.name;
  return sample.title;
}
