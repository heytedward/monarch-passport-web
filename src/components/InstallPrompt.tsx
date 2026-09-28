import React from 'react';
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import {
  canPromptNatively,
  installPromptDue,
  isIOS,
  markPrompted,
  onInstallAvailabilityChange,
  promptNativeInstall,
} from '../lib/install';

// Screens where the sheet would get in the way: the tap/claim flow itself
// (the full-screen claim animation lives on /v/:id) and the admin panel.
const QUIET_PATHS = /^\/(v|claim|command-center|admin)(\/|$)/;

function ShareIcon() {
  return (
    <Box as="svg" viewBox="0 0 24 24" w="18px" h="18px" display="inline-block" verticalAlign="-3px" fill="none" stroke="#FFB000" strokeWidth="2">
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v8h14v-8" />
    </Box>
  );
}

/**
 * One-time "Add Passport to your Home Screen" sheet, offered after the
 * visitor's first claim once they move on from the claim screen.
 */
export default function InstallPrompt() {
  const { pathname } = useLocation();
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [closed, setClosed] = React.useState(false);

  React.useEffect(() => {
    const off = onInstallAvailabilityChange(rerender);
    return () => { off(); };
  }, []);

  const ios = isIOS();
  const native = canPromptNatively();
  if (closed || QUIET_PATHS.test(pathname) || !installPromptDue() || (!ios && !native)) return null;

  const close = () => {
    markPrompted();
    setClosed(true);
  };

  const install = async () => {
    await promptNativeInstall();
    close();
  };

  return (
    <Box
      position="fixed"
      left={0}
      right={0}
      bottom={0}
      zIndex={1400}
      display="flex"
      justifyContent="center"
      pointerEvents="none"
    >
      <Box
        role="dialog"
        aria-label="Add Passport to your Home Screen"
        pointerEvents="auto"
        w="100%"
        maxW="430px"
        bg="black"
        borderTop="3px solid #FFB000"
        px={5}
        pt={5}
        pb="calc(20px + env(safe-area-inset-bottom))"
      >
        <VStack align="stretch" spacing={3}>
          <HStack spacing={3}>
            <Box as="img" src="/icons/icon-192.png" alt="" w="44px" h="44px" border="2px solid #FFB000" />
            <Box>
              <Text color="#FFB000" fontWeight="900" fontSize="sm" letterSpacing="0.06em">
                ADD PASSPORT TO YOUR HOME SCREEN
              </Text>
              <Text color="whiteAlpha.700" fontSize="xs" mt={1}>
                Open it like an app to check your WNGS and rewards in one tap.
              </Text>
            </Box>
          </HStack>

          {native ? (
            <Button onClick={install} bg="#FFB000" color="black" borderRadius={0} fontWeight="900" _hover={{ bg: '#FFC233' }}>
              ADD TO HOME SCREEN
            </Button>
          ) : (
            <VStack align="stretch" spacing={2} border="2px solid" borderColor="whiteAlpha.300" p={3}>
              <Text color="white" fontSize="xs">
                1. Tap <ShareIcon /> Share in your browser.
              </Text>
              <Text color="white" fontSize="xs">
                2. Choose Add to Home Screen.
              </Text>
              <Text color="white" fontSize="xs">
                3. Open Passport from your home screen and log in once more.
              </Text>
            </VStack>
          )}

          <Button onClick={close} variant="ghost" color="whiteAlpha.700" borderRadius={0} size="sm" fontWeight="700" _hover={{ color: 'white' }}>
            {native ? 'NOT NOW' : 'GOT IT'}
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
