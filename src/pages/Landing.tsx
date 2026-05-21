import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { 
  Box, 
  Button, 
  Heading, 
  Text, 
  VStack, 
  Container, 
  Input,
  HStack,
  Flex,
  Icon,
  Collapse,
  useDisclosure,
  useToast,
  Code,
  Center,
  Divider,
  Link
} from '@chakra-ui/react';
import { MdMemory, MdPerson, MdEmail, MdChevronRight, MdTerminal, MdCode } from 'react-icons/md';
import useStore from '../store/useStore';
import { PRIVY_APP_ID } from '../config';

function Landing() {
  const navigate = useNavigate();
  const { login, authenticated, ready } = usePrivy();
  const { setIdentityType, identityType } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isOpen: isAgentDocsOpen, onToggle: onToggleAgentDocs } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const devBypass = isDev && localStorage.getItem('monarch_dev_bypass') === 'true';

    if ((ready && authenticated && identityType) || devBypass) {
      navigate('/home');
    }
  }, [ready, authenticated, identityType, navigate]);

  const handleHumanLogin = async () => {
    if (!ready) return;
    
    try {
      setIsSubmitting(true);
      setIdentityType('HUMAN');
      
      await login();
      
    } catch (error: any) {
      console.error('Login failed', error);
      toast({
        title: "HANDSHAKE_ERROR",
        description: error.message || "UNKNOWN_ERROR",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bg = '#000';
  const textColor = '#FFF';
  const agentAccent = '#FFB000'; // Solar Gold
  const humanColor = '#FFF';

  const handleDevBypass = () => {
    localStorage.setItem('monarch_dev_bypass', 'true');
    setIdentityType('HUMAN');
    navigate('/home');
  };

  const isDev = import.meta.env.DEV;

  return (
    <Box bg={bg} minH="100vh" color={textColor} py={10}>
      <Container maxW="container.sm">
        <VStack spacing={8} align="stretch">
          <Box borderBottom="8px solid white" pb={4} mb={4}>
            <Heading className="de-stijl-heading" fontSize="5xl" letterSpacing="-0.05em" fontStyle="italic">
              MONARCH<br />PASSPORT
            </Heading>
            <HStack justify="space-between" mt={2}>
               <Text fontSize="9px" fontWeight="black" fontFamily="monospace" opacity={0.6}>PHYGITAL_IDENTITY_V1.0</Text>
               <Text fontSize="9px" fontWeight="black" fontFamily="monospace" color={agentAccent}>AGENTIC_COMMERCE_ENABLED</Text>
            </HStack>
          </Box>

          {isDev && (
            <Box p={4} border="2px dashed #FFB000" mb={4}>
              <VStack spacing={2}>
                <Text fontSize="10px" fontWeight="black" color="#FFB000">DEVELOPER_TOOLS</Text>
                <Button 
                  size="sm" 
                  w="full" 
                  colorScheme="orange" 
                  variant="outline"
                  onClick={handleDevBypass}
                >
                  BYPASS_HANDSHAKE (DEV_ONLY)
                </Button>
              </VStack>
            </Box>
          )}

          <VStack spacing={6}>
            {/* AGENT PROTOCOL (NON-BUTTON) */}
            <Box 
              w="full" 
              bg="blackAlpha.800" 
              border="2px solid" 
              borderColor={agentAccent} 
              overflow="hidden"
            >
              <Flex justify="space-between" align="center" p={3} borderBottom="1px solid" borderColor="whiteAlpha.100">
                <HStack>
                  <Icon as={MdMemory} color={agentAccent} />
                  <Text fontSize="9px" fontWeight="black" fontFamily="monospace">PROTOCOL_TYPE: "AGENT"</Text>
                </HStack>
                <Button 
                  size="xs" 
                  variant="ghost" 
                  color={agentAccent} 
                  fontSize="8px" 
                  fontFamily="monospace"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  onClick={onToggleAgentDocs}
                >
                  {isAgentDocsOpen ? '[ CLOSE_SPECS ]' : '[ ACCESS_SPECS ]'}
                </Button>
              </Flex>
              <Box p={5}>
                <Text fontSize="16px" fontWeight="black" mb={2}>AGENTIC_INTERFACING</Text>
                <Text fontSize="10px" fontFamily="monospace" color="whiteAlpha.600" mb={4}>
                  Autonomous agents can purchase, own, and trade digital/physical artifacts via the X402 protocol.
                </Text>
                
                <Collapse in={isAgentDocsOpen} animateOpacity>
                  <VStack align="start" spacing={3} bg="whiteAlpha.50" p={4} borderRadius="sm" mb={4}>
                    <HStack>
                      <Icon as={MdCode} size={12} />
                      <Text fontSize="9px" fontWeight="bold">AUTONOMOUS_HANDSHAKE_CLI</Text>
                    </HStack>
                    <Code bg="transparent" color={agentAccent} fontSize="9px" p={0}>
                      $ monarch-cli init --identity-type AGENT
                    </Code>
                    <Divider borderColor="whiteAlpha.200" />
                    <Text fontSize="8px" opacity={0.6}>
                      1. GENERATE_SECURE_VAULT (Solana/Base)<br />
                      2. ESTABLISH_HEADLESS_SESSION<br />
                      3. EXECUTE_AGENTIC_PURCHASE
                    </Text>
                    <Link href="#" style={{ fontSize: '8px', color: agentAccent, textDecoration: 'underline' }}>
                      VIEW_FULL_X402_PROTOCOL_DOCUMENTATION
                    </Link>
                  </VStack>
                </Collapse>

                <HStack spacing={2} opacity={0.4}>
                  <Icon as={MdTerminal} size={12} />
                  <Text fontSize="8px" fontFamily="monospace">WAITING_FOR_REMOTE_EXECUTION...</Text>
                </HStack>
              </Box>
            </Box>

            {/* HUMAN HANDSHAKE */}
            <Box 
              w="full" 
              bg="whiteAlpha.50" 
              border="2px solid" 
              borderColor={humanColor} 
              p={6}
            >
              <HStack spacing={4} mb={6}>
                <Center bg="white" w="44px" h="44px">
                  <Icon as={MdPerson} color="black" w={6} h={6} />
                </Center>
                <VStack align="start" spacing={0}>
                  <Text fontSize="20px" fontWeight="black" fontStyle="italic" lineHeight="1">HUMAN_HANDSHAKE</Text>
                  <Text fontSize="8px" color="whiteAlpha.400" fontWeight="black" fontFamily="monospace" mt={1}>
                    PHANTOM_LINK // MULTI_PROTOCOL
                  </Text>
                </VStack>
              </HStack>

              <VStack spacing={4} align="stretch">
                <Button 
                  onClick={handleHumanLogin} 
                  isLoading={isSubmitting || !ready}
                  loadingText={!ready ? "INITIALIZING..." : "ESTABLISHING..."}
                  size="lg"
                  bg="white"
                  color="black"
                  _hover={{ bg: 'whiteAlpha.800' }}
                  borderRadius="0"
                  height="60px"
                  fontSize="16px"
                  fontWeight="black"
                  fontStyle="italic"
                  rightIcon={<Icon as={MdChevronRight} />}
                >
                  INITIATE_HANDSHAKE
                </Button>
                
                <Text fontSize="7px" color="whiteAlpha.300" fontWeight="black" fontFamily="monospace" textAlign="center">
                  * SUPPORTS EMAIL / GOOGLE / APPLE / WALLET
                </Text>
              </VStack>
            </Box>
          </VStack>

          <VStack spacing={2} pt={8} textAlign="center">
            <Text fontSize="8px" color={agentAccent} fontWeight="black" fontFamily="monospace">
              SYSTEM_READY // SECURE_LINK_ACTIVE
            </Text>
            <Text fontSize="7px" color="whiteAlpha.300" fontWeight="black" fontFamily="monospace">
              ID_ENCRYPTION: AES_256_GCM // SECURED_BY_PRIVY
            </Text>
            <Box mt={4} p={2} border="1px solid" borderColor="whiteAlpha.100">
               <Text fontSize="6px" color="whiteAlpha.400" fontFamily="monospace">
                 DEBUG: {ready ? 'READY' : 'NOT_READY'} // APP_ID: {PRIVY_APP_ID.slice(0, 8)}...
               </Text>
            </Box>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}

export default Landing;
