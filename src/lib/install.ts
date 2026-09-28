// Add to Home Screen support.
//
// Android/desktop Chrome fire `beforeinstallprompt`, which we hold on to so a
// button can open the real install dialog later. iPhone has no such event:
// installing is Share -> Add to Home Screen, so there we show the steps.
//
// The prompt is offered once, after the visitor's first claim (the claim
// sequence sets the flag; the sheet appears once they leave it).

const PENDING_KEY = 'monarch_install_pending';
const DONE_KEY = 'monarch_install_prompted';

export interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: DeferredInstallPrompt | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar away; we ask at the right moment
    deferred = e as DeferredInstallPrompt;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    markPrompted();
    listeners.forEach((fn) => fn());
  });
}

export function onInstallAvailabilityChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const canPromptNatively = () => deferred !== null;

export async function promptNativeInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage blocked: the prompt just won't be remembered */ }
}

/** Called when a claim succeeds. Only the first one ever queues the prompt. */
export function markFirstClaim() {
  if (!read(DONE_KEY)) write(PENDING_KEY, '1');
}

export function markPrompted() {
  write(PENDING_KEY, null);
  write(DONE_KEY, '1');
}

/** True when the sheet should show now: a first claim happened, not yet asked, not installed. */
export function installPromptDue(): boolean {
  return read(PENDING_KEY) === '1' && !read(DONE_KEY) && !isStandalone();
}
