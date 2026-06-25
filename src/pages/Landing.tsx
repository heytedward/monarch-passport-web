import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  Container, 
  Input,
  Button,
  Link
} from '@chakra-ui/react';
import { Logo } from '../components/Logo';

function Landing() {
  const { login, authenticated, ready } = usePrivy();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  // Once Privy authenticates, leave the locked screen and enter the app.
  useEffect(() => {
    if (ready && authenticated) {
      navigate('/home', { replace: true });
    }
  }, [ready, authenticated, navigate]);

  return (
    <Box bg="black" minH="100vh" color="white" display="flex" alignItems="center" justifyContent="center">
      <Container maxW="container.sm">
        <VStack spacing={12} textAlign="center">
          {/* Top Element: Logo */}
          <Box>
            <Logo w={32} h={32} color="white" />
          </Box>

          {/* Header */}
          <VStack spacing={2}>
            <Heading 
              fontSize={{ base: "4xl", md: "6xl" }} 
              fontWeight="900" 
              fontFamily="monospace" 
              letterSpacing="-0.02em"
              lineHeight="1"
            >
              PAPILLON // SYSTEM_LOCKED
            </Heading>
            <Text 
              fontSize="xs" 
              color="gray.500" 
              fontFamily="monospace" 
              fontWeight="900"
              letterSpacing="0.1em"
              textTransform="uppercase"
            >
              SEASON_01 PROTOCOL INITIATING. PHYSICAL ARTIFACTS REQUIRED FOR DIGITAL ENTRY.
            </Text>
          </VStack>

          {/* Email Capture Form */}
          <VStack spacing={4} w="full" maxW="400px">
            <Input 
              placeholder="ENTER_EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              bg="black"
              border="1px solid white"
              borderRadius="0"
              color="white"
              fontFamily="monospace"
              fontSize="sm"
              _placeholder={{ color: 'gray.600' }}
              _focus={{ borderColor: '#FFB000', boxShadow: 'none' }}
              h="50px"
            />
            <Button
              bg="#FFB000"
              color="black"
              w="full"
              h="50px"
              borderRadius="0"
              fontWeight="900"
              fontFamily="monospace"
              fontSize="sm"
              _hover={{ bg: "#e69e00" }}
              _active={{ bg: "#cc8c00" }}
            >
              REQUEST_ACCESS
            </Button>
          </VStack>

          {/* Alpha Login Bypass */}
          <Box pt={12}>
            <Link 
              fontSize="9px" 
              color="gray.600" 
              fontFamily="monospace" 
              fontWeight="900"
              onClick={() => login()}
              _hover={{ color: 'white' }}
              cursor="pointer"
              textDecoration="none"
            >
              [ ALPHA_LOGIN ]
            </Link>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

export default Landing;
