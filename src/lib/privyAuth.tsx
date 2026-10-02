import React from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { PRIVY_APP_ID } from '../config';
import useStore from '../store/useStore';
import type { Auth, LoginKind, PrivyBridgeProps } from './auth';

// Loaded on demand by AuthProvider (src/lib/auth.tsx): everything that pulls in
// the Privy SDK lives in this module so it gets its own chunk.

const dummyEthereumChain = {
  id: 1,
  name: 'Ethereum',
  network: 'mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://cloudflare-eth.com'] },
    public: { http: ['https://cloudflare-eth.com'] },
  },
};

// Privy's installed SDK types have drifted from this app's provider/config shape
// (onSuccess, createOnLogin, solanaClusters); the runtime is correct, so type the
// provider loosely here instead of chasing each individual prop.
const Privy = PrivyProvider as unknown as React.ComponentType<any>;

// Publishes Privy's state to AuthProvider once Privy is ready. The functions
// handed out are stable wrappers over the latest Privy values, so consumers'
// effects don't re-run on every Privy render.
function Bridge({ onChange, pendingLogin }: PrivyBridgeProps) {
  const privy = usePrivy();
  const latest = React.useRef(privy);
  latest.current = privy;

  const fns = React.useMemo(() => ({
    login: () => latest.current.login(),
    logout: () => latest.current.logout(),
    getAccessToken: () => latest.current.getAccessToken(),
    linkLogin: (kind: LoginKind) => {
      const p = latest.current;
      if (kind === 'email') p.linkEmail();
      else if (kind === 'google') p.linkGoogle();
      else p.linkApple();
    },
    unlinkLogin: async (kind: LoginKind, id: string) => {
      const p = latest.current;
      if (kind === 'email') await p.unlinkEmail(id);
      else if (kind === 'google') await p.unlinkGoogle(id);
      else await p.unlinkApple(id);
    },
  }), []);

  const { ready, authenticated, user } = privy;
  React.useEffect(() => {
    if (!ready) return;
    const auth: Auth = { ready, authenticated, user: user ?? null, ...fns };
    onChange(auth);
    // A login pressed before Privy had loaded opens now.
    if (pendingLogin.current) {
      pendingLogin.current = false;
      if (!authenticated) latest.current.login();
    }
  }, [ready, authenticated, user, fns, onChange, pendingLogin]);

  return null;
}

export default function PrivyAuth(props: PrivyBridgeProps) {
  const { setIdentityType, identityType } = useStore();
  return (
    <Privy
      appId={PRIVY_APP_ID}
      onSuccess={() => {
        if (!identityType) setIdentityType('HUMAN');
      }}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'apple'],
        appearance: {
          theme: 'dark',
          accentColor: '#FFB000',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        supportedChains: [dummyEthereumChain],
        solanaClusters: [{
          name: 'devnet',
          rpcUrl: 'https://api.devnet.solana.com',
        }],
      }}
    >
      <Bridge {...props} />
    </Privy>
  );
}
