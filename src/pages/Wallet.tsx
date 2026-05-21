import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  SimpleGrid, 
  Icon, 
  Flex, 
  Button,
  Center
} from '@chakra-ui/react'
import { MdOutlineElectricBolt, MdHistory, MdCreditCard, MdTrendingUp } from 'react-icons/md'
import useStore from '../store/useStore'

const Wallet = () => {
  const { points } = useStore()

  const activities = [
    { title: 'NFC TAP REGISTERED', wngs: '1', date: 'TODAY', desc: 'REGISTERED' },
    { title: 'PROFILE SHARED', wngs: '0', date: 'YESTERDAY', desc: 'SHARED' },
    { title: 'INVITE ACCEPTED', wngs: '0', date: 'APR 20, 2026', desc: 'ACCEPTED' },
  ];

  return (
    <Box bg="black" minH="100vh" pb="100px">
      {/* Header */}
      <Box bg="#FFB000" p={8}>
        <Heading 
          fontSize="4xl" 
          fontWeight="900" 
          fontStyle="italic" 
          lineHeight="1" 
          mb={2}
          color="white"
          fontFamily="'Archivo Black', sans-serif"
        >
          WNGS_WALLET
        </Heading>
        <Text fontSize="9px" fontWeight="900" fontFamily="monospace" color="black" letterSpacing="0.1em">
          DIGITAL_ASSETS // FINANCIAL_TERMINAL
        </Text>
      </Box>

      <VStack spacing={6} p={6} align="stretch">
        {/* Balance Card */}
        <Box 
          bg="white" 
          color="black" 
          p={8} 
          borderRadius="0" 
          borderLeft="12px solid #FFB000"
        >
          <Flex justify="space-between" align="center" mb={4}>
            <Text fontSize="10px" fontWeight="900" fontFamily="monospace">AVAILABLE_WNGS</Text>
            <Icon as={MdOutlineElectricBolt} color="#FFB000" w={6} h={6} />
          </Flex>
          <Heading fontSize="6xl" fontWeight="900" fontStyle="italic" lineHeight="1" mb={2} fontFamily="'Archivo Black', sans-serif">
            {points}
          </Heading>
          <Text fontSize="12px" fontWeight="900" fontFamily="monospace" mb={8} opacity={0.6}>
            $WNGS // MONARCH_CREDITS
          </Text>
          
          <HStack spacing={4}>
            <Button 
              flex={1} 
              h="60px" 
              bg="#FFB000" 
              color="black" 
              borderRadius="0" 
              fontWeight="900" 
              fontSize="xs"
              leftIcon={<MdCreditCard />}
              _hover={{ bg: "#e69e00" }}
              fontFamily="monospace"
            >
              BUY_WNGS
            </Button>
            <Button 
              flex={1} 
              h="60px" 
              bg="black" 
              color="#FFB000" 
              borderRadius="0" 
              fontWeight="900" 
              fontSize="xs"
              leftIcon={<MdTrendingUp />}
              _hover={{ bg: "#1a1a1a" }}
              fontFamily="monospace"
            >
              EARN_WNGS
            </Button>
          </HStack>
        </Box>

        {/* Stats Grid */}
        <SimpleGrid columns={2} spacing={4}>
          <Box bg="black" border="1px solid white" p={6}>
            <Text fontSize="8px" fontWeight="900" color="whiteAlpha.600" mb={2} fontFamily="monospace">TOTAL_EARNED</Text>
            <Text fontSize="3xl" fontWeight="900" color="white" fontFamily="monospace">01250</Text>
          </Box>
          <Box bg="black" border="1px solid white" p={6}>
            <Text fontSize="8px" fontWeight="900" color="whiteAlpha.600" mb={2} fontFamily="monospace">XP_MULTIPLIER</Text>
            <Text fontSize="3xl" fontWeight="900" color="#FFB000" fontFamily="monospace">x1.25</Text>
          </Box>
        </SimpleGrid>

        {/* History */}
        <Box mt={4}>
          <Text fontSize="10px" fontWeight="900" color="whiteAlpha.600" mb={6} fontFamily="monospace">TRANSACTION_HISTORY</Text>

          <VStack align="stretch" spacing={0}>
            {activities.map((item, idx) => (
              <Box 
                key={idx} 
                py={6} 
                borderBottom="1px solid" 
                borderColor="whiteAlpha.300"
              >
                <Flex align="center" justify="space-between">
                  <HStack spacing={4}>
                    <Center 
                      bg="whiteAlpha.100" 
                      w="40px" 
                      h="40px" 
                      borderRadius="full"
                    >
                      <Icon as={MdHistory} color="whiteAlpha.600" />
                    </Center>
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="900" fontSize="xs" color="white" textTransform="uppercase">{item.title}</Text>
                    </VStack>
                  </HStack>
                  <VStack align="end" spacing={0}>
                    <Text fontWeight="900" fontSize="md" color="white">{item.wngs}</Text>
                    <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace">WNGS</Text>
                  </VStack>
                </Flex>
              </Box>
            ))}
          </VStack>
        </Box>
      </VStack>
    </Box>
  )
}

export default Wallet
