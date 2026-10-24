export function element<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error('Missing element: ' + id);
  return node;
}
export function text(id: string, value: string): void {
  element(id, HTMLElement).textContent = value;
}
