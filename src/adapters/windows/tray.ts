import koffi from 'koffi';
import path from 'node:path';
import type { DesktopShell, ShellActions } from '../../application/desktop-shell.ts';
import type { NotificationIcon } from './tray-types.ts';
import { watchMessages } from './message-loop.ts';
import {
  endMenu,
  procedure,
  moduleHandle,
  registerClass,
  createWindow,
  defaultProcedure,
  destroyWindow,
  unregisterClass,
  loadIcon,
  destroyIcon,
  registerMessage,
  notify,
} from './tray-native.ts';
import { iconData, addIcon, trayMessage } from './tray-icon.ts';
import { showTrayMenu } from './tray-menu.ts';
class WindowsTray implements DesktopShell {
  window = 0;
  callback = 0n;
  instance = moduleHandle(null);
  name: string;
  taskbarCreated = registerMessage('TaskbarCreated');
  icons: number[];
  data: NotificationIcon | undefined;
  stopMessages: () => void = () => undefined;
  paused: boolean;
  showingMenu = false;
  actions: ShellActions;
  constructor(directory: string, paused: boolean, actions: ShellActions, port: number) {
    this.name = 'GameModify.ActivityTracker.' + String(port);
    this.paused = paused;
    this.actions = actions;
    this.icons = ['tracker.ico', 'tracker-paused.ico'].map((file) =>
      loadIcon(0, path.join(directory, file), 1, 0, 0, 0x50),
    );
    try {
      this.start();
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  start(): void {
    this.callback = koffi.register(this.receive, koffi.pointer(procedure));
    this.registerWindowClass();
    this.createOwnerWindow();
    if (!this.window) throw new Error('Не удалось создать окно трекера');
    this.update(this.paused);
    this.stopMessages = watchMessages();
  }
  createOwnerWindow(): void {
    this.window = createWindow(
      0,
      this.name,
      'Activity Tracker',
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      this.instance,
      null,
    );
  }
  registerWindowClass(): void {
    const registered = registerClass({
      style: 0,
      lpfnWndProc: this.callback,
      cbClsExtra: 0,
      cbWndExtra: 0,
      hInstance: this.instance,
      hIcon: 0,
      hCursor: 0,
      hbrBackground: 0,
      lpszMenuName: null,
      lpszClassName: this.name,
    });
    if (!registered || this.icons.some((icon) => !icon))
      throw new Error('Не удалось подготовить значок трекера');
  }
  receive = (window: number, message: number, wparam: number, lparam: number): number => {
    try {
      if (message === this.taskbarCreated && this.data) return this.restoreIcon();
      if (message === 0x11) return 1;
      if (message === 0x10 || message === 0x16) {
        endMenu();
        setImmediate(this.actions.exit);
        return 0;
      }
      if (message === trayMessage) {
        this.mouse(lparam & 0xffff);
        return 0;
      }
    } catch (error) {
      console.error('Tray:', error instanceof Error ? error.message : 'ошибка');
    }
    return defaultProcedure(window, message, wparam, lparam);
  };
  restoreIcon(): number {
    if (this.data) addIcon(this.data);
    return 0;
  }
  mouse(event: number): void {
    if (event === 0x203 || event === 0x401) {
      setImmediate(this.actions.settings);
      return;
    }
    if (![0x205, 0x7b].includes(event) || this.showingMenu) return;
    this.showingMenu = true;
    setImmediate(() => {
      showTrayMenu(this.window, this.paused, this.actions, () => {
        this.showingMenu = false;
      });
    });
  }
  update(paused: boolean): void {
    this.paused = paused;
    const icon = this.icons[paused ? 1 : 0] ?? 0;
    const data = iconData(this.window, icon, paused);
    if (this.data) notify(1, data);
    else addIcon(data);
    this.data = data;
  }
  stop(): void {
    this.stopMessages();
    if (this.data) notify(2, this.data);
    if (this.window) destroyWindow(this.window);
    if (this.callback) {
      unregisterClass(this.name, this.instance);
      koffi.unregister(this.callback);
    }
    for (const icon of this.icons) if (icon) destroyIcon(icon);
    this.window = 0;
    this.callback = 0n;
    this.data = undefined;
  }
}
export function createTray(
  directory: string,
  paused: boolean,
  actions: ShellActions,
  port: number,
): DesktopShell {
  return new WindowsTray(directory, paused, actions, port);
}
