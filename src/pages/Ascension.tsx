import {
  Box, Container, Heading, Text, VStack, HStack, Flex, Button, Center, Spinner,
  useToast, Icon
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { MdBolt, MdRefresh, MdLock, MdCheck, MdMilitaryTech } from 'react-icons/md'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { effectiveStamina, DEFAULT_MAX_STAMINA, RECHARGE_COST } from '../lib/ascension'

interface Season {
  id: string; title: string; code: string | null; end_date: string;
  level_count: number; xp_per_level: number;
}
interface Progress {
  id: string; xp: number; level: number; is_premium: boolean;
  claimed_levels: string[]; physical_claimed: boolean;
}
interface Reward {
  id: string; level: number; track: 'free' | 'premium';
  reward_type: 'avatar' | 'theme' | 'wngs' | 'physical';
  product_id: string | null; wngs_amount: number | null; label: string | null;
}

const Ascension = () => {
  const { user, getAccessToken } = usePrivy()
  const toast = useToast()
  const { wngsBalance, setWngsBalance } = useStore()

  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState<Season | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [stamina, setStamina] = useState(0)
  const [staminaRaw, setStaminaRaw] = useState<{ s: number; at: string; max: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const maxStamina = staminaRaw?.max || DEFAULT_MAX_STAMINA

  const loadAll = async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: seasonRow } = await supabase
        .from('seasons').select('*').eq('is_active', true)
        .order('start_date', { ascending: false }).limit(1).maybeSingle()

      if (!seasonRow) { setSeason(null); setLoading(false); return }
      setSeason(seasonRow as Season)

      const token = await getAccessToken()
      // Profile/stamina via service-role endpoint (RLS read is blocked).
      const profRes = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, action: 'ensure_profile' }),
      })
      const prof = (await profRes.json().catch(() => null))?.profile || null

      const [{ data: prog }, { data: rw }, { data: prods }] = await Promise.all([
        supabase.from('user_season_progress').select('*').eq('user_id', user.id).eq('season_id', seasonRow.id).maybeSingle(),
        supabase.from('season_rewards').select('*').eq('season_id', seasonRow.id).order('level', { ascending: true }),
        supabase.from('products').select('id, name'),
      ])

      setProgress(prog as Progress | null)
      setRewards((rw || []) as Reward[])
      if (prods) setProductNames(Object.fromEntries(prods.map((p: any) => [p.id, p.name])))
      if (prof) {
        const max = prof.max_stamina || DEFAULT_MAX_STAMINA
        setStaminaRaw({ s: prof.current_stamina, at: prof.last_stamina_regen, max })
        setStamina(effectiveStamina(prof.current_stamina, prof.last_stamina_regen, max))
        if (typeof prof.wngs_balance === 'number') setWngsBalance(prof.wngs_balance)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [user?.id])

  // Tick the displayed stamina up as it regenerates.
  useEffect(() => {
    if (!staminaRaw) return
    const t = setInterval(() => setStamina(effectiveStamina(staminaRaw.s, staminaRaw.at, staminaRaw.max)), 30000)
    return () => clearInterval(t)
  }, [staminaRaw])

  const post = async (body: Record<string, any>) => {
    const token = await getAccessToken()
    const res = await fetch('/api/v2/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user?.id, ...body }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.error || 'REQUEST_FAILED')
    return data
  }

  const handleRecharge = async () => {
    setBusy('recharge')
    try {
      const data = await post({ action: 'recharge_stamina' })
      setWngsBalance(data.newBalance)
      setStamina(data.stamina ?? maxStamina)
      setStaminaRaw((prev) => prev ? { ...prev, s: data.stamina ?? maxStamina, at: new Date().toISOString() } : prev)
      toast({ title: 'STAMINA_RECHARGED', status: 'success', duration: 2000 })
    } catch (e: any) {
      toast({ title: 'RECHARGE_FAILED', description: e.message, status: 'error', duration: 3000 })
    } finally { setBusy(null) }
  }

  const handleClaim = async (reward: Reward) => {
    setBusy(reward.id)
    try {
      await post({ action: 'claim_reward', rewardId: reward.id })
      toast({ title: 'REWARD_CLAIMED', status: 'success', duration: 2000 })
      await loadAll()
    } catch (e: any) {
      toast({ title: 'CLAIM_FAILED', description: e.message, status: 'error', duration: 3000 })
    } finally { setBusy(null) }
  }

  const rewardLabel = (r: Reward) => {
    if (r.label) return r.label
    if (r.reward_type === 'wngs') return `${r.wngs_amount || 0} WNGS`
    if (r.product_id && productNames[r.product_id]) return productNames[r.product_id]
    return r.reward_type.toUpperCase()
  }

  if (loading) {
    return <Center h="100vh" bg="black"><Spinner color="var(--monarch-accent)" size="xl" /></Center>
  }

  if (!season) {
    return (
      <Center h="100vh" bg="black" flexDirection="column" p={6}>
        <Heading color="white" fontFamily="'Archivo Black', sans-serif" fontStyle="italic">ASCENSION</Heading>
        <Text color="whiteAlpha.600" fontFamily="monospace" fontSize="xs" mt={4}>[ NO_ACTIVE_SEASON ]</Text>
      </Center>
    )
  }

  const level = progress?.level || 0
  const xp = progress?.xp || 0
  const isPremium = !!progress?.is_premium
  const maxed = level >= season.level_count
  const intoLevel = maxed ? season.xp_per_level : xp - level * season.xp_per_level
  const pct = Math.min(100, Math.round((intoLevel / season.xp_per_level) * 100))
  const daysLeft = Math.max(0, Math.ceil((new Date(season.end_date).getTime() - Date.now()) / 86400000))
  const claimed = new Set(progress?.claimed_levels || [])

  // Group rewards by level for the ladder.
  const byLevel: Record<number, { free?: Reward; premium?: Reward }> = {}
  rewards.forEach((r) => {
    byLevel[r.level] = byLevel[r.level] || {}
    byLevel[r.level][r.track] = r
  })

  const accent = 'var(--monarch-accent)'

  // A single reward on a rung (free or premium), with its claim/lock/claimed state.
  const RewardChip = ({ r }: { r: Reward }) => {
    const reached = level >= r.level
    const locked = r.track === 'premium' && !isPremium
    const isClaimed = claimed.has(r.id)
    const canClaim = reached && !locked && !isClaimed
    return (
      <Flex
        align="center" justify="space-between" gap={2} minH="34px" px={2} py={1}
        border="1px solid"
        borderColor={canClaim ? accent : isClaimed ? 'whiteAlpha.400' : 'whiteAlpha.200'}
        bg={isClaimed ? 'whiteAlpha.50' : 'transparent'}
        opacity={reached || !locked ? 1 : 0.55}
      >
        <Box minW={0}>
          <Text fontSize="6px" fontWeight="900" fontFamily="monospace" letterSpacing="0.12em"
            color={r.track === 'premium' ? accent : 'whiteAlpha.500'}>
            {r.track.toUpperCase()}
          </Text>
          <Text fontSize="9px" fontWeight="900" color="white" fontFamily="monospace" noOfLines={1}>
            {rewardLabel(r)}
          </Text>
        </Box>
        {isClaimed ? (
          <Icon as={MdCheck} color={accent} boxSize="15px" flexShrink={0} />
        ) : canClaim ? (
          <Button size="xs" h="20px" px={2} fontSize="7px" borderRadius="0" bg={accent} color="black"
            flexShrink={0} isLoading={busy === r.id} onClick={() => handleClaim(r)} _hover={{ bg: 'white' }}>
            CLAIM
          </Button>
        ) : locked ? (
          <Icon as={MdLock} color="whiteAlpha.500" boxSize="13px" flexShrink={0} />
        ) : (
          <Text fontSize="6px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace" flexShrink={0}>LVL {r.level}</Text>
        )}
      </Flex>
    )
  }

  // One rung of the ladder: numbered node on the spine + that tier's rewards.
  // The current level shows a "YOU" frontier marker above its node.
  const Rung = ({ lvl }: { lvl: number }) => {
    const reached = level >= lvl
    const isCurrent = lvl === level
    const cell = byLevel[lvl] || {}
    const hasReward = !!(cell.free || cell.premium)
    return (
      <Box position="relative">
        {isCurrent && (
          <Flex align="center" gap={2} ml="40px" mb={1}>
            <Box flex={1} h="2px" bg={accent} />
            <Text fontSize="8px" fontWeight="900" color={accent} fontFamily="monospace" letterSpacing="0.15em">
              ◀ YOU // LVL {lvl}
            </Text>
          </Flex>
        )}
        <HStack spacing={3} align="stretch" minH={hasReward ? '44px' : '30px'}>
          {/* spine + node */}
          <Box position="relative" w="32px" flexShrink={0}>
            <Box position="absolute" left="50%" top={0} bottom={0} w="2px" transform="translateX(-50%)"
              bg={reached ? accent : 'whiteAlpha.200'} />
            <Center position="absolute" left="50%" top="50%" transform="translate(-50%,-50%)" w="30px" h="22px"
              zIndex={1} border="2px solid" borderColor={isCurrent ? 'white' : reached ? accent : 'whiteAlpha.300'}
              bg={reached ? accent : 'black'}>
              <Text fontSize="10px" fontWeight="900" fontFamily="monospace" color={reached ? 'black' : 'whiteAlpha.500'}>
                {lvl}
              </Text>
            </Center>
          </Box>
          {/* rewards */}
          <VStack spacing={1} align="stretch" flex={1} justify="center" py={hasReward ? 1 : 0}>
            {cell.free && <RewardChip r={cell.free} />}
            {cell.premium && <RewardChip r={cell.premium} />}
          </VStack>
        </HStack>
      </Box>
    )
  }

  return (
    <Box bg="black" minH="100vh" pb="100px">
      <Container maxW="container.sm" p={0}>
        {/* Header */}
        <Box p={8}>
          <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace" letterSpacing="0.2em">
            SEASON {season.code || ''} // {daysLeft} DAYS LEFT
          </Text>
          <Heading fontSize="5xl" fontWeight="900" fontStyle="italic" color="white" fontFamily="'Archivo Black', sans-serif" lineHeight="1">
            ASCENSION
          </Heading>
          <Text fontSize="xs" fontWeight="900" color="whiteAlpha.700" fontFamily="monospace" mt={1}>{season.title}</Text>
        </Box>

        {/* Level + XP */}
        <Box px={8}>
          <Flex justify="space-between" align="end" mb={1}>
            <HStack spacing={2} align="end">
              <Heading fontSize="3xl" fontWeight="900" color="white" fontFamily="'Archivo Black', sans-serif">LVL {level}</Heading>
              {isPremium && <Box bg="var(--monarch-accent)" px={2} py={0.5} mb={1}><Text fontSize="8px" fontWeight="900" color="black" fontFamily="monospace">PREMIUM</Text></Box>}
            </HStack>
            <Text fontSize="9px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace">
              {maxed ? 'MAX' : `${intoLevel} / ${season.xp_per_level} XP`}
            </Text>
          </Flex>
          <Box w="100%" h="10px" border="1px solid" borderColor="white" p="1px">
            <Box h="100%" bg="var(--monarch-accent)" w={`${pct}%`} transition="width 0.3s" />
          </Box>
          <Text fontSize="7px" fontWeight="900" color="whiteAlpha.500" fontFamily="monospace" mt={1}>
            TOTAL_XP: {xp} // {season.level_count} LEVELS
          </Text>
        </Box>

        {/* Stamina */}
        <Box px={8} mt={6}>
          <Flex justify="space-between" align="center" border="1px solid" borderColor="whiteAlpha.300" p={3}>
            <HStack spacing={3}>
              <Icon as={MdBolt} color="var(--monarch-accent)" boxSize="18px" />
              <HStack spacing={1}>
                {Array.from({ length: maxStamina }).map((_, i) => (
                  <Box key={i} w="14px" h="20px" border="1px solid" borderColor="white" bg={i < stamina ? 'var(--monarch-accent)' : 'transparent'} />
                ))}
              </HStack>
              <Text fontSize="8px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace">SOCIAL_STAMINA {stamina}/{maxStamina}</Text>
            </HStack>
            <Button
              size="xs" borderRadius="0" h="28px" fontSize="8px" fontFamily="monospace"
              bg={stamina >= maxStamina ? 'whiteAlpha.200' : 'var(--monarch-accent)'}
              color={stamina >= maxStamina ? 'whiteAlpha.500' : 'black'}
              isDisabled={stamina >= maxStamina || wngsBalance < RECHARGE_COST}
              isLoading={busy === 'recharge'}
              leftIcon={<MdRefresh />}
              onClick={handleRecharge}
              _hover={{ bg: 'white' }}
            >
              RECHARGE // {RECHARGE_COST}
            </Button>
          </Flex>
          <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace" mt={1}>
            SHARE YOUR SOCIAL LINK TO MINE XP &amp; WNGS WHILE STAMINA LASTS.
          </Text>
        </Box>

        {/* Tier ladder */}
        <Box p={8}>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading fontSize="xs" fontWeight="900" color="white" fontFamily="'Archivo Black', sans-serif">
              TIER_LADDER
            </Heading>
            <Text fontSize="8px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace" letterSpacing="0.1em">
              TIER {level} / {season.level_count}
            </Text>
          </Flex>

          {/* Summit cap */}
          <HStack spacing={3} mb={1}>
            <Center w="32px" flexShrink={0}>
              <Icon as={MdMilitaryTech} color={maxed ? accent : 'whiteAlpha.400'} boxSize="20px" />
            </Center>
            <Text fontSize="8px" fontWeight="900" fontFamily="monospace" letterSpacing="0.15em"
              color={maxed ? accent : 'whiteAlpha.500'}>
              SUMMIT // TIER {season.level_count}{maxed ? ' // REACHED' : ''}
            </Text>
          </HStack>

          {/* Rungs, summit (highest) down to base */}
          <VStack spacing={0} align="stretch">
            {Array.from({ length: season.level_count }, (_, i) => season.level_count - i).map((lvl) => (
              <Rung key={lvl} lvl={lvl} />
            ))}
          </VStack>

          {/* Base — also where a brand-new (level 0) climber starts */}
          {level === 0 && (
            <Flex align="center" gap={2} ml="40px" mt={1}>
              <Box flex={1} h="2px" bg={accent} />
              <Text fontSize="8px" fontWeight="900" color={accent} fontFamily="monospace" letterSpacing="0.15em">
                ◀ YOU // START
              </Text>
            </Flex>
          )}
          <HStack spacing={3} mt={1}>
            <Center w="32px" flexShrink={0}><Box w="10px" h="2px" bg="whiteAlpha.400" /></Center>
            <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="monospace" letterSpacing="0.15em">
              BASE // TIER 01
            </Text>
          </HStack>

          {rewards.length === 0 && (
            <Text fontSize="9px" fontWeight="900" color="whiteAlpha.500" fontFamily="monospace" mt={4}>
              [ TIERS LIVE // REWARDS BEING CONFIGURED ]
            </Text>
          )}
        </Box>
      </Container>
    </Box>
  )
}

export default Ascension
