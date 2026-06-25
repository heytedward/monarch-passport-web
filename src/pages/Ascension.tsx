import {
  Box, Container, Heading, Text, VStack, HStack, Flex, Button, Center, Spinner,
  SimpleGrid, useToast, Icon
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { MdBolt, MdRefresh } from 'react-icons/md'
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

  // Group rewards by level for the track.
  const levels = Array.from({ length: season.level_count }, (_, i) => i + 1)
  const byLevel: Record<number, { free?: Reward; premium?: Reward }> = {}
  rewards.forEach((r) => {
    byLevel[r.level] = byLevel[r.level] || {}
    byLevel[r.level][r.track] = r
  })

  const RewardCell = ({ r, lvl }: { r?: Reward; lvl: number }) => {
    if (!r) {
      return <Box flex={1} border="1px dashed" borderColor="whiteAlpha.200" h="48px" />
    }
    const reached = level >= lvl
    const locked = r.track === 'premium' && !isPremium
    const isClaimed = claimed.has(r.id)
    const canClaim = reached && !locked && !isClaimed
    return (
      <Box flex={1} border="1px solid" borderColor={canClaim ? 'var(--monarch-accent)' : 'whiteAlpha.300'} h="48px" px={2} position="relative" opacity={reached ? 1 : 0.45}>
        <Text fontSize="7px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace" mt={1}>{r.track.toUpperCase()}</Text>
        <Text fontSize="9px" fontWeight="900" color="white" fontFamily="monospace" noOfLines={1}>{rewardLabel(r)}</Text>
        {isClaimed ? (
          <Text position="absolute" top={1} right={1} fontSize="6px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">CLAIMED</Text>
        ) : locked ? (
          <Text position="absolute" top={1} right={1} fontSize="6px" fontWeight="900" color="whiteAlpha.500" fontFamily="monospace">PREMIUM</Text>
        ) : canClaim ? (
          <Button position="absolute" top="6px" right="6px" size="xs" h="18px" fontSize="7px" borderRadius="0" bg="var(--monarch-accent)" color="black" isLoading={busy === r.id} onClick={() => handleClaim(r)} _hover={{ bg: 'white' }}>CLAIM</Button>
        ) : null}
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

        {/* Reward track */}
        <Box p={8}>
          <Heading fontSize="xs" fontWeight="900" color="white" fontFamily="'Archivo Black', sans-serif" mb={3}>
            REWARD_TRACK
          </Heading>
          <VStack spacing={2} align="stretch">
            {levels.map((lvl) => {
              const cell = byLevel[lvl] || {}
              if (!cell.free && !cell.premium) return null
              return (
                <HStack key={lvl} spacing={2} align="center">
                  <Center w="34px" h="48px" border="1px solid" borderColor={level >= lvl ? 'var(--monarch-accent)' : 'whiteAlpha.300'} flexShrink={0}>
                    <Text fontSize="11px" fontWeight="900" color={level >= lvl ? 'var(--monarch-accent)' : 'whiteAlpha.500'} fontFamily="monospace">{lvl}</Text>
                  </Center>
                  <SimpleGrid columns={2} spacing={2} flex={1}>
                    <RewardCell r={cell.free} lvl={lvl} />
                    <RewardCell r={cell.premium} lvl={lvl} />
                  </SimpleGrid>
                </HStack>
              )
            })}
            {rewards.length === 0 && (
              <Text fontSize="9px" fontWeight="900" color="whiteAlpha.500" fontFamily="monospace">[ NO_REWARDS_CONFIGURED_YET ]</Text>
            )}
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}

export default Ascension
