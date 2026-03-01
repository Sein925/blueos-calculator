/// <reference types="@blueos" />
type Router = typeof import('@blueos.app.appmanager.router');

interface HistoryItem {
  expression: string;
  result: string;
}

declare const global: {
  router: Router;
  calculatorHistory: HistoryItem[];
}

declare const Promise: typeof Promise