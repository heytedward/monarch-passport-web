import React from 'react'
import { ChakraProvider, Box, Center, Spinner, Text, useColorModeValue, useToast } from '@chakra-ui/react'
import theme from './theme'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import Navbar from './components/Navbar'
import PageTransition from './components/PageTransition'
import ErrorBoundary from './components/ErrorBoundary'
import Landing from './pages/Landing'
import Verify from './pages/Verify'
import { lazyPage } from './lib/lazyPage'
import useStore from './store/useStore'

// The NFC tap flow (/ and /v/:id) ships in the first bundle; every other page
// is fetched when first visited, so a tap doesn't download the admin panel,
// the shop or the closet before the artifact can render.
const Home = lazyPage(() => import('./pages/Home'))
const Passport = lazyPage(() => import('./pages/Passport'))
const Rewards = lazyPage(() => import('./pages/Rewards'))
const Scanner = lazyPage(() => import('./pages/Scanner'))
const Closet = lazyPage(() => import('./pages/Closet'))
const Profile = lazyPage(() => import('./pages/Profile'))
const Settings = lazyPage(() => import('./pages/Settings'))
const Claim = lazyPage(() => import('./pages/Claim'))
const Shop = lazyPage(() => import('./pages/Shop'))
const Recruit = lazyPage(() => import('./pages/Recruit'))
const CommandCenter = lazyPage(() => import('./pages/CommandCenter'))
const Social = lazyPage(() => import('./pages/Social'))
const Ascension = lazyPage(() => import('./pages/Ascension'))
const Collect = lazyPage(() => import('./pages/Collect'))

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

  // Not logged in -> back to Landing.
  if (!devBypass && !authenticated) {
    return <Navigate to="/" replace />;
  }

  // Logged in but identityType not set yet (e.g. session restore, where Privy's
  // onSuccess never fires, or after storage was cleared). The auth effect in
  // AppContent sets it momentarily; show a spinner meanwhile instead of
  // redirecting to "/", which would bounce off Landing's own
  // "authenticated -> /home" redirect into a history.replaceState loop.
  if (!devBypass && !identityType) {
    return (
      <Center h="100vh" bg={bgColor}>
        <Spinner color="#FFB000" size="xl" />
      </Center>
    );
  }

  return <>{children}</>;
}

