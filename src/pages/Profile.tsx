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
  Spinner,
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
  
  const solanaWallet = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.walletClientType === 'privy' && account.connectorType === 'embedded'
  ) || user?.wallets?.find((w: any) => w.chainType === 'solana');
  const solanaAddress = (solanaWallet as any)?.address;

  // Derive a handle from the real account (email > wallet > fallback).
  const email = (user as any)?.email?.address as string | undefined;
  const handle = email
    ? '@' + email.split('@')[0].toUpperCase()
    : solanaAddress
      ? '@' + solanaAddress.slice(0, 6).toUpperCase()
      : '@OPERATOR';

  const { wngsBalance, totalTaps, isLoading } = useStore()
  const [activeTab, setActiveTab] = useState<'STATS' | 'QUESTS' | 'ASCENSION'>('STATS');
  const [activeQuests, setActiveQuests] = useState<any[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [season, setSeason] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [ascLoading, setAscLoading] = useState(true);

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

  useEffect(() => {
    const loadAscension = async () => {
      setAscLoading(true);
      const { data: s } = await supabase
        .from('seasons').select('*').eq('is_active', true)
        .order('start_date', { ascending: false }).limit(1).maybeSingle();
      setSeason(s);
      if (s && user?.id) {
        const { data: p } = await supabase
          .from('user_season_progress').select('*')
          .eq('user_id', user.id).eq('season_id', s.id).maybeSingle();
        setProgress(p);
      }
      setAscLoading(false);
    };
    loadAscension();
  }, [user?.id]);

  const bg = useColorModeValue("white", "black");
  const cardBg = useColorModeValue("gray.50", "gray.900");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");

  const stats = [
    { label: 'WNGS_BALANCE', value: isLoading ? "..." : wngsBalance.toString() },
    { label: 'QUESTS_CLEARED', value: '1/4' },
    { label: 'TOTAL_TAPS', value: isLoading ? "..." : totalTaps.toString() },
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
                  <Text fontSize="xs" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">
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
      case 'ASCENSION': {
        if (ascLoading) {
          return (
            <Center p={10} bg={bg} borderBottom={`4px solid ${text}`}>
              <Spinner color="var(--monarch-accent)" />
            </Center>
          );
        }
        if (!season) {
          return (
            <Center p={10} bg={bg} borderBottom={`4px solid ${text}`}>
              <Text fontSize="xs" fontWeight="900" color={mutedText} fontFamily="monospace">[ NO_ACTIVE_SEASON ]</Text>
            </Center>
          );
        }
        const level = progress?.level || 0;
        const xp = progress?.xp || 0;
        const isPremium = !!progress?.is_premium;
        const maxed = level >= season.level_count;
        const intoLevel = maxed ? season.xp_per_level : xp - level * season.xp_per_level;
        const pct = Math.min(100, Math.round((intoLevel / season.xp_per_level) * 100));
        const daysLeft = Math.max(0, Math.ceil((new Date(season.end_date).getTime() - Date.now()) / 86400000));
        return (
          <VStack p={6} spacing={4} align="stretch" bg={bg} borderBottom={`4px solid ${text}`}>
            <Flex justify="space-between" align="center">
              <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace" letterSpacing="0.1em">
                SEASON {season.code || ''} // {daysLeft} DAYS LEFT
              </Text>
              {isPremium && (
                <Box bg="var(--monarch-accent)" px={2} py={0.5}>
                  <Text fontSize="8px" fontWeight="900" color="black" fontFamily="monospace">PREMIUM</Text>
                </Box>
              )}
            </Flex>

            <Flex justify="space-between" align="end">
              <Heading fontSize="2xl" fontWeight="900" color={text} fontFamily="'Archivo Black', sans-serif">LVL {level}</Heading>
              <Text fontSize="9px" fontWeight="900" color={mutedText} fontFamily="monospace">
                {maxed ? 'MAX' : `${intoLevel} / ${season.xp_per_level} XP`}
              </Text>
            </Flex>

            <Box w="100%" h="10px" border={`1px solid ${text}`} p="1px">
              <Box h="100%" bg="var(--monarch-accent)" w={`${pct}%`} transition="width 0.3s" />
            </Box>

            <Button
              onClick={() => navigate('/ascension')}
              bg={text}
              color={bg}
              height="44px"
              borderRadius="0"
              fontWeight="900"
              fontSize="xs"
              fontFamily="monospace"
              _hover={{ bg: 'var(--monarch-accent)', color: 'black' }}
            >
              VIEW FULL TRACK →
            </Button>
          </VStack>
        );
      }
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
          SYSTEM IDENTITY // {handle}
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

        <VStack spacing={4}>
          {/* Identity Matrix (The colorful grid) */}
          <DeStijlAvatar seed={user?.id || 'default'} size={200} />

          <VStack spacing={2} align="center">
            <Heading fontSize="3xl" fontWeight="900" color={bg} fontStyle="italic" fontFamily="'Archivo Black', sans-serif" letterSpacing="-0.02em">
              {handle}
            </Heading>
            
            {solanaAddress ? (
              <HStack spacing={1.5} bg={useColorModeValue("blackAlpha.100", "whiteAlpha.200")} px={3} py={1} border="1px solid" borderColor={bg}>
                <Box w="6px" h="6px" borderRadius="full" bg="#00FF66" boxShadow="0 0 6px #00FF66" />
                <Text fontSize="10px" fontWeight="900" fontFamily="monospace" color={bg}>
                  SOL: {solanaAddress.slice(0, 6)}...{solanaAddress.slice(-4)}
                </Text>
              </HStack>
            ) : (
              <HStack spacing={1.5} bg={useColorModeValue("blackAlpha.100", "whiteAlpha.200")} px={3} py={1} border="1px solid" borderColor={bg}>
                <Spinner size="xs" color={bg} />
                <Text fontSize="9px" fontWeight="900" fontFamily="monospace" color={bg} opacity={0.8}>
                  SECURE_ENCLAVE_GENERATING...
                </Text>
              </HStack>
            )}
          </VStack>
        </VStack>
      </Box>

      {/* Tabs */}
      <Box bg={bg} borderY={`4px solid ${text}`}>
        <Flex>
          {['STATS', 'QUESTS', 'ASCENSION'].map((tab) => (
            <Box 
              key={tab}
              flex={1} 
              py={5} 
              textAlign="center" 
              borderBottom={activeTab === tab ? "8px solid var(--monarch-accent)" : "none"}
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
            bg="var(--monarch-accent)"
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

          <HStack spacing={4} pt={2}>
            <VStack align="start" spacing={0} flex={1} borderLeft="2px solid" borderColor="var(--monarch-accent)" pl={3}>
              <Text fontSize="7px" fontWeight="900" color={mutedText} fontFamily="monospace">SOCIAL_MINES</Text>
              <Text fontSize="12px" fontWeight="900" color={text} fontFamily="monospace">3/3</Text>
            </VStack>
            <VStack align="start" spacing={0} flex={1} borderLeft="2px solid" borderColor="gray.600" pl={3}>
              <Text fontSize="7px" fontWeight="900" color={mutedText} fontFamily="monospace">AGENT_BANDWIDTH</Text>
              <Text fontSize="12px" fontWeight="900" color={text} fontFamily="monospace">100/100</Text>
            </VStack>
          </HStack>
        </VStack>
      </Box>
    </Box>
  )
}

export default Profile
