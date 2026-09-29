import { useSyncExternalStore } from 'react';

// Counts in-flight "the screen is waiting" work (a page's code downloading, a
// page's first data load). The top progress bar shows while the count is
// above zero. Background refreshes of already-shown data don't count.
let active = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function beginProgress(): () => void {
  active += 1;
  emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    active = Math.max(0, active - 1);
    emit();
  };
}

/** Tracks a promise on the progress bar and returns it unchanged. */
export function trackProgress<T>(p: Promise<T>): Promise<T> {
  const end = beginProgress();
  return p.finally(end);
}

export function useProgressActive(): boolean {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => active > 0,
  );
}
