import {
  Box, Container, Heading, Text, VStack, HStack, Flex, Button, Center,
  useToast, Icon
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth';
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { MdLock, MdCheck, MdMilitaryTech } from 'react-icons/md'
import { supabase } from '../lib/supabase'
import DeStijlAvatar from '../components/DeStijlAvatar'
import ThemeSwatch from '../components/ThemeSwatch'
import { WngsCoin } from '../components/WngsCoin'
import useStore from '../store/useStore'
import { SPRING_SNAPPY } from '../lib/motion'
import { displayName } from '../lib/displayName'
import { readCache, writeCache } from '../lib/pageCache'
import { trackProgress } from '../lib/progress'
import { AscensionSkeleton } from '../components/loading/Skeletons'

const MotionVStack = motion.create(VStack)
const MotionBox = motion.create(Box)

// The ladder can be ~30 rungs, so a tight stagger keeps the whole cascade
// under ~0.8s — the summit-down build reads as the ladder assembling.
const ladderContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
}
const rungItem: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  enter: { opacity: 1, y: 0, scale: 1, transition: SPRING_SNAPPY },
}

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

interface AscensionSnapshot {
  season: Season; rewards: Reward[]; productMap: Record<string, any>; progress: Progress | null
}

const Ascension = () => {
  const { user, getAccessToken } = useAuth()
  const reduce = useReducedMotion()
  const toast = useToast()
  const { setWngsBalance } = useStore()

  // The last loaded track is remembered per user, so coming back to this tab
  // is instant while a fresh copy loads quietly.
  const cacheKey = `ascension:${user?.id ?? 'anon'}`
  const cached = readCache<AscensionSnapshot>(cacheKey)
  const [loading, setLoading] = useState(!cached)
  const [season, setSeason] = useState<Season | null>(cached?.season ?? null)
  const [progress, setProgress] = useState<Progress | null>(cached?.progress ?? null)
  const [rewards, setRewards] = useState<Reward[]>(cached?.rewards ?? [])
  const [productMap, setProductMap] = useState<Record<string, any>>(cached?.productMap ?? {})
  const [busy, setBusy] = useState<string | null>(null)

  // Per-user progress via the service-role endpoint (the anon client can't
  // identify a Privy user). Best-effort: api/ functions don't run under
  // `vite dev`, so a failure here must never blank out the ladder.
  const fetchProgress = async (): Promise<Progress | null> => {
    if (!user?.id) return null
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, action: 'get_season_progress' }),
      })
      return ((await res.json().catch(() => null))?.progress || null) as Progress | null
    } catch {
      return null
    }
  }

  // Season, catalog and progress load in parallel; rewards need the season id.
  const loadAll = async () => {
    const first = !readCache(cacheKey)
    const work = (async () => {
      const progressP = fetchProgress()
      const productsP = supabase.from('products').select('id, name, category, palette, accent_color, theme_mode')
      // Season + rewards are public (anon-readable), so the ladder renders even
      // before/without auth (e.g. the dev bypass, which has no Privy user).
      const { data: seasonRow } = await supabase
        .from('seasons').select('*').eq('is_active', true)
        .order('start_date', { ascending: false }).limit(1).maybeSingle()
      if (!seasonRow) { setSeason(null); return }
      const [{ data: rw }, { data: prods }, prog] = await Promise.all([
        supabase.from('season_rewards').select('*').eq('season_id', seasonRow.id).order('level', { ascending: true }),
        productsP,
        progressP,
      ])
      const map = prods ? Object.fromEntries(prods.map((p: any) => [p.id, p])) : {}
      setSeason(seasonRow as Season)
      setRewards((rw || []) as Reward[])
      setProductMap(map)
      setProgress(prog)
      writeCache<AscensionSnapshot>(cacheKey, { season: seasonRow as Season, rewards: (rw || []) as Reward[], productMap: map, progress: prog })
    })()
    try {
      await (first ? trackProgress(work) : work)
    } finally {
      setLoading(false)
    }
  }

  // A claimed WNGS reward changes the balance; the claim response doesn't carry it.
  const refreshBalance = async () => {
    if (!user?.id) return
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, action: 'ensure_profile' }),
      })
      const prof = (await res.json().catch(() => null))?.profile || null
      if (prof && typeof prof.wngs_balance === 'number') setWngsBalance(prof.wngs_balance)
    } catch { /* balance refreshes on next launch */ }
  }

  useEffect(() => { loadAll() }, [user?.id])

  const post = async (body: Record<string, any>) => {
    const token = await getAccessToken()
    const res = await fetch('/api/v2/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user?.id, ...body }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(displayName(data.error) || 'REQUEST FAILED')
    return data
  }

  const handleClaim = async (reward: Reward) => {
    setBusy(reward.id)
    try {
      await post({ action: 'claim_reward', rewardId: reward.id })
      toast({ title: 'REWARD CLAIMED', status: 'success', duration: 2000 })
      await Promise.all([loadAll(), refreshBalance()])
    } catch (e: any) {
      toast({ title: 'CLAIM FAILED', description: e.message, status: 'error', duration: 3000 })
    } finally { setBusy(null) }
  }

  const rewardLabel = (r: Reward) => {
    if (r.label) return displayName(r.label)
    if (r.reward_type === 'wngs') return `${r.wngs_amount || 0} WNGS`
    if (r.product_id && productMap[r.product_id]) return displayName(productMap[r.product_id].name)
    return r.reward_type.toUpperCase()
  }

  if (loading) {
    return <AscensionSkeleton />
  }

  if (!season) {
    return (
      <Center h="100vh" bg="black" flexDirection="column" p={6}>
        <Heading color="white" fontFamily="heading" fontStyle="italic">ASCENSION</Heading>
        <Text color="whiteAlpha.600" fontFamily="mono" fontSize="xs" mt={4}>[ NO ACTIVE SEASON ]</Text>
      </Center>
    )
  }

  const isAuthed = !!user?.id
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

  // A single reward on a rung (free or premium) as a large feed-style card:
  // a tall preview pane up top (like a MONARCH_TIMES post image) with the
  // CLAIM button overlaid on the item when claimable, and the label strip
  // below. Grayscale while locked, full color + accent glow when claimable,
  // CLAIMED ribbon once collected.
  const RewardTile = ({ r }: { r: Reward }) => {
    const reached = level >= r.level
    const premiumLocked = r.track === 'premium' && !isPremium
    const isClaimed = claimed.has(r.id)
    const locked = !reached || premiumLocked
    const canClaim = isAuthed && !locked && !isClaimed
    const prod = r.product_id ? productMap[r.product_id] : null
    const preview = prod && r.reward_type === 'avatar'
      ? <DeStijlAvatar seed={prod.id} size={104} colors={Array.isArray(prod.palette) ? prod.palette : undefined} />
      : prod && r.reward_type === 'theme'
        ? <ThemeSwatch accent={prod.accent_color} mode={prod.theme_mode} size={104} />
        : r.reward_type === 'wngs'
          ? <Box w="120px" h="120px"><WngsCoin isStatic /></Box>
          : <Icon as={MdMilitaryTech} boxSize="64px" color={accent} />
    return (
      <Box
        position="relative"
        border="2px solid"
        borderColor={canClaim ? accent : isClaimed ? 'whiteAlpha.500' : 'whiteAlpha.200'}
        bg="black"
        boxShadow={canClaim ? `0 0 14px -3px ${accent}` : 'none'}
        filter={locked && !isClaimed ? 'grayscale(1)' : 'none'}
        opacity={locked && !isClaimed ? 0.45 : isClaimed ? 0.85 : 1}
        transition="all 0.2s"
      >
        {/* Preview pane (the "item image") */}
        <Center
          position="relative" h="150px" bg="whiteAlpha.50"
          borderBottom="2px solid"
          borderColor={canClaim ? accent : 'whiteAlpha.200'}
        >
          {preview}

          {/* Status badge, top-right of the pane */}
          {isClaimed ? (
            <HStack position="absolute" top={2} right={2} bg={accent} px={2} py={0.5} spacing={1} zIndex={1}>
              <Icon as={MdCheck} color="black" boxSize="10px" />
              <Text fontSize="8px" fontWeight="900" color="black" fontFamily="mono">CLAIMED</Text>
            </HStack>
          ) : locked ? (
            <HStack position="absolute" top={2} right={2} border="1px solid" borderColor="whiteAlpha.500"
              bg="blackAlpha.600" px={2} py={0.5} spacing={1} zIndex={1}>
              <Icon as={MdLock} color="whiteAlpha.700" boxSize="10px" />
              <Text fontSize="8px" fontWeight="900" color="whiteAlpha.700" fontFamily="mono">
                {premiumLocked ? 'PREMIUM' : `LVL ${r.level}`}
              </Text>
            </HStack>
          ) : null}

          {/* CLAIM overlaid on the item */}
          {canClaim && (
            <Center position="absolute" inset={0} bg="blackAlpha.500" zIndex={1}>
              <Button
                h="40px" px={10} borderRadius="0" bg={accent} color="black"
                fontFamily="mono" fontWeight="900" fontSize="12px" letterSpacing="0.15em"
                isLoading={busy === r.id} onClick={() => handleClaim(r)}
                _hover={{ bg: 'white', transform: 'scale(1.04)' }} transition="all 0.15s"
              >
                CLAIM
              </Button>
            </Center>
          )}
        </Center>

        {/* Label strip */}
        <Box p={3}>
          <Text fontSize="7px" fontWeight="900" fontFamily="mono" letterSpacing="0.15em"
            color={r.track === 'premium' ? accent : 'whiteAlpha.500'}>
            {r.track.toUpperCase()} TRACK · LVL {r.level}
          </Text>
          <Heading fontSize="md" fontWeight="900" color="white" fontFamily="mono" textTransform="uppercase" noOfLines={1} mt={0.5}>
            {rewardLabel(r)}
          </Heading>
        </Box>
      </Box>
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
            <Text fontSize="8px" fontWeight="900" color={accent} fontFamily="mono" letterSpacing="0.15em">
              ◀ YOU · LVL {lvl}
            </Text>
          </Flex>
        )}
        <HStack spacing={3} align="stretch" minH={hasReward ? '60px' : '30px'}>
          {/* spine + node */}
          <Box position="relative" w="32px" flexShrink={0}>
            <Box position="absolute" left="50%" top={0} bottom={0} w="2px" transform="translateX(-50%)"
              bg={reached ? accent : 'whiteAlpha.200'} />
            <Center position="absolute" left="50%" top="50%" transform="translate(-50%,-50%)" w="30px" h="22px"
              zIndex={1} border="2px solid" borderColor={isCurrent ? 'white' : reached ? accent : 'whiteAlpha.300'}
              bg={reached ? accent : 'black'}>
              <Text fontSize="10px" fontWeight="900" fontFamily="mono" color={reached ? 'black' : 'whiteAlpha.500'}>
                {lvl}
              </Text>
            </Center>
          </Box>
          {/* rewards */}
          <VStack spacing={1.5} align="stretch" flex={1} justify="center" py={hasReward ? 1.5 : 0}>
            {cell.free && <RewardTile r={cell.free} />}
            {cell.premium && <RewardTile r={cell.premium} />}
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
          <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="mono" letterSpacing="0.2em">
            SEASON {season.code || ''} {daysLeft} DAYS LEFT
          </Text>
          <Heading fontSize="5xl" fontWeight="900" fontStyle="italic" color="white" fontFamily="heading" lineHeight="1">
            ASCENSION
          </Heading>
          <Text fontSize="xs" fontWeight="900" color="whiteAlpha.700" fontFamily="mono" mt={1}>{displayName(season.title)}</Text>
          {!isAuthed && (
            <Box mt={3} border="1px solid" borderColor="var(--monarch-accent)" px={2} py={1} display="inline-block">
              <Text fontSize="8px" fontWeight="900" color="var(--monarch-accent)" fontFamily="mono" letterSpacing="0.12em">
                ◇ PREVIEW · CONNECT TO TRACK YOUR PROGRESS
              </Text>
            </Box>
          )}
        </Box>

        {/* Level + XP */}
        <Box px={8}>
          <Flex justify="space-between" align="end" mb={1}>
            <HStack spacing={2} align="end">
              <Heading fontSize="3xl" fontWeight="900" color="white" fontFamily="heading">LVL {level}</Heading>
              {isPremium && <Box bg="var(--monarch-accent)" px={2} py={0.5} mb={1}><Text fontSize="8px" fontWeight="900" color="black" fontFamily="mono">PREMIUM</Text></Box>}
            </HStack>
            <Text fontSize="9px" fontWeight="900" color="whiteAlpha.600" fontFamily="mono">
              {maxed ? 'MAX' : `${intoLevel} / ${season.xp_per_level} XP`}
            </Text>
          </Flex>
          <Box w="100%" h="10px" border="1px solid" borderColor="white" p="1px">
            <Box h="100%" bg="var(--monarch-accent)" w={`${pct}%`} transition="width 0.3s" />
          </Box>
          <Text fontSize="7px" fontWeight="900" color="whiteAlpha.500" fontFamily="mono" mt={1}>
            TOTAL XP: {xp} {season.level_count} LEVELS
          </Text>
        </Box>

        {/* Tier ladder */}
        <Box p={8}>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading fontSize="xs" fontWeight="900" color="white" fontFamily="heading">
              TIER LADDER
            </Heading>
            <Text fontSize="8px" fontWeight="900" color="whiteAlpha.600" fontFamily="mono" letterSpacing="0.1em">
              TIER {level} / {season.level_count}
            </Text>
          </Flex>

          {/* Summit cap */}
          <HStack spacing={3} mb={1}>
            <Center w="32px" flexShrink={0}>
              <Icon as={MdMilitaryTech} color={maxed ? accent : 'whiteAlpha.400'} boxSize="20px" />
            </Center>
            <Text fontSize="8px" fontWeight="900" fontFamily="mono" letterSpacing="0.15em"
              color={maxed ? accent : 'whiteAlpha.500'}>
              SUMMIT · TIER {season.level_count}{maxed ? ' REACHED' : ''}
            </Text>
          </HStack>

          {/* Rungs, summit (highest) down to base */}
          <MotionVStack
            spacing={0}
            align="stretch"
            variants={reduce ? undefined : ladderContainer}
            initial={reduce ? undefined : 'initial'}
            animate={reduce ? undefined : 'enter'}
          >
            {Array.from({ length: season.level_count }, (_, i) => season.level_count - i).map((lvl) => (
              <MotionBox key={lvl} variants={reduce ? undefined : rungItem}>
                <Rung lvl={lvl} />
              </MotionBox>
            ))}
          </MotionVStack>

          {/* Base — also where a brand-new (level 0) climber starts */}
          {level === 0 && (
            <Flex align="center" gap={2} ml="40px" mt={1}>
              <Box flex={1} h="2px" bg={accent} />
              <Text fontSize="8px" fontWeight="900" color={accent} fontFamily="mono" letterSpacing="0.15em">
                ◀ YOU · START
              </Text>
            </Flex>
          )}
          <HStack spacing={3} mt={1}>
            <Center w="32px" flexShrink={0}><Box w="10px" h="2px" bg="whiteAlpha.400" /></Center>
            <Text fontSize="7px" fontWeight="900" color="whiteAlpha.400" fontFamily="mono" letterSpacing="0.15em">
              BASE · TIER 01
            </Text>
          </HStack>

          {rewards.length === 0 && (
            <Text fontSize="9px" fontWeight="900" color="whiteAlpha.500" fontFamily="mono" mt={4}>
              [ TIERS LIVE · REWARDS BEING CONFIGURED ]
            </Text>
          )}
        </Box>
      </Container>
    </Box>
  )
}

export default Ascension
