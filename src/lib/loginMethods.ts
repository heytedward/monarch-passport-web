// Which Privy login methods to offer, by route.
//
// The tap routes narrow the set to email/Google/Apple. Someone who just
// tapped a keychain is the least crypto-literate audience this app will ever
// have, and Privy's modal is the one screen in that flow the app does not
// render itself -- "Continue with a wallet" there reads as a wrong turn and
// costs the claim. Everywhere else keeps wallet login.
//
// This is a plain function of the pathname rather than a router hook because
// PrivyProvider sits ABOVE the Router in App.tsx (AppContent, which owns
// <Router>, is a child of the provider), so no router context exists at the
// point the config is built.

export const DEFAULT_LOGIN_METHODS = ['email', 'wallet', 'google', 'apple'] as const;

/** No wallet, no chain vocabulary -- just the three a shopper recognises. */
export const TAP_LOGIN_METHODS = ['email', 'google', 'apple'] as const;

/** Matches /tap and /tap/<anything>, but not /tapestry. */
const TAP_ROUTE = /^\/tap(\/|$)/;

export function loginMethodsForPath(pathname: string): string[] {
  return TAP_ROUTE.test(pathname)
    ? [...TAP_LOGIN_METHODS]
    : [...DEFAULT_LOGIN_METHODS];
}
