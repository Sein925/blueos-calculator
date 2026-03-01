/// <reference types="@blueos" />
type Router = typeof import('@blueos.app.appmanager.router');
type Fetch = typeof import('@blueos.network.fetch').default;
type Storage = typeof import('@blueos.storage.storage');

interface HistoryItem {
  expression: string;
  result: string;
}

declare const global: {
  router: Router;
  fetch: Fetch;
  storage: Storage;
  calculatorHistory: HistoryItem[];
  backendUrl: string;
  deviceId: string;
  savePaymentStatus: (isPaid: boolean) => void;
  getPaymentStatus: (callback: (isPaid: boolean) => void) => void;
  isDeviceIdValid: () => boolean;
}

declare const Promise: typeof Promise