export function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error('Не найден элемент ' + id);
  return node;
}
export function text(id: string, value: string): void {
  element(id, HTMLElement).textContent = value;
}
export function notice(error: unknown): void {
  text('notice', error instanceof Error ? error.message : 'Ошибка');
}
