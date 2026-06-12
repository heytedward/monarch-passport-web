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
  Button,
  useColorModeValue
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdSettings, MdLock } from 'react-icons/md'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabase'
import DeStijlAvatar from '../components/DeStijlAvatar'
import useStore from '../store/useStore'

const Profile = () => {
  const navigate = useNavigate()
  const { user } = usePrivy()
  const { wngsBalance, isLoading } = useStore()
  const [activeTab, setActiveTab] = useState<'STATS' | 'QUESTS' | 'LOG'>('STATS');
  const [activeQuests, setActiveQuests] = useState<any[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    // Generate the unique link using the user's Privy ID or wallet
    const socialUrl = `${window.location.origin}/social/${user?.id || 'guest'}`;
    navigator.clipboard.writeText(socialUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  useEffect(() => {
    const fetchQuests = async () => {
      const { data, error } = await supabase
        .from('quests')
        .select('*')
        .eq('is_active', true);
      
      if (!error && data) {
        setActiveQuests(data);
      }
    };
    fetchQuests();
  }, []);

  const bg = useColorModeValue("white", "black");
  const cardBg = useColorModeValue("gray.50", "gray.900");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.300");

  const stats = [
    { label: 'WNGS_BALANCE', value: isLoading ? "..." : wngsBalance.toString() },
    { label: 'TOTAL_XP', value: '0' },
    { label: 'QUESTS_CLEARED', value: '1/4' },
    { label: 'ARTIFACT_LEVEL', value: '01' },
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
            <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="monospace">ACTIVE_QUESTS</Text>
            {activeQuests.length > 0 ? (
              activeQuests.map((quest) => (
                <HStack key={quest.id} p={4} border={`4px solid ${text}`} justify="space-between" bg={bg}>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" fontWeight="900" color={text}>// {quest.title.toUpperCase()}</Text>
                    <Text fontSize="9px" color={mutedText}>{quest.description}</Text>
                  </VStack>
                  <Text fontSize="xs" fontWeight="900" color="#FFB000" fontFamily="monospace">
                    +{quest.reward_wngs} WNGS
                  </Text>
                </HStack>
              ))
            ) : (
              <Center p={8}>
                <Text fontSize="xs" fontWeight="900" color={mutedText} fontFamily="monospace">
                  [ NO_ACTIVE_QUESTS_FOUND ]
                </Text>
              </Center>
            )}
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
        <Box 
          position="absolute" 
          top={4} 
          right={4} 
          cursor="pointer" 
          _hover={{ transform: "rotate(90deg)" }} 
          transition="all 0.4s"
          onClick={() => navigate('/settings')}
        >
          <Icon as={MdSettings} color={bg} w={6} h={6} />
        </Box>

        <VStack spacing={6}>
          {/* Identity Matrix (The colorful grid) */}
          <DeStijlAvatar seed={user?.id || 'default'} size={200} />

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
        <Text fontSize="9px" fontWeight="900" color={text} fontFamily="monospace" mb={4}>
          SOCIAL_MINER_HUB // SEASON_01
        </Text>
        
        <VStack align="stretch" spacing={4}>
          <Text fontSize="10px" color={mutedText} fontFamily="monospace">
            SHARE YOUR DIGITAL ARTIFACT LINK TO MINE WNGS. LIMIT: 3 SUCCESSFUL MINES PER DAY.
          </Text>
          
          <Button
            onClick={handleCopyLink}
            bg="#FFB000"
            color="black"
            height="50px"
            borderRadius="0"
            fontWeight="900"
            fontSize="sm"
            fontFamily="monospace"
            _hover={{ bg: "#e69e00" }}
            _active={{ bg: "#cc8c00" }}
            width="full"
          >
            {linkCopied ? '[ SIGNAL_COPIED_TO_CLIPBOARD ]' : 'GENERATE_SOCIAL_LINK'}
          </Button>
        </VStack>
      </Box>
    </Box>
  )
}

export default Profile
