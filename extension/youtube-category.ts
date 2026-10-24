import { videoIdentitySchema } from '../src/domain/contracts.ts';
import type { VideoIdentity, VideoLabels } from '../src/domain/contracts.ts';
import type { VideoLabelMessage } from './video-label-model.ts';
import type { ContentRuntime } from './content-runtime.ts';
import { videoContext } from './video-context.ts';
import { VideoLabelClient } from './video-label-client.ts';
import { YouTubeCategoryView } from './youtube-category-view.ts';
type YouTubePage = Pick<Location, 'href' | 'hostname'>;
function mountPoint(page: YouTubePage) {
  const context = videoContext(document, page.href);
  const input = videoIdentitySchema.safeParse({
    video_id: context.media_id,
    creator: context.media_creator,
  });
  const owner = document.querySelector('ytd-watch-metadata #owner');
  const anchor = owner?.querySelector('#subscribe-button, ytd-subscribe-button-renderer');
  return input.success && anchor ? { input: input.data, anchor } : undefined;
}
function choice(view: YouTubeCategoryView): VideoLabelMessage['choice'] {
  return {
    target: view.scope.value === 'channel' ? 'channel' : 'video',
    label_id: view.category.value || null,
  };
}
function savedMessage(state: VideoLabels, selection: VideoLabelMessage['choice']): string {
  if (!selection) return '';
  if (selection.label_id !== null) return 'Сохранено. Другие записи истории не изменены.';
  if (selection.target === 'video')
    return 'Категория видео сброшена. Используется категория канала или обычный просмотр YouTube.';
  return state.video_label
    ? 'Категория канала сброшена. У этого видео осталось отдельное правило.'
    : 'Категория канала сброшена. Используется обычный просмотр YouTube.';
}
class YouTubeCategory {
  page: YouTubePage;
  runtime: ContentRuntime;
  client: VideoLabelClient;
  view: YouTubeCategoryView | undefined;
  identity: VideoIdentity | undefined;
  key = '';
  revision = 0;
  state: VideoLabels | undefined;
  unbind: (() => void)[] = [];
  constructor(runtime: ContentRuntime, port: chrome.runtime.Port, page: YouTubePage) {
    this.page = page;
    this.runtime = runtime;
    this.client = new VideoLabelClient(port);
    runtime.cleanups.push(() => {
      this.unmount();
      this.client.stop();
    });
    this.bindPage(runtime);
  }
  bindPage(runtime: ContentRuntime): void {
    runtime.listen(document, 'yt-navigate-finish', this.refresh);
    runtime.listen(window, 'focus', this.focus);
    runtime.listen(window, 'resize', () => {
      this.view?.show(false);
    });
    runtime.listen(document, 'keydown', (event) => {
      if (
        event instanceof KeyboardEvent &&
        event.key === 'Escape' &&
        this.view?.panel.hidden === false
      ) {
        this.view.show(false);
        this.view.trigger.focus();
      }
    });
    runtime.listen(document, 'pointerdown', (event) => {
      if (this.view && !event.composedPath().includes(this.view.host)) this.view.show(false);
    });
  }
  focus = (): void => {
    if (this.view?.panel.hidden === true) this.load();
  };
  unmount(): void {
    for (const remove of this.unbind.splice(0)) remove();
    this.view?.host.remove();
    this.view = undefined;
  }
  reset(input: VideoIdentity): void {
    this.unmount();
    this.identity = input;
    this.state = undefined;
    this.revision++;
    this.key = input.video_id + ':' + (input.creator ?? '');
  }
  refresh = (): void => {
    const current = mountPoint(this.page);
    if (!current) {
      this.unmount();
      return;
    }
    const key = current.input.video_id + ':' + (current.input.creator ?? '');
    if (key !== this.key) this.reset(current.input);
    if (!this.view) this.mount();
    if (this.view && !this.view.host.isConnected) current.anchor.after(this.view.host);
  };
  mount(): void {
    const view = new YouTubeCategoryView();
    this.view = view;
    this.bindControls(view);
    this.preview();
    this.load();
  }
  bindControls(view: YouTubeCategoryView): void {
    const listen = this.runtime.listen.bind(this.runtime);
    this.unbind.push(
      listen(view.trigger, 'click', () => {
        view.show(view.panel.hidden === true);
        if (!view.panel.hidden) this.load();
      }),
    );
    this.unbind.push(
      listen(view.cancel, 'click', () => {
        view.show(false);
        view.trigger.focus();
      }),
    );
    this.bindSelection(view);
    this.bindResets(view);
  }
  bindResets(view: YouTubeCategoryView): void {
    const buttons = [
      { button: view.clearChannel, target: 'channel' },
      { button: view.clearVideo, target: 'video' },
    ] as const;
    for (const { button, target } of buttons)
      this.unbind.push(
        this.runtime.listen(button, 'click', (event) => {
          if (event.isTrusted) this.load({ target, label_id: null });
        }),
      );
  }
  bindSelection(view: YouTubeCategoryView): void {
    const listen = this.runtime.listen.bind(this.runtime);
    this.unbind.push(
      listen(view.scope, 'change', () => {
        if (this.state) view.setLabels(this.state);
        this.preview();
      }),
    );
    this.unbind.push(
      listen(view.category, 'change', () => {
        this.preview();
      }),
    );
    this.unbind.push(
      listen(view.save, 'click', (event) => {
        if (event.isTrusted) this.load(choice(view));
      }),
    );
  }
  preview(): void {
    const view = this.view;
    if (!view) return;
    const channel = view.scope.querySelector<HTMLOptionElement>('option[value="channel"]');
    if (channel) channel.disabled = !this.identity?.creator;
    view.hint.textContent =
      view.scope.value === 'channel'
        ? 'Будущие видео канала ' +
          (this.identity?.creator ?? '') +
          '. Правило отдельного видео важнее.'
        : 'Будущие просмотры этого видео. Остальные видео канала останутся прежними.';
    if (!view.category.value)
      view.hint.textContent +=
        ' Без отдельного правила используется категория канала или обычный просмотр YouTube.';
  }
  apply(
    view: YouTubeCategoryView,
    revision: number,
    state: VideoLabels,
    selection: VideoLabelMessage['choice'],
  ): void {
    if (revision !== this.revision || !this.runtime.available()) return;
    this.state = state;
    view.setLabels(state);
    view.status.textContent = savedMessage(state, selection);
    if (!state.labels.length)
      view.status.textContent = 'Подключи сайт Time & Games к трекеру: категории ещё не получены.';
    this.preview();
  }
  failed(view: YouTubeCategoryView, revision: number): void {
    if (revision === this.revision)
      view.status.textContent = 'Нет связи с трекером. Проверь подключение и повтори.';
  }
  ready(view: YouTubeCategoryView, revision: number): void {
    if (revision !== this.revision) return;
    view.busy(false);
    if (!this.state?.labels.length) view.save.disabled = true;
    if (view.panel.hidden === false && !view.root.activeElement) view.category.focus();
  }
  load(selection?: VideoLabelMessage['choice']): void {
    const input = this.identity,
      view = this.view,
      revision = ++this.revision;
    if (!input || !view) return;
    view.busy(true);
    view.status.textContent = '';
    void this.client
      .request(input, selection)
      .then((state) => {
        this.apply(view, revision, state, selection);
      })
      .catch(() => {
        this.failed(view, revision);
      })
      .finally(() => {
        this.ready(view, revision);
      });
  }
}
export function youtubeCategories(
  runtime: ContentRuntime,
  page: YouTubePage = location,
): () => void {
  if (
    !['www.youtube.com', 'youtube.com'].includes(page.hostname) ||
    window.top !== window ||
    !runtime.port
  )
    return () => undefined;
  const controller = new YouTubeCategory(runtime, runtime.port, page);
  return controller.refresh;
}
