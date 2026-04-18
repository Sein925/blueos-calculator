/// <reference types="@blueos" />
type Router = typeof import('@blueos.app.appmanager.router');
type Storage = typeof import('@blueos.storage.storage');
type Fetch = typeof import('@blueos.network.fetch');
type Device = typeof import('@blueos.hardware.deviceInfo');

interface HistoryItem {
  expression: string;
  result: string;
}

declare const global: {
  router: Router;
  storage: Storage;
  fetch: Fetch;
  device: Device;
  calculatorHistory: HistoryItem[];
  angleMode: 'deg' | 'rad';
  loadHistory: () => void;
  saveHistory: () => void;
  loadSettings: () => void;
  saveSettings: () => void;
}

declare const Promise: typeof Promise
