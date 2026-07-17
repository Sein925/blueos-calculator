/// <reference types="@blueos" />
type Router = typeof import('@blueos.app.appmanager.router');
type Storage = typeof import('@blueos.storage.storage');
type Fetch = typeof import('@blueos.network.fetch');
type Device = typeof import('@blueos.hardware.deviceInfo');
type App = typeof import('@blueos.app.context');

interface HistoryItem {
  expression: string;
  result: string;
}

declare const global: {
  router: Router;
  storage: Storage;
  fetch: Fetch;
  device: Device;
  app: App;
  calculatorHistory: HistoryItem[];
  angleMode: 'deg' | 'rad';
  equationOutputMode: 'exact' | 'decimal';
  inputDisplayMode: 'marquee' | 'static';
  hapticEnabled: boolean;
  vibrator: typeof import('@blueos.hardware.vibrator.vibrator');
  triggerHaptic: () => void;
  pendingHistoryItem: HistoryItem | null;
  pendingDateValue: string;
  loadHistory: () => void;
  saveHistory: () => void;
  loadSettings: () => void;
  saveSettings: () => void;
}

declare const Promise: typeof Promise
