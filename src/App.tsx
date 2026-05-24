import { ChakraProvider, Box, Center, Spinner } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Passport from './pages/Passport'
import Rewards from './pages/Rewards'
import Scanner from './pages/Scanner'
import Closet from './pages/Closet'
import Profile from './pages/Profile'
import Landing from './pages/Landing'
import Claim from './pages/Claim'
import Wallet from './pages/Wallet'
import Shop from './pages/Shop'
import TerminalScanner from './pages/TerminalScanner'
import Recruit from './pages/Recruit'
import CommandCenter from './pages/CommandCenter'
import Verify from './pages/Verify'
import useStore from './store/useStore'

import { PRIVY_APP_ID } from './config'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated, ready } = usePrivy();
  const { identityType } = useStore();

  const isDev = import.meta.env.DEV;
  const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true';

  if (!ready && !devBypass) {
    return (
      <Center h="100vh" bg="black">
        <Spinner color="#FFB000" size="xl" />
      </Center>
    );
  }

  if (!devBypass && (!authenticated || !identityType)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

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
        <Router>
          <Box minH="100vh" bg="black" pb="70px">
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
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/v/:id" element={<Verify />} />
                <Route path="/recruit" element={<Recruit />} />
                <Route path="/claim/:tagId" element={<Claim />} />
                <Route path="/command" element={<CommandCenter />} />
              </Routes>
            </Box>
          </Box>
        </Router>
      </ChakraProvider>
    </PrivyProvider>
  )
}

export default App
