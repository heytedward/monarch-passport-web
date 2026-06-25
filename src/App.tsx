import React from 'react'
import { ChakraProvider, Box, Center, Spinner, useColorModeValue } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Passport from './pages/Passport'
import Rewards from './pages/Rewards'
import Scanner from './pages/Scanner'
import Closet from './pages/Closet'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import Claim from './pages/Claim'
import Wallet from './pages/Wallet'
import Shop from './pages/Shop'
import TerminalScanner from './pages/TerminalScanner'
import Recruit from './pages/Recruit'
import CommandCenter from './pages/CommandCenter'
import Verify from './pages/Verify'
import Social from './pages/Social'
import Ascension from './pages/Ascension'
import useStore from './store/useStore'

import { PRIVY_APP_ID } from './config'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const { identityType } = useStore();
  const bgColor = useColorModeValue("gray.50", "black");

  const isDev = import.meta.env.DEV;
  const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true';

  if (!ready && !devBypass) {
    return (
      <Center h="100vh" bg={bgColor}>
        <Spinner color="#FFB000" size="xl" />
      </Center>
    );
  }

  if (!devBypass && (!authenticated || !identityType)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const { fetchUserProfile, activeTheme, activeThemeAccent, setWngsBalance, setActiveTheme, setActiveAvatar } = useStore();

  const brandAccent = activeThemeAccent || (activeTheme === 'CRIMSON_OVERRIDE' ? '#DC143C' : '#FFB000');
  const bgColor = useColorModeValue("gray.50", "black");

  React.useEffect(() => {
    if (ready && authenticated && user?.id) {
      (async () => {
        // Make sure a profile row exists before anything reads/writes it.
        // Server endpoints (purchase/claim/tap/equip) verify identity by
        // looking up this row, so a fresh login needs it created first.
        try {
          const token = await getAccessToken();
          const res = await fetch('/api/v2/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId: user.id, action: 'ensure_profile' }),
          });
          // Populate from the server response (service-role), since the client's
          // own RLS read is currently blocked (Privy token not validated by Supabase).
          const data = await res.json().catch(() => null);
          if (data?.profile) {
            setWngsBalance(data.profile.wngs_balance || 0);
            if (data.profile.active_theme) setActiveTheme(data.profile.active_theme);
            if (data.profile.active_avatar) setActiveAvatar(data.profile.active_avatar);
          }
          fetchUserProfile(user.id, token);
        } catch (e) {
          console.error('ensure_profile failed', e);
          fetchUserProfile(user.id);
        }
      })();
    }
  }, [ready, authenticated, user?.id, fetchUserProfile, getAccessToken]);

  return (
    <Router>
      <Box minH="100vh" bg={bgColor} pb="70px">
        <style>{`
          :root {
            --monarch-accent: ${brandAccent};
          }
          .de-stijl-heading { font-family: 'Archivo Black', sans-serif !important; }
          .de-stijl-body { font-family: 'Space Mono', monospace !important; }
        `}</style>
        <Navbar />
        <Box as="main" pt="0" px={0} pb={0}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
            <Route path="/passport" element={<ProtectedRoute><Passport /></ProtectedRoute>} />
            <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/scan" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
            <Route path="/closet" element={<ProtectedRoute><Closet /></ProtectedRoute>} />
            <Route path="/ascension" element={<ProtectedRoute><Ascension /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/v/:id" element={<Verify />} />
            <Route path="/recruit" element={<Recruit />} />
            <Route path="/claim/:id" element={<Claim />} />
            <Route path="/social/:userId" element={<Social />} />
            <Route path="/command-center" element={<CommandCenter />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

const dummyEthereumChain = {
  id: 1,
  name: 'Ethereum',
  network: 'mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://cloudflare-eth.com']
    },
    public: {
      http: ['https://cloudflare-eth.com']
    }
  }
};

function App() {
  const { setIdentityType, identityType } = useStore();

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      onSuccess={() => {
        if (!identityType) {
          setIdentityType('HUMAN');
        }
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
          rpcUrl: 'https://api.devnet.solana.com'
        }]
      }}
    >
      <ChakraProvider>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap');
          .de-stijl-heading { font-family: 'Archivo Black', sans-serif !important; }
          .de-stijl-body { font-family: 'Space Mono', monospace !important; }
        `}</style>
        <AppContent />
      </ChakraProvider>
    </PrivyProvider>
  )
}

export default App
