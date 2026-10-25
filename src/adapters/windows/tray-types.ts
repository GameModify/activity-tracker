export interface TrayWindowClass {
  style: number;
  lpfnWndProc: bigint;
  cbClsExtra: number;
  cbWndExtra: number;
  hInstance: number;
  hIcon: number;
  hCursor: number;
  hbrBackground: number;
  lpszMenuName: null;
  lpszClassName: string;
}
export interface NotificationIcon {
  cbSize: number;
  hWnd: number;
  uID: number;
  uFlags: number;
  uCallbackMessage: number;
  hIcon: number;
  szTip: Uint16Array;
  dwState: number;
  dwStateMask: number;
  szInfo: Uint16Array;
  uVersion: number;
  szInfoTitle: Uint16Array;
  dwInfoFlags: number;
  guidItem: Uint8Array;
  hBalloonIcon: number;
}
export interface ScreenPoint {
  x: number;
  y: number;
}
