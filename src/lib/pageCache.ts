// Remembers each screen's last loaded data for the rest of the session, so
// going back to a tab shows it instantly while a fresh copy loads quietly.
// Memory only: cleared on reload, and keyed per user where the data is personal.
const store = new Map<string, unknown>();

export function readCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeCache<T>(key: string, value: T): void {
  store.set(key, value);
}

export function clearCache(): void {
  store.clear();
}
