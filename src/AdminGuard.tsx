import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Center, Spinner, Text, VStack } from '@chakra-ui/react';

const ADMIN_ID = import.meta.env.VITE_ADMIN_PRIVY_ID;

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { ready, authenticated, user } = usePrivy();

  if (!ready) {
    return (
      <Center h="100vh" bg="black">
        <VStack spacing={4}>
          <Spinner color="#FFB000" size="xl" />
          <Text color="#FFB000" fontFamily="monospace" fontWeight="900" letterSpacing="0.1em">
            VERIFYING_IDENTITY...
          </Text>
        </VStack>
      </Center>
    );
  }

  const isAdmin = authenticated && user?.id === ADMIN_ID;

  if (!isAdmin) {
    return (
      <Center h="100vh" bg="black" p={6}>
        <VStack spacing={2} textAlign="center">
          <Text color="red.500" fontSize="2xl" fontWeight="900" fontFamily="monospace">
            403 // ACCESS_DENIED
          </Text>
          <Text color="red.500" fontSize="xs" fontWeight="900" fontFamily="monospace" letterSpacing="0.05em">
            YOUR IDENTITY IS NOT AUTHORIZED FOR THIS SECTOR.
          </Text>
        </VStack>
      </Center>
    );
  }

  return <>{children}</>;
};
