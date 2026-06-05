import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  useColorModeValue,
  Center,
  Divider,
  HStack,
  Icon,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { PiArrowLeftBold, PiPowerBold, PiUserBold } from 'react-icons/pi';

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = usePrivy();
  
  const bgColor = useColorModeValue("gray.50", "black");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.400");
  const monarchYellow = "#FFB000";

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatAddress = (address: string) => {
    if (!address) return 'NOT_CONNECTED';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const walletAddress = user?.wallet?.address || user?.id || 'UNKNOWN_IDENTITY';

  return (
    <Box bg={bgColor} minH="100vh" pb="100px" color={text} fontFamily="'Space Mono', monospace">
      {/* Header */}
      <Box p={8} pt={12} borderBottom={`4px solid ${text}`}>
        <HStack spacing={4} mb={4}>
          <Button 
            variant="ghost" 
            p={0} 
            _hover={{ bg: 'transparent', transform: 'translateX(-4px)' }}
            onClick={() => navigate(-1)}
          >
            <PiArrowLeftBold size={24} color={text} />
          </Button>
          <Heading 
            fontSize="3xl" 
            fontWeight="900" 
            fontStyle="italic" 
            fontFamily="'Archivo Black', sans-serif"
            textTransform="uppercase"
            letterSpacing="-0.02em"
          >
            // SYSTEM_SETTINGS
          </Heading>
        </HStack>
        <Text fontSize="9px" fontWeight="900" color={mutedText} fontFamily="monospace" letterSpacing="0.1em">
          ACCESS_LEVEL // AUTHORIZED_ADMIN
        </Text>
      </Box>

      <VStack spacing={0} align="stretch">
        {/* Identity Matrix Section */}
        <Box p={8} borderBottom={`1px solid ${border}`}>
          <Text fontSize="xs" fontWeight="900" color={monarchYellow} fontFamily="monospace" mb={6}>
            [ IDENTITY_MATRIX ]
          </Text>
          <Box 
            bg={useColorModeValue("gray.100", "whiteAlpha.100")} 
            p={6} 
            border={`2px solid ${text}`}
            position="relative"
          >
            <VStack align="start" spacing={1}>
              <Text fontSize="10px" color={mutedText} fontWeight="bold">CURRENT_HANDSHAKE</Text>
              <Text fontSize="lg" fontWeight="900" letterSpacing="0.05em">
                {formatAddress(walletAddress)}
              </Text>
            </VStack>
            <Box position="absolute" top={2} right={2}>
              <Icon as={PiUserBold} color={monarchYellow} />
            </Box>
          </Box>
        </Box>

        {/* Session Control Section */}
        <Box p={8} borderBottom={`1px solid ${border}`}>
          <Text fontSize="xs" fontWeight="900" color={monarchYellow} fontFamily="monospace" mb={6}>
            [ SESSION_CONTROL ]
          </Text>
          <VStack spacing={4}>
            <Button 
              leftIcon={<PiPowerBold />}
              bg="#E53E3E" 
              color="white" 
              borderRadius="0" 
              h="60px"
              w="full"
              fontSize="md"
              fontWeight="900"
              _hover={{ bg: '#C53030', transform: 'translateY(-2px)' }}
              _active={{ transform: 'translateY(0)' }}
              onClick={handleLogout}
              boxShadow={`4px 4px 0px 0px ${text}`}
              transition="all 0.2s"
            >
              TERMINATE CONNECTION (LOGOUT)
            </Button>

            <Button 
              variant="outline"
              borderColor={monarchYellow}
              color={monarchYellow}
              borderRadius="0" 
              h="50px"
              w="full"
              fontSize="sm"
              fontWeight="900"
              _hover={{ bg: monarchYellow, color: 'black' }}
              onClick={() => navigate('/profile')}
              borderWidth="2px"
            >
              RETURN TO PROFILE
            </Button>
          </VStack>
        </Box>
      </VStack>

      {/* Footer */}
      <Box p={8} mt={10}>
        <VStack spacing={2}>
          <Text fontSize="8px" color={mutedText} textAlign="center" fontFamily="monospace">
            MONARCH_OS // V1.2.4
          </Text>
          <Text fontSize="8px" color={mutedText} textAlign="center" fontFamily="monospace">
            ENCRYPTION_STATUS // ACTIVE
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default Settings;