// Routes wrapped in an ErrorBoundary keyed by pathname: if a page throws during
// render, the boundary shows a fault screen instead of a blank page, and keying
// on the path remounts (clears) it when the user navigates elsewhere.
//
// <AnimatePresence> sits OUTSIDE the pathname key so it can watch a page leave
// and the next arrive; PageTransition (keyed by pathname) is the element it
// animates in/out. ErrorBoundary lives inside, so it still resets per route.
function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location.pathname}>
        <ErrorBoundary>
          <React.Suspense fallback={<Box minH="100vh" bg="black" />}>
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
        <Route path="/passport" element={<ProtectedRoute><Passport /></ProtectedRoute>} />
        <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
        <Route path="/scan" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
        <Route path="/closet" element={<ProtectedRoute><Closet /></ProtectedRoute>} />
        <Route path="/ascension" element={<ProtectedRoute><Ascension /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/collect/:code" element={<Collect />} />
        <Route path="/v/:id" element={<Verify />} />
        <Route path="/recruit" element={<Recruit />} />
        <Route path="/claim/:id" element={<Claim />} />
        <Route path="/social/:userId" element={<Social />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/admin" element={<CommandCenter />} />
            {/* Unknown paths redirect home instead of rendering an empty page. */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
          </React.Suspense>
        </ErrorBoundary>
      </PageTransition>
    </AnimatePresence>
  );
}

// The whole app is a centered ~430px phone column — except the admin, which
// breaks out to full width (and drops the phone nav) so its tools have room.
function AppFrame() {
  const location = useLocation();
  const isFullWidth = location.pathname === '/command-center' || location.pathname === '/admin';
  return (
    <Box
      as="main"
      maxW={isFullWidth ? '100%' : '430px'}
      mx="auto"
      minH="100vh"
      position="relative"
      pt="0"
      px={0}
      pb={isFullWidth ? 0 : '80px'}
    >
      {!isFullWidth && <Navbar />}
      <AppRoutes />
    </Box>
  );
}

function AppContent() {
  const { user, ready, authenticated, getAccessToken } = usePrivy();
  const { activeTheme, activeThemeAccent, identityType, setIdentityType, setWngsBalance, setActiveTheme, setActiveAvatar, setActiveAvatarColors, setActiveThemeAccent } = useStore();
  const toast = useToast();

  const brandAccent = activeThemeAccent || (activeTheme === 'CRIMSON_OVERRIDE' ? '#DC143C' : '#FFB000');
  const bgColor = useColorModeValue("gray.50", "black");

  React.useEffect(() => {
    if (ready && authenticated && user?.id) {
      // Guarantee an identityType for any authenticated session. Privy's
      // onSuccess only fires on interactive login, not on session restore or
      // after storage was cleared -- without this, an authenticated user with
      // identityType=null bounces between Landing and ProtectedRoute in a
      // history.replaceState loop (browser throttles it -> render crash).
      if (!identityType) setIdentityType('HUMAN');
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
          // Populate from the server response (service-role); the client's own
          // RLS read is blocked (Privy token not validated by Supabase).
          const data = await res.json().catch(() => null);
          if (data?.profile) {
            setWngsBalance(data.profile.wngs_balance || 0);
            if (data.profile.active_theme) setActiveTheme(data.profile.active_theme);
            setActiveAvatar(data.profile.active_avatar || null);
            setActiveAvatarColors(data.avatarColors || null);
            if (data.themeAccent) setActiveThemeAccent(data.themeAccent);
          }
          // Storefront purchases auto-granted on this login (matched by email).
          if (Array.isArray(data?.granted) && data.granted.length > 0) {
            toast({
              duration: 8000,
              position: 'top',
              render: () => (
                <Box bg="black" border="2px solid #FFB000" p={3} maxW="430px" mx="auto">
                  <Text color="#FFB000" fontFamily="monospace" fontWeight="900" fontSize="xs">
                    ORDER SYNCED{data.granted.length} ITEM{data.granted.length > 1 ? 'S' : ''} ADDED TO YOUR CLOSET
                  </Text>
                  <Text color="whiteAlpha.700" fontFamily="monospace" fontSize="10px" mt={1}>
                    {data.granted.join(' // ').toUpperCase()}
                  </Text>
                  {data.grantedWngs > 0 && (
                    <Text color="#FFB000" fontFamily="monospace" fontWeight="900" fontSize="10px" mt={1}>
                      +{data.grantedWngs} $WNGS CREDITED
                    </Text>
                  )}
                </Box>
              ),
            });
          }
        } catch (e) {
          console.error('ensure_profile failed', e);
        }
      })();
    }
  }, [ready, authenticated, user?.id, getAccessToken, identityType, setIdentityType, setWngsBalance, setActiveTheme, setActiveAvatar, setActiveAvatarColors, setActiveThemeAccent]);

  return (
    <Router>
      <Box minH="100vh" bg={bgColor}>
        <style>{`
          :root {
            --monarch-accent: ${brandAccent};
          }
          .de-stijl-heading { font-family: 'Archivo Black', sans-serif !important; }
          .de-stijl-body { font-family: 'Space Mono', monospace !important; }
        `}</style>
        {/* Phone-tight frame for the app; the admin breaks out to full width. */}
        <AppFrame />
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

// Privy's installed SDK types have drifted from this app's provider/config shape
// (onSuccess, createOnLogin, solanaClusters); the runtime is correct, so type the
// provider loosely here instead of chasing each individual prop.
const Privy = PrivyProvider as unknown as React.ComponentType<any>;

function App() {
  const { setIdentityType, identityType } = useStore();

  return (
    <Privy
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
      <ChakraProvider theme={theme}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap');
          .de-stijl-heading { font-family: 'Archivo Black', sans-serif !important; }
          .de-stijl-body { font-family: 'Space Mono', monospace !important; }
        `}</style>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ChakraProvider>
    </Privy>
  )
}

export default App
