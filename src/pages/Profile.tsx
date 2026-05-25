import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Flex, 
  Icon, 
  Center,
  SimpleGrid,
  useColorModeValue
} from '@chakra-ui/react'
import { useState } from 'react'
import { MdSettings, MdLock } from 'react-icons/md'
import { Facehash } from 'facehash'
import useStore from '../store/useStore'

const Profile = () => {
  const { points } = useStore()
  const [activeTab, setActiveTab] = useState<'STATS' | 'QUESTS' | 'LOG'>('STATS');

  const bg = useColorModeValue("white", "black");
  const cardBg = useColorModeValue("gray.50", "gray.900");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.300");

  const stats = [
    { label: 'WNGS_BALANCE', value: points.toString() },
    { label: 'TOTAL_XP', value: '0' },
    { label: 'QUESTS_CLEARED', value: '1/4' },
    { label: 'IDENTITY_TYPE', value: 'AGENT' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'STATS':
        return (
          <SimpleGrid columns={2} spacing={0} borderBottom={`4px solid ${text}`}>
            {stats.map((stat, idx) => (
              <Box 
                key={stat.label} 
                p={6} 
                borderRight={idx % 2 === 0 ? `4px solid ${text}` : "none"}
                borderBottom={idx < 2 ? `4px solid ${text}` : "none"}
                bg={bg}
              >
                <VStack align="start" spacing={2}>
                  <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace">{stat.label}</Text>
                  <Text fontSize="3xl" fontWeight="900" color={text} fontFamily="monospace">{stat.value}</Text>
                </VStack>
              </Box>
            ))}
          </SimpleGrid>
        );
      case 'QUESTS':
        return (
          <VStack p={6} spacing={4} align="stretch" bg={bg} borderBottom={`4px solid ${text}`}>
            <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="monospace">ACTIVE_DIRECTIVES</Text>
            {[1, 2, 3].map(i => (
              <HStack key={i} p={4} border={`4px solid ${text}`} justify="space-between">
                <VStack align="start" spacing={0}>
                  <Text fontSize="xs" fontWeight="900" color={text}>QUEST_ID_00{i}</Text>
                  <Text fontSize="9px" color={mutedText}>ENCRYPTED_DATA_TRANSMISSION</Text>
                </VStack>
                <Icon as={MdLock} color={mutedText} opacity={0.4} />
              </HStack>
            ))}
          </VStack>
        );
      case 'LOG':
        return (
          <VStack p={6} spacing={0} align="stretch" bg={bg} borderBottom={`4px solid ${text}`}>
            <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={4}>SYSTEM_LOG</Text>
            {[1, 2, 4].map(i => (
              <Box key={i} py={4} borderBottom={`2px solid ${border}`}>
                <HStack justify="space-between">
                  <Text fontSize="9px" fontWeight="900" color={text}>SESSION_INITIALIZED</Text>
                  <Text fontSize="8px" color={mutedText}>MAY 16, 2026</Text>
                </HStack>
              </Box>
            ))}
          </VStack>
        );
    }
  };

  return (
    <Box bg={bg} minH="100vh" pb="120px">
      {/* Header */}
      <Box p={8} pt={12} bg={bg} color={text}>
        <Heading fontSize="6xl" fontWeight="900" fontStyle="italic" mb={1} fontFamily="'Archivo Black', sans-serif" letterSpacing="-0.04em">
          PROFILE
        </Heading>
        <Text fontSize="9px" fontWeight="900" color={mutedText} fontFamily="monospace" letterSpacing="0.1em">
          SYSTEM IDENTITY // @BUTTERFLYBOY
        </Text>
      </Box>

      {/* Identity Matrix Section */}
      <Box bg={text} p={10} position="relative">
        <Box position="absolute" top={4} right={4} cursor="pointer" _hover={{ transform: "rotate(90deg)" }} transition="all 0.4s">
          <Icon as={MdSettings} color={bg} w={6} h={6} />
        </Box>

        <VStack spacing={6}>
          {/* Identity Matrix (The colorful grid) */}
          <Box border={`8px solid ${bg}`} p={1.5} bg={bg} boxShadow={`10px 10px 0px 0px ${mutedText}`}>
            <SimpleGrid columns={3} spacing={1.5}>
              <Box w="35px" h="35px" bg="#00E5FF" border={`2px solid ${bg}`} />
              <Box w="35px" h="35px" bg="#FFEB3B" border={`2px solid ${bg}`} />
              <Box w="35px" h="35px" bg="#2979FF" border={`2px solid ${bg}`} />
              <Box w="35px" h="35px" bg="#FF1744" border={`2px solid ${bg}`} />
              {/* CENTER SQUARE: FACEHASH */}
              <Box w="35px" h="35px" bg="black" border={`2px solid ${bg}`} position="relative" overflow="hidden">
                 <Center position="absolute" inset={0}>
                    <Facehash name="butterflyboy" size={28} />
                 </Center>
              </Box>
              <Box w="35px" h="35px" bg="#D500F9" border={`2px solid ${bg}`} />
              <Box w="35px" h="35px" bg="white" border={`2px solid ${bg}`} />
              <Box w="35px" h="35px" bg="white" border={`2px solid ${bg}`} />
              <Box w="35px" h="35px" bg="#FF9100" border={`2px solid ${bg}`} position="relative">
                 <Box position="absolute" bottom={1} right={1} w="12px" h="12px" bg="black" borderRadius="full" border="2px solid white" />
              </Box>
            </SimpleGrid>
            <Center bg={bg} color={text} py={1.5}>
              <Text fontSize="10px" fontWeight="900" fontFamily="monospace">LVL 1</Text>
            </Center>
          </Box>

          <Heading fontSize="3xl" fontWeight="900" color={bg} fontStyle="italic" fontFamily="'Archivo Black', sans-serif" letterSpacing="-0.02em">
            @BUTTERFLYBOY
          </Heading>
        </VStack>
      </Box>

      {/* Tabs */}
      <Box bg={bg} borderY={`4px solid ${text}`}>
        <Flex>
          {['STATS', 'QUESTS', 'LOG'].map((tab) => (
            <Box 
              key={tab}
              flex={1} 
              py={5} 
              textAlign="center" 
              borderBottom={activeTab === tab ? "8px solid #FFB000" : "none"}
              cursor="pointer"
              onClick={() => setActiveTab(tab as any)}
            >
              <Text fontSize="12px" fontWeight="900" color={activeTab === tab ? text : mutedText} fontFamily="monospace">
                {tab}
              </Text>
            </Box>
          ))}
        </Flex>
      </Box>

      {/* Dynamic Tab Content */}
      {renderTabContent()}

      {/* Social Miner Hub Footer */}
      <Box p={6} borderTop={`4px solid ${text}`}>
        <Text fontSize="9px" fontWeight="900" color={text} fontFamily="monospace">
          SOCIAL_MINER_HUB // SEASON_01
        </Text>
      </Box>
    </Box>
  )
}

export default Profile
