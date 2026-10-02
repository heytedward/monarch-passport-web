import React from 'react';
import type { User } from '@privy-io/react-auth';

/**
 * The slice of Privy the app uses, behind our own context so the Privy SDK
 * (~780 KB gzip with its wallet stack) stays out of the first download.
 *
 * - A visitor with no Privy session sees the app at once as logged out
 *   (`ready` true, `authenticated` false). Privy downloads when the browser is
 *   idle, or immediately when they press log in; the login call waits for it.
 * - A visitor who may have a session (Privy tokens in storage, or returning
 *   from an OAuth redirect) gets Privy right away and `ready` stays false until
 *   it has restored the session, exactly as before, so they never flash as
 *   logged out.
 *
 * Import only types from '@privy-io/react-auth' here; the runtime lives in
 * ./privyAuth, which is loaded on demand.
 */
/** Sign-in methods a member can add to or remove from their account. */
export type LoginKind = 'email' | 'google' | 'apple';

export interface Auth {
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** Opens Privy's flow to add a sign-in method to the current account. */
  linkLogin: (kind: LoginKind) => void;
  /** Removes a sign-in method; `id` is the email address or the Google/Apple subject. */
  unlinkLogin: (kind: LoginKind, id: string) => Promise<void>;
}

export interface PrivyBridgeProps {
  onChange: (auth: Auth) => void;
  pendingLogin: React.MutableRefObject<boolean>;
}

const AuthContext = React.createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = React.useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

// Privy's storage keys (localStorage 'privy:token' / 'privy:refresh_token', or
// the 'privy-token' / 'privy-session' cookies) and its OAuth return params.
export function mayHaveSession(): boolean {
  try {
    if (localStorage.getItem('privy:token') || localStorage.getItem('privy:refresh_token')) return true;
  } catch { /* storage blocked: fall through */ }
  if (/(^|;\s*)privy-(token|session)=/.test(document.cookie)) return true;
  return /[?&]privy_oauth_(code|state)=/.test(window.location.search);
}

function whenIdle(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 3000 });
  else window.setTimeout(fn, 1500);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionLikely] = React.useState(mayHaveSession);
  const [Bridge, setBridge] = React.useState<React.ComponentType<PrivyBridgeProps> | null>(null);
  const [live, setLive] = React.useState<Auth | null>(null);
  const pendingLogin = React.useRef(false);
  const loading = React.useRef(false);

  const load = React.useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    import('./privyAuth')
      .then((m) => setBridge(() => m.default))
      .catch((err) => {
        // Let the next login press try again (e.g. a flaky connection).
        loading.current = false;
        console.error('Could not load login', err);
      });
  }, []);

  React.useEffect(() => {
    if (sessionLikely) load();
    else whenIdle(load);
  }, [sessionLikely, load]);

  const dormant = React.useMemo<Auth>(() => ({
    ready: !sessionLikely,
    authenticated: false,
    user: null,
    login: () => { pendingLogin.current = true; load(); },
    logout: async () => {},
    getAccessToken: async () => null,
    linkLogin: () => {},
    unlinkLogin: async () => {},
  }), [sessionLikely, load]);

  return (
    <AuthContext.Provider value={live ?? dormant}>
      {children}
      {Bridge && <Bridge onChange={setLive} pendingLogin={pendingLogin} />}
    </AuthContext.Provider>
  );
}
