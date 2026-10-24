import type { InteractionDiagnostic } from './interaction-diagnostics.ts';
type Reason = 'disabled' | 'permission' | 'paused' | 'waiting' | 'idle' | 'unfocused' | 'active';
interface InteractionView {
  heading: string;
  detail: string;
}
const views: Record<Reason, InteractionView> = {
  disabled: {
    heading: 'Сбор действий выключен',
    detail: 'Включи отправку событий в настройках расширения.',
  },
  permission: {
    heading: 'Учёт действий не включён',
    detail:
      'Доступ к видео не включает проверку действий. Разреши её для этого сайта кнопкой ниже.',
  },
  paused: { heading: 'Сбор приостановлен в сервисе', detail: 'Продолжи сбор в настройках сайта.' },
  waiting: {
    heading: 'Ждём действий на странице',
    detail:
      'Вернись в чат, прокрути его или начни ввод. Если сигнала нет, нажми «Проверить и запустить сбор».',
  },
  idle: {
    heading: '5 минут без действий',
    detail: 'Учёт приостановлен. Прокрути чат или начни ввод, чтобы продолжить.',
  },
  unfocused: {
    heading: 'Сигнал от чата получен',
    detail: 'Сейчас вкладка без фокуса. Вернись в чат, чтобы продолжить учёт.',
  },
  active: {
    heading: 'Действия обнаружены',
    detail: 'Активность передаётся в сервис. Категорию определяют правила на сайте.',
  },
};
function reason(
  diagnostic: InteractionDiagnostic | null,
  enabled: boolean,
  paused: boolean,
  now: number,
): Reason {
  if (!enabled) return 'disabled';
  if (!diagnostic?.selected || !diagnostic.permitted) return 'permission';
  if (paused) return 'paused';
  const state = diagnostic.state;
  if (!state || (!state.interaction_at && !state.recording) || now - state.observed_at >= 15000)
    return 'waiting';
  if (!state.recording && now - state.interaction_at >= 300000) return 'idle';
  return state.focused ? 'active' : 'unfocused';
}
export function interactionView(
  diagnostic: InteractionDiagnostic | null,
  enabled: boolean,
  paused: boolean,
  now = Date.now(),
): InteractionView {
  return views[reason(diagnostic, enabled, paused, now)];
}
