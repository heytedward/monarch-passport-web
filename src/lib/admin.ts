import type { User } from '@privy-io/react-auth';

// Who sees the Command Center. Entries may be full Privy DIDs, bare Privy IDs
// ("cmpho..."), or wallet addresses. Bare entries also match as their
// did:privy: form, so the env var works with or without the prefix.
// Keep in sync with the server allowlist in api/v2/admin/mint.js.
export const ADMIN_IDS: string[] = (import.meta.env.VITE_ADMIN_PRIVY_ID || "did:privy:cmphogmw500340ckz646kklaw,did:privy:cmjufzcf403jjl70dpyp1mood")
  .split(",")
  .map((w: string) => w.trim())
  .filter(Boolean)
  .flatMap((w: string) => (w.startsWith('did:privy:') ? [w] : [w, `did:privy:${w}`]))
  .map((w: string) => w.toLowerCase());

/** True when this Privy user is on the admin allowlist (by DID or wallet). */
export function isAdminUser(user: Pick<User, 'id' | 'wallet'> | null | undefined): boolean {
  const id = user?.id?.toLowerCase();
  const wallet = user?.wallet?.address?.toLowerCase();
  return (!!id && ADMIN_IDS.includes(id)) || (!!wallet && ADMIN_IDS.includes(wallet));
}
