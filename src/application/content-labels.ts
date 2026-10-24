import { ruleValue } from '../domain/classify.ts';
import type {
  ContentLabel,
  Rule,
  VideoChoice,
  VideoIdentity,
  VideoLabels,
} from '../domain/contracts.ts';
import type { TrackingStore } from './ports.ts';
function exactRule(rule: Rule, field: Rule['field'], value: string | undefined): boolean {
  return (
    rule.scope === 'media' &&
    rule.operator === 'equals' &&
    rule.field === field &&
    value !== undefined &&
    ruleValue(field, rule.value) === ruleValue(field, value)
  );
}
function selectedLabel(store: TrackingStore, field: Rule['field'], value?: string): string | null {
  const rule = store.rules().find((item) => item.enabled && exactRule(item, field, value));
  return (
    store
      .labels()
      .find(
        (label) =>
          label.activity === rule?.activity || label.aliases.includes(rule?.activity ?? ''),
      )?.id ?? null
  );
}
export function videoLabels(store: TrackingStore, input: VideoIdentity): VideoLabels {
  return {
    labels: store.labels(),
    video_label: selectedLabel(store, 'media_id', input.video_id),
    channel_label: selectedLabel(store, 'media_creator', input.creator),
  };
}
function choiceRule(input: VideoChoice, label: ContentLabel, id: string): Rule {
  return {
    id,
    enabled: true,
    name: label.name + ' · YouTube',
    operator: 'equals',
    field: input.target === 'video' ? 'media_id' : 'media_creator',
    value: input.target === 'video' ? input.video_id : (input.creator ?? ''),
    activity: label.activity,
    priority: input.target === 'video' ? 600 : 500,
    scope: 'media',
  };
}
export function chooseVideo(
  store: TrackingStore,
  input: VideoChoice,
  uuid: () => string,
): VideoLabels {
  if (input.target === 'channel' && !input.creator) throw new Error('Канал ещё не определён');
  const field = input.target === 'video' ? 'media_id' : 'media_creator';
  const value = input.target === 'video' ? input.video_id : input.creator;
  const matching = store.rules().filter((rule) => exactRule(rule, field, value));
  const label = store.labels().find((item) => item.id === input.label_id);
  if (input.label_id !== null && !label) throw new Error('Категория больше недоступна');
  const rules = store.rules().filter((rule) => !exactRule(rule, field, value));
  if (label) rules.push(choiceRule(input, label, matching[0]?.id ?? uuid()));
  if (rules.length > 200) throw new Error('Достигнут предел правил');
  store.replaceRules(rules);
  return videoLabels(store, input);
}
