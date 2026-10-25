import { shellMenu } from '../../application/desktop-shell.ts';
import type { ShellActions, ShellMenuItem } from '../../application/desktop-shell.ts';
import {
  menuCreate,
  menuAppend,
  menuDestroy,
  cursor,
  foreground,
  postMessage,
  trackMenu,
} from './tray-native.ts';
interface MenuContext {
  window: number;
  menu: number;
  items: ShellMenuItem[];
  actions: ShellActions;
}
export function showTrayMenu(
  window: number,
  paused: boolean,
  actions: ShellActions,
  done: () => void,
): void {
  const menu = menuCreate(),
    items = shellMenu(paused);
  if (!menu) {
    done();
    return;
  }
  try {
    display({ window, menu, items, actions });
  } finally {
    menuDestroy(menu);
    postMessage(window, 0, 0, 0);
    done();
  }
}
function display({ window, menu, items, actions }: MenuContext): void {
  for (const item of items) menuAppend(menu, item.command ? 0 : 2, item.id, item.label);
  const point = { x: 0, y: 0 };
  cursor(point);
  foreground(window);
  const selected = trackMenu(menu, 0x102, point.x, point.y, window, null);
  const command = items.find((item) => item.id === selected)?.command;
  if (command) setImmediate(actions[command]);
}
