/// <reference types="@blueos" />
type Router = typeof import('@blueos.app.appmanager.router');
type Fetch = typeof import('@blueos.network.fetch').default;

interface HistoryItem {
  expression: string;
  result: string;
}

declare const global: {
  router: Router;
  fetch: Fetch;
  calculatorHistory: HistoryItem[];
  backendUrl: string;
  deviceId: string;
}

declare const Promise: typeof Promise