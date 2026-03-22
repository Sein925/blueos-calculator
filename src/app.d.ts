/// <reference types="@blueos" />
type Router = typeof import('@blueos.app.appmanager.router');
type Storage = typeof import('@blueos.storage.storage');

interface HistoryItem {
  expression: string;
  result: string;
}

declare const global: {
  router: Router;
  storage: Storage;
  calculatorHistory: HistoryItem[];
  angleMode: 'deg' | 'rad';
  loadHistory: () => void;
  saveHistory: () => void;
  loadSettings: () => void;
  saveSettings: () => void;
}

declare const Promise: typeof Promise
