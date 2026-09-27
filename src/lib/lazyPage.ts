import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'monarch_chunk_reload';

/**
 * React.lazy for route pages, with one recovery step for stale deploys.
 *
 * Page chunks are content-hashed, so after a deploy a tab opened on the old
 * version asks for chunk files that no longer exist and the import rejects.
 * Reload once to pick up the new index.html (and its new chunk names); the
 * session flag stops a genuinely missing chunk from reloading forever, and is
 * cleared on the next successful load so a later deploy can recover too.
 */
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage blocked */ }
      return mod;
    } catch (err) {
      // Only reload when the flag can be recorded: with storage blocked there is
      // no way to tell a first failure from a repeat, so surface the error.
      let canReload = false;
      try {
        if (sessionStorage.getItem(RELOAD_KEY) !== '1') {
          sessionStorage.setItem(RELOAD_KEY, '1');
          canReload = true;
        }
      } catch { /* storage blocked */ }
      if (canReload) {
        window.location.reload();
        // Keep Suspense showing its fallback until the reload takes over.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
