import type { Rule } from './contracts.ts';
interface DefaultRule {
  name: string;
  field: Rule['field'];
  value: string;
  activity: string;
  priority: number;
}
const defaults: DefaultRule[] = [
  { name: 'Редактор кода', field: 'app', value: 'Code.exe', activity: 'coding', priority: 20 },
  { name: 'Работа в Codex', field: 'app', value: 'Codex.exe', activity: 'projects', priority: 20 },
  {
    name: 'Работа с Codex',
    field: 'app',
    value: 'ChatGPT.exe',
    activity: 'projects',
    priority: 20,
  },
  { name: 'Воспроизведение', field: 'kind', value: 'media', activity: 'video', priority: 10 },
];
export function defaultRules(uuid: () => string): Rule[] {
  return defaults.map((rule) => ({ ...rule, id: uuid(), operator: 'equals', enabled: true }));
}
