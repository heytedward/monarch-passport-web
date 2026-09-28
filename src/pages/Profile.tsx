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
  useToast,
  useColorModeValue
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { MdSettings, MdLock, MdBolt, MdCreditCard, MdHistory, MdLocalOffer, MdContentCopy, MdClose } from 'react-icons/md'
import { useAuth } from '../lib/auth';
import DeStijlAvatar from '../components/DeStijlAvatar'
import useStore from '../store/useStore'
import { staggerContainer, staggerItem } from '../lib/motion'
import { STAMPS_ENABLED, QUESTS_ENABLED } from '../lib/features'
import { displayName } from '../lib/displayName'

const MotionSimpleGrid = motion.create(SimpleGrid)
const MotionBox = motion.create(Box)

const Profile = () => {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const toast = useToast()
  const { user, getAccessToken } = useAuth()
  
  const solanaWallet = user?.linkedAccounts?.find(
    (account: any) => account.type === 'wallet' && account.walletClientType === 'privy' && account.connectorType === 'embedded'
  ) || (user as any)?.wallets?.find((w: any) => w.chainType === 'solana');
  const solanaAddress = (solanaWallet as any)?.address;

  // Derive a handle from the real account (email > wallet > fallback).
  const email = (user as any)?.email?.address as string | undefined;
  const handle = email
    ? '@' + email.split('@')[0].toUpperCase()
    : solanaAddress
      ? '@' + solanaAddress.slice(0, 6).toUpperCase()
      : '@OPERATOR';

  const { wngsBalance, totalTaps, isLoading, setWngsBalance } = useStore()
  const [activeTab, setActiveTab] = useState<'STATS' | 'WALLET' | 'QUESTS' | 'STAMPS'>('STATS');
  const [activeQuests, setActiveQuests] = useState<any[]>([]);
  const [userQuests, setUserQuests] = useState<Record<string, { status: string; progress: number; target: number }>>({});
  const [progress, setProgress] = useState<any>(null);
  const [stamps, setStamps] = useState<any[]>([]);
  const [stampsLoading, setStampsLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transLoading, setTransLoading] = useState(true);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [genUsd, setGenUsd] = useState(5);
  const [genBusy, setGenBusy] = useState(false);

  const discountApi = async (body: Record<string, any>) => {
    const token = await getAccessToken();
    const res = await fetch('/api/v2/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user?.id, ...body }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) throw new Error(displayName(data?.error) || 'REQUEST FAILED');
    return data;
  };

  const loadDiscounts = async () => {
    if (!user?.id) return;
    try {
      const d = await discountApi({ action: 'get_discounts' });
      setDiscounts(d.discounts || []);
    } catch { /* leave empty */ }
  };

  const handleGenerateDiscount = async () => {
    if (wngsBalance < genUsd * 100) {
      toast({ title: 'NOT ENOUGH WNGS', status: 'error', duration: 3000 });
      return;
    }
    setGenBusy(true);
    try {
      const d = await discountApi({ action: 'create_discount', discountUsd: genUsd });
      setWngsBalance(d.balance);
      toast({ title: `$${genUsd}_DISCOUNT CREATED`, description: `CODE: ${d.code}`, status: 'success', duration: 5000 });
      loadDiscounts();
    } catch (e: any) {
      toast({ title: 'COULD NOT CREATE', description: String(e?.message || ''), status: 'error', duration: 3000 });
    } finally {
      setGenBusy(false);
    }
  };

  const handleCancelDiscount = async (code: string) => {
    try {
      const d = await discountApi({ action: 'cancel_discount', code });
      setWngsBalance(d.balance);
      toast({ title: 'CODE CANCELLED', description: `+${d.refunded} WNGS REFUNDED`, status: 'success', duration: 3000 });
      loadDiscounts();
    } catch {
      toast({ title: 'COULD NOT CANCEL', status: 'error', duration: 3000 });
    }
  };

  const copyDiscount = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'COPIED', description: code, status: 'success', duration: 1500 });
  };

  useEffect(() => {
    const fetchQuests = async () => {
      if (!QUESTS_ENABLED) return;
      if (!user?.id) return;
      // Service-role read: returns active quests + this user's progress, so the
      // RLS-blocked per-user read of user_quests isn't an issue.
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'get_quests' }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success) {
          setActiveQuests(data.quests || []);
          const map: Record<string, { status: string; progress: number; target: number }> = {};
          (data.userQuests || []).forEach((uq: any) => {
            map[uq.quest_id] = { status: uq.status, progress: uq.progress, target: uq.target };
          });
          setUserQuests(map);
        }
      } catch { /* leave quests empty on failure */ }
    };
    fetchQuests();
  }, [user?.id]);

  useEffect(() => {
    // Season progress feeds the ARTIFACT_LEVEL stat. The full Ascension ladder
    // lives on its own /ascension page (ASCEND in the nav).
    const loadProgress = async () => {
      if (!user?.id) return;
      try {
        const token = await getAccessToken();
        // Season progress comes from the server: reading it with the anon
        // client required a world-readable RLS policy on user_season_progress,
        // since Supabase can't identify a Privy user. See db/rls_hardening.sql.
        const progRes = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'get_season_progress' }),
        });
        setProgress((await progRes.json().catch(() => null))?.progress || null);

        const res = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'ensure_profile' }),
        });
        await res.json().catch(() => null); // ensure_profile creates the row for new users
      } catch { /* ignore */ }
    };
    loadProgress();
  }, [user?.id]);

  useEffect(() => {
    const fetchStamps = async () => {
      if (!STAMPS_ENABLED || !user?.id) return;
      setStampsLoading(true);
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'get_stamps' }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success) setStamps(data.stamps || []);
      } catch { /* leave stamps empty on failure */ }
      setStampsLoading(false);
    };
    fetchStamps();
  }, [user?.id]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.id) return;
      setTransLoading(true);
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'get_transactions' }),
        });
        const data = await res.json().catch(() => null);
        if (data?.transactions) setTransactions(data.transactions);
      } catch { /* leave transactions empty on failure */ } finally {
        setTransLoading(false);
      }
    };
    fetchTransactions();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) loadDiscounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // After a successful WNGS purchase, Stripe returns to /profile?checkout=success
  // -> open the WALLET tab so the new balance + transaction are front and centre.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
      setActiveTab('WALLET');
    }
  }, []);

  const bg = useColorModeValue("white", "black");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const cardBg = useColorModeValue("gray.100", "whiteAlpha.100");
  const histBorder = useColorModeValue("gray.200", "whiteAlpha.200");

  const questsCleared = activeQuests.filter((q) => userQuests[q.id]?.status === 'COMPLETED').length;

  const stats = [
    { label: 'WNGS BALANCE', value: isLoading ? "..." : wngsBalance.toString() },
    ...(QUESTS_ENABLED ? [{ label: 'QUESTS CLEARED', value: `${questsCleared}/${activeQuests.length}` }] : []),
    { label: 'TOTAL TAPS', value: isLoading ? "..." : totalTaps.toString() },
    { label: 'ARTIFACT LEVEL', value: String(progress?.level ?? 0).padStart(2, '0') },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'STATS':
        return (
          <MotionSimpleGrid
            columns={2}
            spacing={0}
            borderBottom={`4px solid ${text}`}
            variants={reduce ? undefined : staggerContainer}
            initial={reduce ? undefined : 'initial'}
            animate={reduce ? undefined : 'enter'}
          >
            {stats.map((stat, idx) => (
              <MotionBox
                key={stat.label}
                variants={reduce ? undefined : staggerItem}
                p={6}
                borderRight={idx % 2 === 0 ? `4px solid ${text}` : "none"}
                borderBottom={idx < 2 ? `4px solid ${text}` : "none"}
                bg={bg}
              >
                <VStack align="start" spacing={2}>
                  <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="mono">{displayName(stat.label)}</Text>
                  <Text fontSize="3xl" fontWeight="900" color={text} fontFamily="mono">{stat.value}</Text>
                </VStack>
              </MotionBox>
            ))}
          </MotionSimpleGrid>
        );
      case 'WALLET':
        return (
          <VStack p={6} spacing={4} align="stretch" bg={bg} borderBottom={`4px solid ${text}`}>
            <Flex justify="space-between" align="center">
              <VStack align="start" spacing={0}>
                <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="mono">AVAILABLE WNGS</Text>
                <Heading fontSize="4xl" fontWeight="900" fontStyle="italic" color={text} fontFamily="heading" lineHeight="1">
                  {isLoading ? 'SYNCING...' : wngsBalance}
                </Heading>
              </VStack>
              <Icon as={MdBolt} color="var(--monarch-accent)" boxSize="28px" />
            </Flex>
            <Button
              onClick={() => navigate('/shop?filter=WNGS')}
              bg="var(--monarch-accent)" color="black" height="44px" borderRadius="0"
              fontWeight="900" fontSize="xs" fontFamily="mono" leftIcon={<MdCreditCard />}
              _hover={{ bg: '#e69e00' }}
            >
              BUY WNGS
            </Button>

            {/* WNGS -> storefront discount code */}
            <Box borderTop={`2px solid ${text}`} pt={4} mt={1}>
              <Flex justify="space-between" align="center" mb={1}>
                <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="mono">STORE DISCOUNT</Text>
                <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="mono">100 WNGS = $1</Text>
              </Flex>
              <Text fontSize="9px" color={mutedText} fontFamily="mono" mb={3} lineHeight="1.5">
                SPEND WNGS FOR A CODE TO REDEEM AT PAPILLONBRAND.US CHECKOUT (UP TO 30% OFF AN ORDER).
              </Text>
              <HStack spacing={2} mb={3}>
                {[1, 5, 10, 25].map((v) => {
                  const affordable = wngsBalance >= v * 100;
                  const sel = genUsd === v;
                  return (
                    <Button
                      key={v} flex={1} height="40px" borderRadius="0"
                      onClick={() => setGenUsd(v)} isDisabled={!affordable}
                      bg={sel ? 'var(--monarch-accent)' : 'transparent'} color={sel ? 'black' : text}
                      border={`3px solid ${sel ? 'var(--monarch-accent)' : text}`} opacity={affordable ? 1 : 0.35}
                      fontFamily="mono" fontWeight="900" fontSize="xs"
                      _hover={{ bg: sel ? 'var(--monarch-accent)' : cardBg }}
                    >
                      ${v}
                    </Button>
                  );
                })}
              </HStack>
              <Button
                width="100%" height="44px" borderRadius="0" onClick={handleGenerateDiscount}
                isLoading={genBusy} isDisabled={wngsBalance < genUsd * 100}
                bg={text} color={bg} fontFamily="mono" fontWeight="900" fontSize="xs"
                leftIcon={<MdLocalOffer />} _hover={{ opacity: 0.85 }}
              >
                GENERATE ${genUsd} CODE{genUsd * 100} WNGS
              </Button>

              {discounts.filter((d) => d.status === 'active').length > 0 && (
                <VStack align="stretch" spacing={2} mt={4}>
                  {discounts.filter((d) => d.status === 'active').map((d) => (
                    <Flex key={d.code} align="center" justify="space-between" p={3} border={`2px solid ${text}`}>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="900" fontSize="sm" color={text} fontFamily="mono" letterSpacing="0.05em">{d.code}</Text>
                        <Text fontSize="8px" color={mutedText} fontFamily="mono">${Number(d.discount_usd)} OFF · ACTIVE</Text>
                      </VStack>
                      <HStack spacing={1}>
                        <Center as="button" onClick={() => copyDiscount(d.code)} w="34px" h="34px" border={`2px solid ${text}`} color={text} _hover={{ bg: cardBg }}>
                          <Icon as={MdContentCopy} boxSize="15px" />
                        </Center>
                        <Center as="button" onClick={() => handleCancelDiscount(d.code)} w="34px" h="34px" border={`2px solid ${text}`} color={text} _hover={{ bg: cardBg }}>
                          <Icon as={MdClose} boxSize="15px" />
                        </Center>
                      </HStack>
                    </Flex>
                  ))}
                  <Text fontSize="8px" color={mutedText} fontFamily="mono">CANCEL AN UNUSED CODE ANYTIME TO REFUND ITS WNGS.</Text>
                </VStack>
              )}
            </Box>

            <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="mono" pt={2}>TRANSACTION HISTORY</Text>
            {transLoading ? (
              <Center py={8}><Spinner color="var(--monarch-accent)" /></Center>
            ) : transactions.length > 0 ? (
              <VStack align="stretch" spacing={0}>
                {transactions.map((item, idx) => (
                  <Flex key={item.id || idx} align="center" justify="space-between" py={4} borderBottom="1px solid" borderColor={histBorder}>
                    <HStack spacing={3}>
                      <Center bg={cardBg} w="34px" h="34px"><Icon as={MdHistory} color={mutedText} boxSize="16px" /></Center>
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="900" fontSize="xs" color={text} textTransform="uppercase">{item.transaction_type || item.type || 'TRANSACTION'}</Text>
                        <Text fontSize="8px" color={mutedText} fontFamily="mono">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</Text>
                      </VStack>
                    </HStack>
                    <Text fontWeight="900" fontSize="md" color={item.amount > 0 ? 'var(--monarch-accent)' : text} fontFamily="mono">
                      {item.amount > 0 ? `+${item.amount}` : item.amount}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            ) : (
              <Center py={8} border="1px dashed" borderColor={mutedText}>
                <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="mono">[ NO TRANSACTIONS LOGGED ]</Text>
              </Center>
            )}
          </VStack>
        );
      case 'QUESTS':
        return (
          <VStack p={6} spacing={4} align="stretch" bg={bg} borderBottom={`4px solid ${text}`}>
            <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="mono">ACTIVE QUESTS</Text>
            {activeQuests.length > 0 ? (
              activeQuests.map((quest) => {
                const uq = userQuests[quest.id];
                const cleared = uq?.status === 'COMPLETED';
                const target = uq?.target ?? 1;
                const prog = uq?.progress ?? 0;
                return (
                  <HStack key={quest.id} p={4} border={`4px solid ${cleared ? 'var(--monarch-accent)' : text}`} justify="space-between" bg={bg} opacity={cleared ? 0.7 : 1}>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="xs" fontWeight="900" color={text}>{displayName(quest.title).toUpperCase()}</Text>
                      <Text fontSize="9px" color={mutedText}>{displayName(quest.description)}</Text>
                      {!cleared && target > 1 && (
                        <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="mono" mt={1}>
                          PROGRESS{Math.min(prog, target)}/{target}
                        </Text>
                      )}
                    </VStack>
                    {cleared ? (
                      <Text fontSize="xs" fontWeight="900" color="var(--monarch-accent)" fontFamily="mono">CLEARED</Text>
                    ) : (
                      <Text fontSize="xs" fontWeight="900" color="var(--monarch-accent)" fontFamily="mono">
                        +{quest.reward_wngs} WNGS
                      </Text>
                    )}
                  </HStack>
                );
              })
            ) : (
              <Center p={8}>
                <Text fontSize="xs" fontWeight="900" color={mutedText} fontFamily="mono">
                  [ NO ACTIVE QUESTS FOUND ]
                </Text>
              </Center>
            )}
          </VStack>
        );
      case 'STAMPS':
        return (
          <VStack p={6} spacing={4} align="stretch" bg={bg} borderBottom={`4px solid ${text}`}>
            <Text fontSize="10px" fontWeight="900" color={mutedText} fontFamily="mono">SEASONAL STAMPS</Text>
            {stampsLoading ? (
              <Center p={8}><Spinner color="var(--monarch-accent)" /></Center>
            ) : stamps.length > 0 ? (
              <MotionSimpleGrid
                columns={2}
                spacing={4}
                variants={reduce ? undefined : staggerContainer}
                initial={reduce ? undefined : 'initial'}
                animate={reduce ? undefined : 'enter'}
              >
                {stamps.map((stamp) => (
                  <MotionBox key={stamp.id} variants={reduce ? undefined : staggerItem}>
                   <Box
                    p={4}
                    border={`4px solid ${stamp.earned ? 'var(--monarch-accent)' : text}`}
                    bg={bg}
                    opacity={stamp.earned ? 1 : 0.35}
                    position="relative"
                  >
                    {!stamp.earned && (
                      <Icon as={MdLock} position="absolute" top={2} right={2} color={mutedText} w={3} h={3} />
                    )}
                    <VStack align="start" spacing={1}>
                      <Text
                        fontSize="8px"
                        fontWeight="900"
                        color={stamp.earned ? 'var(--monarch-accent)' : mutedText}
                        fontFamily="mono"
                      >
                        {stamp.earned ? '✓ EARNED' : '[ LOCKED ]'}
                      </Text>
                      <Text fontSize="xs" fontWeight="900" color={text} fontFamily="mono" lineHeight="1.2">
                        {stamp.name.toUpperCase()}
                      </Text>
                      {stamp.description && (
                        <Text fontSize="8px" color={mutedText} fontFamily="mono" lineHeight="1.4">
                          {displayName(stamp.description)}
                        </Text>
                      )}
                      {stamp.earned && stamp.earned_at && (
                        <Text fontSize="7px" color={mutedText} fontFamily="mono" mt={1}>
                          {new Date(stamp.earned_at)
                            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            .toUpperCase()}
                        </Text>
                      )}
                    </VStack>
                   </Box>
                  </MotionBox>
                ))}
              </MotionSimpleGrid>
            ) : (
              <Center p={8}>
                <Text fontSize="xs" fontWeight="900" color={mutedText} fontFamily="mono">
                  [ NO STAMPS FOUND ]
                </Text>
              </Center>
            )}
          </VStack>
        );

    }
  };

  return (
    <Box bg={bg} minH="100vh" pb="120px">
      {/* Header */}
      <Box p={8} pt={12} bg={bg} color={text}>
        <Heading fontSize="6xl" fontWeight="900" fontStyle="italic" mb={1} fontFamily="heading" letterSpacing="-0.04em">
          PROFILE
        </Heading>
        <Text fontSize="9px" fontWeight="900" color={mutedText} fontFamily="mono" letterSpacing="0.1em">
          SYSTEM IDENTITY{handle}
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
            <Heading fontSize="3xl" fontWeight="900" color={bg} fontStyle="italic" fontFamily="heading" letterSpacing="-0.02em">
              {handle}
            </Heading>
            
            {solanaAddress ? (
              <HStack spacing={1.5} bg={useColorModeValue("blackAlpha.100", "whiteAlpha.200")} px={3} py={1} border="1px solid" borderColor={bg}>
                <Box w="6px" h="6px" borderRadius="full" bg="#00FF66" boxShadow="0 0 6px #00FF66" />
                <Text fontSize="10px" fontWeight="900" fontFamily="mono" color={bg}>
                  SOL: {solanaAddress.slice(0, 6)}...{solanaAddress.slice(-4)}
                </Text>
              </HStack>
            ) : (
              <HStack spacing={1.5} bg={useColorModeValue("blackAlpha.100", "whiteAlpha.200")} px={3} py={1} border="1px solid" borderColor={bg}>
                <Spinner size="xs" color={bg} />
                <Text fontSize="9px" fontWeight="900" fontFamily="mono" color={bg} opacity={0.8}>
                  SECURE ENCLAVE GENERATING...
                </Text>
              </HStack>
            )}
          </VStack>
        </VStack>
      </Box>

      {/* Tabs */}
      <Box bg={bg} borderY={`4px solid ${text}`}>
        <Flex>
          {(['STATS', 'WALLET', 'QUESTS', 'STAMPS'] as const).filter((tab) => (STAMPS_ENABLED || tab !== 'STAMPS') && (QUESTS_ENABLED || tab !== 'QUESTS')).map((tab) => (
            <Box 
              key={tab}
              flex={1} 
              py={5} 
              textAlign="center" 
              borderBottom={activeTab === tab ? "8px solid var(--monarch-accent)" : "none"}
              cursor="pointer"
              onClick={() => setActiveTab(tab as any)}
            >
              <Text fontSize="12px" fontWeight="900" color={activeTab === tab ? text : mutedText} fontFamily="mono">
                {tab}
              </Text>
            </Box>
          ))}
        </Flex>
      </Box>

      {/* Dynamic Tab Content */}
      {renderTabContent()}

    </Box>
  )
}

export default Profile
