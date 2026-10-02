import React from 'react';
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import useStore from '../store/useStore';
import UsernameForm from './UsernameForm';

// Same quiet screens as the install sheet: the tap/claim flow and the admin.
const QUIET_PATHS = /^\/(|v|claim|command-center|admin)(\/|$)/;
const LATER_KEY = 'monarch_username_later';

function askedLater(): boolean {
  try { return sessionStorage.getItem(LATER_KEY) === '1'; } catch { return false; }
}

/**
 * Asks a signed-in member to pick a username once their profile has loaded
 * and they don't have one. "Later" hides it for this visit; it comes back on
 * the next one until a name is set (it can also be set in Settings).
 */
export default function UsernamePrompt() {
  const { pathname } = useLocation();
  const { authenticated } = useAuth();
  const { username, profileLoaded } = useStore();
  const [later, setLater] = React.useState(askedLater);

  if (!authenticated || !profileLoaded || username || later || QUIET_PATHS.test(pathname)) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(LATER_KEY, '1'); } catch { /* storage blocked */ }
    setLater(true);
  };

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={1500}
      bg="blackAlpha.800"
      display="flex"
      alignItems="flex-end"
      justifyContent="center"
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-prompt-title"
        w="100%"
        maxW="430px"
        bg="black"
        color="white"
        borderTop="3px solid #FFB000"
        px={5}
        pt={6}
        pb="calc(24px + env(safe-area-inset-bottom))"
      >
        <VStack align="stretch" spacing={4}>
          <Box>
            <Heading id="username-prompt-title" fontSize="xl" fontWeight="900" textTransform="uppercase">
              Pick your name
            </Heading>
            <Text fontSize="xs" color="gray.400" mt={2} lineHeight="1.5">
              This is how you show up on your profile and in the feed. You can change it later in Settings.
            </Text>
          </Box>
          <UsernameForm autoFocus submitLabel="SET" />
          <Button
            variant="ghost"
            alignSelf="center"
            size="sm"
            color="gray.400"
            fontWeight="900"
            fontSize="10px"
            borderRadius="0"
            _hover={{ color: 'white', bg: 'transparent' }}
            onClick={dismiss}
          >
            LATER
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
