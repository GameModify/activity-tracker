import type { VideoLabels } from '../src/domain/contracts.ts';
import { categoryStyle } from './youtube-category-style.ts';
export function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}
export function option(value: string, text: string): HTMLOptionElement {
  const item = node('option', text);
  item.value = value;
  return item;
}
export class YouTubeCategoryView {
  host = node('span');
  root = this.host.attachShadow({ mode: 'open' });
  trigger = node('button', 'Категория: YouTube');
  panel = node('section');
  category = node('select');
  scope = node('select');
  hint = node('p');
  status = node('p');
  save = node('button', 'Применить');
  cancel = node('button', 'Закрыть');
  constructor() {
    const style = node('style', categoryStyle);
    this.host.dataset.activityTracker = 'youtube-category';
    this.trigger.className = 'trigger';
    this.trigger.type = 'button';
    this.trigger.setAttribute('aria-expanded', 'false');
    this.panel.className = 'panel';
    this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'Категория просмотра YouTube');
    this.scope.append(option('video', 'Только это видео'), option('channel', 'Весь канал'));
    this.save.className = 'save';
    this.hint.className = 'hint';
    this.status.setAttribute('role', 'status');
    this.buildPanel();
    this.root.append(style, this.trigger, this.panel);
  }
  buildPanel(): void {
    const actions = node('div');
    actions.className = 'actions';
    actions.append(this.cancel, this.save);
    this.panel.append(
      node('h3', 'Категория просмотра'),
      this.field('Категория', this.category),
      this.field('Применить к', this.scope),
      this.hint,
      this.status,
      actions,
    );
  }
  field(text: string, control: HTMLSelectElement): HTMLLabelElement {
    const label = node('label', text);
    label.append(control);
    return label;
  }
  setLabels(state: VideoLabels): void {
    const selected = this.scope.value === 'channel' ? state.channel_label : state.video_label;
    this.category.replaceChildren(
      option('', this.defaultLabel(state)),
      ...state.labels.map((label) => option(label.id, label.name)),
    );
    this.category.value = selected ?? '';
    const effective = state.labels.find(
      (label) => label.id === (state.video_label ?? state.channel_label),
    );
    this.trigger.textContent = 'Категория: ' + (effective?.name ?? 'YouTube');
    this.save.disabled = !state.labels.length;
  }
  defaultLabel(state: VideoLabels): string {
    const channel = state.labels.find((label) => label.id === state.channel_label);
    return this.scope.value === 'video' && channel
      ? 'Как у канала: ' + channel.name
      : 'По умолчанию: YouTube';
  }
  show(open: boolean): void {
    this.panel.hidden = !open;
    this.trigger.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const rect = this.trigger.getBoundingClientRect();
    this.panel.style.left = String(Math.max(12, Math.min(rect.left, innerWidth - 352))) + 'px';
    const height = this.panel.offsetHeight,
      below = rect.bottom + 8;
    const top = below + height <= innerHeight - 12 ? below : Math.max(12, rect.top - height - 8);
    this.panel.style.top = String(top) + 'px';
    this.category.focus();
  }
  busy(value: boolean): void {
    this.save.disabled = value;
    this.category.disabled = value;
    this.scope.disabled = value;
  }
}
