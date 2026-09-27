import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Container,
  Button,
  Link,
} from '@chakra-ui/react';
import { Logo } from '../components/Logo';

function Landing() {
  const { login, authenticated, ready } = usePrivy();
  const navigate = useNavigate();

  // Once Privy authenticates, leave the landing screen and enter the app.
  useEffect(() => {
    if (ready && authenticated) {
      navigate('/home', { replace: true });
    }
  }, [ready, authenticated, navigate]);

  return (
    <Box bg="black" minH="100vh" color="white" display="flex" alignItems="center" justifyContent="center" px={4} py={8}>
      <Container maxW="420px" p={0}>
        <VStack spacing={10} textAlign="center" w="full">
          {/* Top Element: Logo */}
          <Box position="relative">
            <Logo w={28} h={28} color="white" />
          </Box>

          {/* Header */}
          <VStack spacing={3}>
            <Text
              fontSize="10px"
              color="#FFB000"
              fontFamily="mono"
              fontWeight="900"
              letterSpacing="0.25em"
              textTransform="uppercase"
            >
              SEASON 001 · PROTOCOL ONLINE
            </Text>
            <Heading
              fontSize={{ base: "3xl", sm: "4xl" }}
              fontWeight="900"
              fontFamily="heading"
              letterSpacing="-0.02em"
              lineHeight="1.1"
              color="white"
            >
              MONARCH PASSPORT
            </Heading>
            <Text
              fontSize="xs"
              color="gray.400"
              fontFamily="mono"
              lineHeight="1.6"
              maxW="340px"
            >
              Your phygital loyalty operating system. Sync physical artifacts, unlock seasonal clearance, and earn $WNGS.
            </Text>
          </VStack>

          {/* Action Hub */}
          <VStack spacing={3} w="full">
            <Button
              bg="#FFB000"
              color="black"
              w="full"
              h="54px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="mono"
              fontSize="sm"
              letterSpacing="0.08em"
              _hover={{ bg: "#f0b44c", transform: "translateY(-1px)" }}
              _active={{ bg: "#d0922f" }}
              onClick={() => login()}
            >
              ENTER PASSPORT ↗
            </Button>

            <Button
              as="a"
              href="/tap.html"
              variant="outline"
              borderColor="whiteAlpha.300"
              color="white"
              w="full"
              h="48px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="mono"
              fontSize="xs"
              letterSpacing="0.05em"
              _hover={{ bg: "whiteAlpha.100", borderColor: "#FFB000" }}
            >
              SCAN / TAP ARTIFACT ⎋
            </Button>

            <HStack justify="center" pt={4} spacing={4}>
              <Link
                href="https://papillonbrand.us"
                isExternal
                fontSize="10px"
                fontFamily="mono"
                fontWeight="900"
                color="gray.500"
                _hover={{ color: '#FFB000' }}
                letterSpacing="0.1em"
              >
                STOREFRONT & PREORDERS ↗
              </Link>
            </HStack>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}

export default Landing;

