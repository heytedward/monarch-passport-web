import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Button, 
  Flex,
  Icon,
  Center,
  SimpleGrid,
  Container,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  useDisclosure,
  IconButton,
  useColorModeValue,
  Spinner,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Input,
  Wrap,
  WrapItem,
  Link
} from '@chakra-ui/react'
import { useState, useEffect, useMemo } from 'react'
import { MdRefresh, MdClose, MdSearch } from 'react-icons/md'
import { PiShoppingBagFill } from 'react-icons/pi'
import { motion } from 'framer-motion'
import { usePrivy } from '@privy-io/react-auth'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import DeStijlAvatar from '../components/DeStijlAvatar'
import ThemeSwatch from '../components/ThemeSwatch'

const MotionBox = motion.create(Box)

// On-chain avatar minting is PARKED — cosmetics stay Web2 (a user_assets row +
// equip.js). The mint flow, funded devnet keypair, and tracking columns remain
// in the codebase; flip this to true to re-expose the Closet mint surface when
// the official Web3 drop ships. See project_phase3_onchain_avatars memory.
const SHOW_ONCHAIN_MINT = false

const DigitalGarmentCard = ({ garment, border, cardBg, text, mutedText }: { garment: any, border: string, cardBg: string, text: string, mutedText: string }) => {
  const percentage = Math.min(100, Math.max(0, (garment.quests_completed / garment.total_quests_required) * 100));
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'burned_physical_shipped': return '#FF3333';
      case 'unlocked_ready_to_burn': return '#00FF66';
      case 'questing': return '#FFB000';
      case 'digital_locked':
      default:
        return 'gray.500';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  const truncateSolana = (addr?: string) => {
    if (!addr) return "UNMINTED";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <Box 
      border="1px solid" 
      borderColor={text} 
      p={4} 
      bg={cardBg} 
      position="relative"
      transition="transform 0.2s"
      _hover={{ transform: 'scale(1.02)', borderColor: "var(--monarch-accent)" }}
    >
      <Flex justify="space-between" align="center" mb={3}>
        <HStack spacing={1.5}>
          <Box w="6px" h="6px" borderRadius="full" bg={getStatusColor(garment.status)} />
          <Text fontSize="8px" fontWeight="900" fontFamily="monospace" color={text}>
            {getStatusLabel(garment.status)}
          </Text>
        </HStack>
        <Text fontSize="7px" fontWeight="900" fontFamily="monospace" color={mutedText}>
          {truncateSolana(garment.mint_address)}
        </Text>
      </Flex>

      <Center h="120px" bg="black" border="1px solid" borderColor={border} mb={3} overflow="hidden" position="relative">
        {garment.image_url ? (
          <img src={garment.image_url} alt={garment.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <VStack spacing={1}>
            <TShirtIcon color="white" boxSize="50px" />
            <Text fontSize="6px" fontWeight="900" color="whiteAlpha.600" fontFamily="monospace">NO_IMAGE_ASSET</Text>
          </VStack>
        )}
      </Center>

      <VStack align="stretch" spacing={2}>
        <Box>
          <Heading fontSize="xs" fontWeight="900" fontFamily="'Archivo Black', sans-serif" color={text} isTruncated>
            {garment.name.toUpperCase()}
          </Heading>
          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mt={0.5}>
            SKU: {garment.sku}
          </Text>
        </Box>

        <Box pt={1}>
          <Flex justify="space-between" align="center" mb={1}>
            <Text fontSize="7px" fontWeight="900" color={mutedText} fontFamily="monospace">QUEST_PROGRESS</Text>
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">
              {garment.quests_completed}/{garment.total_quests_required}
            </Text>
          </Flex>
          <Box w="100%" h="6px" border="1px solid" borderColor={text} bg="transparent" p="1px">
            <Box h="100%" bg="var(--monarch-accent)" w={`${percentage}%`} transition="width 0.3s" />
          </Box>
        </Box>
      </VStack>
    </Box>
  );
};


const TShirtIcon = ({ color = "white", boxSize = "40px" }: { color?: string, boxSize?: string }) => (
  <Box position="relative" w={boxSize} h={boxSize}>
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  </Box>
)

interface ClosetItemData {
  id: string;
  type: 'physical' | 'digital' | 'theme';
  name: string;
  borderColor?: string;
  locked?: boolean;
  palette?: string[];
  themeMode?: 'light' | 'dark';
  themeAccent?: string;
  rarity?: string;
  season?: string;
  collection?: string;
  edition?: string;
  assetId?: string;        // user_assets.id (the owned instance, for minting)
  mintAddress?: string;    // set once minted on-chain
  mintStatus?: string;
  dossier: {
    collection: string;
    releaseDate: string;
    serialId: string;
    xpPerTap: string;
    composition: string;
    activeMissions: string[];
  };
}

const ClosetSlot = ({ index, item, onOpen, text, border, bg }: { index: string, item?: ClosetItemData, onOpen: (item: ClosetItemData) => void, text: string, border: string, bg: string }) => {
  if (item) {
    return (
      <Box 
        border="1px solid" 
        borderColor={item.borderColor || border}
        h="140px" 
        position="relative" 
        bg={bg}
        cursor="pointer"
        transition="all 0.2s"
        onClick={() => !item.locked && onOpen(item)}
        _hover={!item.locked ? { transform: 'scale(1.02)', borderColor: "var(--monarch-accent)" } : {}}
      >
        <Text position="absolute" top={1} left={1} fontSize="6px" color={text} opacity={0.4} fontFamily="monospace">{index}</Text>
        <Center h="full">
          {item.locked ? (
             <Box border="1px solid" borderColor={border} p={4} bg={bg} opacity={0.5}>
                <Icon as={PiShoppingBagFill} color={text} opacity={0.3} boxSize="30px" />
                <Text fontSize="5px" color={text} opacity={0.3} mt={1} textAlign="center" fontWeight="900">LOCKED</Text>
             </Box>
          ) : (
            item.type === 'theme' ? (
               <ThemeSwatch accent={item.themeAccent} mode={item.themeMode} size={60} />
            ) : item.type === 'physical' ? (
              <TShirtIcon color={text} />
            ) : (
              <DeStijlAvatar seed={item.id} colors={item.palette} size={60} />
            )
          )}
        </Center>
        {item.borderColor && <Box position="absolute" bottom={0} left={0} right={0} h="15px" bg={item.borderColor} opacity={0.3} />}
      </Box>
    )
  }

  return (
    <Box 
      border="1px dashed" 
      borderColor={border} 
      h="140px" 
      position="relative"
    >
      <Text position="absolute" top={1} left={1} fontSize="6px" color={text} opacity={0.4} fontFamily="monospace">{index}</Text>
      <Center h="full">
        <Box w="2px" h="2px" bg={text} opacity={0.3} borderRadius="full" />
      </Center>
    </Box>
  )
}

const Closet = () => {
  const [mode, setMode] = useState<'physical' | 'digital'>('physical');
  const { setActiveTheme, setActiveAvatar, setActiveAvatarColors, setActiveThemeAccent, activeTheme, activeAvatar, activeThemeAccent } = useStore();
  const toast = useToast();
  
  const bg = useColorModeValue("white", "black");
  const cardBg = useColorModeValue("gray.50", "gray.900");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.300");
  const inverseText = useColorModeValue("white", "black");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedItem, setSelectedItem] = useState<ClosetItemData | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const { user, getAccessToken } = usePrivy();
  const [ownedAssets, setOwnedAssets] = useState<ClosetItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [digitalGarments, setDigitalGarments] = useState<any[]>([]);
  const [isGarmentsLoading, setIsGarmentsLoading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [seasonCollection, setSeasonCollection] = useState<{ season: any; total: number; owned: number; items: any[] } | null>(null);

  // The user's embedded Solana wallet (mint recipient).
  const solanaWallet =
    (user as any)?.linkedAccounts?.find((a: any) => a.type === 'wallet' && a.chainType === 'solana') ||
    (user as any)?.wallets?.find((w: any) => w.chainType === 'solana');
  const solanaAddress = (solanaWallet as any)?.address as string | undefined;

  // VAULT search/filter state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GEAR' | 'THEMES' | 'AVATARS'>('ALL');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [rarityFilter, setRarityFilter] = useState<string>('ALL');

  const brandAccent = activeThemeAccent || (activeTheme === 'CRIMSON_OVERRIDE' ? '#DC143C' : '#FFB000');

  const handleEquip = async () => {
    if (!selectedItem || !user?.id) return;

    try {
      const isTheme = selectedItem.type === 'theme';
      const accessToken = await getAccessToken();

      const response = await fetch('/api/v2/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: user.id,
          itemId: selectedItem.id,
          itemType: isTheme ? 'theme' : 'avatar',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'EQUIP_REQUEST_FAILED');
      }

      // Immediate local sync
      if (isTheme) {
        setActiveTheme(selectedItem.id);
        // Themes only drive the accent (--monarch-accent). Dark/light is a
        // separate global preference, not bundled into theme equip.
        setActiveThemeAccent(selectedItem.themeAccent || null);
      } else {
        setActiveAvatar(selectedItem.id);
        setActiveAvatarColors(selectedItem.palette || null); // reflect immediately
      }

      toast({
        title: `PROTOCOL_EQUIPPED: ${selectedItem.name.toUpperCase()}`,
        status: 'success',
        duration: 2000
      });
      onClose();
    } catch (err) {
      console.error("Equip Failed:", err);
      toast({ title: 'EQUIP_FAILED', status: 'error', duration: 2000 });
    }
  };

  const handleMint = async () => {
    if (!selectedItem?.assetId || !user?.id) return;
    if (!solanaAddress) {
      toast({ title: 'NO_SOLANA_WALLET', description: 'NO EMBEDDED SOLANA WALLET FOUND.', status: 'error', duration: 3000 });
      return;
    }
    setIsMinting(true);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: user.id, action: 'mint_avatar', assetId: selectedItem.assetId, recipient: solanaAddress }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'MINT_FAILED');

      // Reflect minted state locally.
      setOwnedAssets((prev) => prev.map((a) => a.assetId === selectedItem.assetId ? { ...a, mintAddress: data.mintAddress, mintStatus: 'minted' } : a));
      setSelectedItem((prev) => prev ? { ...prev, mintAddress: data.mintAddress, mintStatus: 'minted' } : prev);
      toast({ title: 'MINTED_ON_CHAIN', description: `${selectedItem.name} IS NOW AN NFT.`, status: 'success', duration: 4000 });
    } catch (err: any) {
      console.error('Mint Failed:', err);
      toast({ title: 'MINT_FAILED', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setIsMinting(false);
    }
  };

  useEffect(() => {
    const fetchOwnedAssets = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        // Owned cosmetics come from a service-role endpoint (Supabase can't
        // validate the Privy token for a direct RLS read).
        const token = await getAccessToken();
        const res = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'get_owned' }),
        });
        const payload = await res.json().catch(() => null);
        const data = payload?.assets || [];

        // Default assets (Light/Dark/Crimson themes)
        const defaults: ClosetItemData[] = [
          {
            id: 'SYSTEM_LIGHT',
            type: 'theme',
            name: 'SYSTEM_LIGHT',
            themeMode: 'light',
            themeAccent: '#FFB000',
            borderColor: activeTheme === 'SYSTEM_LIGHT' ? brandAccent : border,
            dossier: {
              collection: 'SYSTEM_PROTOCOLS',
              releaseDate: '2024-01-01',
              serialId: 'THM-L-001',
              xpPerTap: '0',
              composition: 'HIGH_CONTRAST',
              activeMissions: ['Sync interface to Solar Day']
            }
          },
          {
            id: 'SYSTEM_DARK',
            type: 'theme',
            name: 'SYSTEM_DARK',
            themeMode: 'dark',
            themeAccent: '#FFB000',
            borderColor: (activeTheme === 'SYSTEM_DARK' || !activeTheme) ? brandAccent : border,
            dossier: {
              collection: 'SYSTEM_PROTOCOLS',
              releaseDate: '2024-01-01',
              serialId: 'THM-D-001',
              xpPerTap: '0',
              composition: 'LOW_LIGHT',
              activeMissions: ['Maintain stealth protocols']
            }
          },
          {
            id: 'CRIMSON_OVERRIDE',
            type: 'theme',
            name: 'CRIMSON_OVERRIDE',
            themeMode: 'dark',
            themeAccent: '#DC143C',
            borderColor: activeTheme === 'CRIMSON_OVERRIDE' ? brandAccent : border,
            dossier: {
              collection: 'SYSTEM_PROTOCOLS',
              releaseDate: '2024-01-01',
              serialId: 'THM-C-001',
              xpPerTap: '0',
              composition: 'CRIMSON_EMISSION',
              activeMissions: ['Override default palette']
            }
          }
        ];

        if (data) {
          const mapped: ClosetItemData[] = data.map((asset: any) => {
            const p = asset.products;
            // Live `products` has no `type` column; category is the signal.
            // Singular live values are AVATAR / THEME (not the old plural forms).
            const itemType: ClosetItemData['type'] =
              p.category === 'THEME' ? 'theme' : p.category === 'AVATAR' ? 'digital' : 'physical';
            return {
              id: p.id,
              type: itemType,
              name: p.name.toUpperCase(),
              palette: p.palette || undefined,
              themeMode: p.theme_mode || undefined,
              themeAccent: p.accent_color || undefined,
              rarity: p.rarity || undefined,
              season: p.season || undefined,
              collection: p.collection || undefined,
              edition: p.edition || undefined,
              assetId: asset.id,
              mintAddress: asset.mint_address || undefined,
              mintStatus: asset.mint_status || undefined,
              borderColor: (activeTheme === p.id || activeAvatar === p.id) ? brandAccent : border,
              dossier: {
                collection: p.collection || p.category || 'GENERAL_RELEASE',
                releaseDate: new Date(p.created_at || Date.now()).toISOString().split('T')[0],
                serialId: `SN-${p.id.slice(0, 8).toUpperCase()}`,
                xpPerTap: '50',
                composition: `${itemType.toUpperCase()}_ASSET`,
                activeMissions: ['Verified in local vault']
              }
            };
          });
          // Claimed physical artifacts (NFC tap -> claim) live in the `artifacts`
          // table (owner_id), separate from user_assets cosmetics. Surface them
          // in the VAULT so tapped gear actually appears in the closet.
          let artifactItems: ClosetItemData[] = [];
          try {
            const aRes = await fetch('/api/v2/purchase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ userId: user.id, action: 'get_artifacts' }),
            });
            const aData = await aRes.json().catch(() => null);
            artifactItems = (aData?.artifacts || []).map((a: any): ClosetItemData => ({
              id: `artifact:${a.tag_id}`,
              type: 'physical',
              name: (a.name || a.tag_id).toUpperCase(),
              season: a.season || undefined,
              collection: a.collection || undefined,
              borderColor: border,
              dossier: {
                collection: a.collection || 'PHYGITAL_ARTIFACT',
                releaseDate: a.is_season_artifact ? `SEASON_${a.season || '—'}` : 'PHYGITAL',
                serialId: a.tag_id,
                xpPerTap: '40',
                composition: a.is_season_artifact ? 'SEASON_ARTIFACT' : 'PHYGITAL_ARTIFACT',
                activeMissions: a.is_season_artifact
                  ? ['Tap to earn // unlocks PREMIUM track']
                  : ['Tap to earn WNGS'],
              },
            }));
          } catch { /* artifacts are non-critical to the closet */ }
          setOwnedAssets([...defaults, ...mapped, ...artifactItems]);
        } else {
          setOwnedAssets(defaults);
        }
      } catch (err) {
        console.error("Registry Sync Failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOwnedAssets();
  }, [user, activeTheme, activeAvatar, brandAccent]);

  useEffect(() => {
    const fetchSeasonCollection = async () => {
      if (!user?.id) return;
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/v2/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ userId: user.id, action: 'get_season_artifacts' }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success) {
          setSeasonCollection({ season: data.season, total: data.total, owned: data.owned, items: data.items || [] });
        }
      } catch { /* non-critical */ }
    };
    fetchSeasonCollection();
  }, [user?.id]);

  useEffect(() => {
    const fetchDigitalGarments = async () => {
      console.log('--- DB FETCH INITIATED ---');
      console.log('Current Privy User ID:', user?.id);
      console.log('Full Privy User Object:', JSON.stringify(user, null, 2));
      if (!user?.id) {
        console.warn('--- ABORT: user.id is falsy, skipping fetch ---');
        return;
      }
      setIsGarmentsLoading(true);
      try {
        const token = await getAccessToken();
        console.log('Access Token exists:', !!token);
        console.log('Access Token (first 30 chars):', token ? token.substring(0, 30) + '...' : 'NULL');
        if (token) {
          const sessionResult = await supabase.auth.setSession({
            access_token: token,
            refresh_token: '',
          });
          console.log('setSession result:', JSON.stringify(sessionResult, null, 2));
        } else {
          console.warn('--- WARNING: No access token. RLS will likely block reads. ---');
        }

        // Also check what Supabase thinks the current user is
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Supabase active session user ID:', sessionData?.session?.user?.id ?? 'NO SESSION');

        const { data, error } = await supabase
          .from('digital_garments')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('Supabase Query Result:', { data, error });
        console.log('Rows returned:', data?.length ?? 0);

        if (error) throw error;
        setDigitalGarments(data || []);
      } catch (err) {
        console.error('Error fetching digital garments:', err);
      } finally {
        setIsGarmentsLoading(false);
      }
    };

    if (mode === 'digital') {
      fetchDigitalGarments();
    }
  }, [user?.id, mode]);

  // Map a vault item's type to the coarse TYPE filter buckets.
  const matchesType = (item: ClosetItemData) =>
    typeFilter === 'ALL' ||
    (typeFilter === 'GEAR' && item.type === 'physical') ||
    (typeFilter === 'THEMES' && item.type === 'theme') ||
    (typeFilter === 'AVATARS' && item.type === 'digital');

  // Distinct collection + rarity values present in the vault, for filter chips.
  const collectionOptions = useMemo(() => {
    const set = new Set<string>();
    ownedAssets.forEach((i) => { if (i.collection) set.add(i.collection); });
    return Array.from(set).sort();
  }, [ownedAssets]);

  const rarityOptions = useMemo(() => {
    const set = new Set<string>();
    ownedAssets.forEach((i) => { if (i.rarity) set.add(i.rarity); });
    return Array.from(set).sort();
  }, [ownedAssets]);

  const current_items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ownedAssets.filter((item) => {
      if (!matchesType(item)) return false;
      if (collectionFilter !== 'ALL' && item.collection !== collectionFilter) return false;
      if (rarityFilter !== 'ALL' && item.rarity !== rarityFilter) return false;
      if (q && !item.name.toLowerCase().includes(q) && !(item.collection || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ownedAssets, search, typeFilter, collectionFilter, rarityFilter]);

  const verifiedCount = mode === 'physical' ? current_items.length : digitalGarments.length;
  const isCurrentLoading = mode === 'physical' ? isLoading : isGarmentsLoading;

  const handleOpen = (item: ClosetItemData) => {
    setSelectedItem(item);
    setIsFlipped(false);
    onOpen();
  }

  return (
    <Box bg={bg} minH="100vh" pb="100px">
      <Container maxW="container.sm" p={0}>
        {/* Header */}
        <Box p={8} bg={bg}>
          <VStack align="start" spacing={2}>
            <Heading fontSize="5xl" fontWeight="900" fontStyle="italic" color={text} fontFamily="'Archivo Black', sans-serif">
              CLOSET
            </Heading>
            <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace" letterSpacing="0.1em">
              {isCurrentLoading ? 'SYNCING_REGISTRY...' : `ASSETS_VERIFIED // ${verifiedCount}`}
            </Text>
          </VStack>
          <Box h="12px" bg="var(--monarch-accent)" w="100%" mt={6} />
        </Box>

        {/* Tab Switcher */}
        <Box p={6}>
          <Flex 
            border="1px solid" 
            borderColor={text}
            borderRadius="full" 
            p="2px"
            bg={bg}
          >
            <Button 
              flex={1} 
              h="36px"
              borderRadius="full" 
              bg={mode === 'physical' ? "var(--monarch-accent)" : "transparent"}
              color={mode === 'physical' ? inverseText : text}
              fontSize="9px"
              fontWeight="900"
              onClick={() => setMode('physical')}
              leftIcon={<Box as="span" h="8px" w="8px" border="1px solid" borderColor={mode === 'physical' ? inverseText : text} borderRadius="full" bg={mode === 'physical' ? inverseText : "transparent"} />}
              _hover={{}}
            >
              VAULT
            </Button>
            <Button 
              flex={1} 
              h="36px"
              borderRadius="full" 
              bg={mode === 'digital' ? "var(--monarch-accent)" : "transparent"}
              color={mode === 'digital' ? inverseText : text}
              fontSize="9px"
              fontWeight="900"
              onClick={() => setMode('digital')}
              leftIcon={<Box as="span" h="8px" w="8px" border="1px solid" borderColor={mode === 'digital' ? inverseText : text} borderRadius="full" bg={mode === 'digital' ? inverseText : "transparent"} />}
              _hover={{}}
            >
              DIGITAL
            </Button>
          </Flex>

          {/* VAULT search + filters */}
          {mode === 'physical' && (
            <VStack align="stretch" spacing={3} mt={4}>
              <Flex
                align="center"
                border="1px solid"
                borderColor={border}
                bg={cardBg}
                px={3}
                h="36px"
              >
                <Icon as={MdSearch} color={mutedText} boxSize="16px" mr={2} />
                <Input
                  variant="unstyled"
                  placeholder="SEARCH_VAULT"
                  fontSize="10px"
                  fontWeight="900"
                  fontFamily="monospace"
                  color={text}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Flex>

              {/* TYPE chips */}
              <Wrap spacing={1}>
                {(['ALL', 'GEAR', 'THEMES', 'AVATARS'] as const).map((t) => (
                  <WrapItem key={t}>
                    <Button
                      size="xs"
                      h="24px"
                      borderRadius="0"
                      fontSize="8px"
                      fontWeight="900"
                      fontFamily="monospace"
                      bg={typeFilter === t ? "var(--monarch-accent)" : "transparent"}
                      color={typeFilter === t ? "black" : mutedText}
                      border="1px solid"
                      borderColor={typeFilter === t ? "var(--monarch-accent)" : border}
                      onClick={() => setTypeFilter(t)}
                      _hover={{ color: typeFilter === t ? "black" : text }}
                    >
                      {t}
                    </Button>
                  </WrapItem>
                ))}
              </Wrap>

              {/* COLLECTION + RARITY menus (only when there's something to filter) */}
              {(collectionOptions.length > 0 || rarityOptions.length > 0) && (
                <HStack spacing={2}>
                  {collectionOptions.length > 0 && (
                    <Menu>
                      <MenuButton
                        as={Button}
                        size="xs"
                        h="24px"
                        variant="outline"
                        borderRadius="0"
                        fontSize="8px"
                        fontWeight="900"
                        color={text}
                        borderColor={border}
                      >
                        COLLECTION: {collectionFilter}
                      </MenuButton>
                      <MenuList bg={bg} border={`1px solid ${text}`} borderRadius="0" minW="160px">
                        <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setCollectionFilter('ALL')}>ALL</MenuItem>
                        {collectionOptions.map((c) => (
                          <MenuItem key={c} bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setCollectionFilter(c)}>{c}</MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                  )}
                  {rarityOptions.length > 0 && (
                    <Menu>
                      <MenuButton
                        as={Button}
                        size="xs"
                        h="24px"
                        variant="outline"
                        borderRadius="0"
                        fontSize="8px"
                        fontWeight="900"
                        color={text}
                        borderColor={border}
                      >
                        RARITY: {rarityFilter}
                      </MenuButton>
                      <MenuList bg={bg} border={`1px solid ${text}`} borderRadius="0" minW="120px">
                        <MenuItem bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setRarityFilter('ALL')}>ALL</MenuItem>
                        {rarityOptions.map((r) => (
                          <MenuItem key={r} bg={bg} color={text} fontSize="9px" fontWeight="900" fontFamily="monospace" _hover={{ bg: cardBg }} onClick={() => setRarityFilter(r)}>{r}</MenuItem>
                        ))}
                      </MenuList>
                    </Menu>
                  )}
                </HStack>
              )}
            </VStack>
          )}
        </Box>

        {/* Info Bar */}
        <Box borderY="1px solid" borderColor={border} px={6} py={2}>
          <Flex justify="space-between" align="center">
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">PROTOCOL: {mode === 'physical' ? 'VAULT' : 'ON_CHAIN'}_STORAGE</Text>
            <Text fontSize="7px" fontWeight="900" color={text} fontFamily="monospace">VAULT_SYNC: {isCurrentLoading ? 'PENDING' : 'ONLINE'}</Text>
          </Flex>
        </Box>

        {/* Season Collection Tracker (VAULT mode only) */}
        {mode === 'physical' && seasonCollection && seasonCollection.total > 0 && (
          <Box px={6} pb={4}>
            <Box border="1px solid" borderColor={text} bg={bg}>
              {/* Header + progress bar */}
              <Box p={4} borderBottom="1px solid" borderColor={border}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace">
                    SEASON_{seasonCollection.season?.code || '01'}_COLLECTION
                  </Text>
                  <Text
                    fontSize="8px"
                    fontWeight="900"
                    color={seasonCollection.owned >= seasonCollection.total ? 'var(--monarch-accent)' : text}
                    fontFamily="monospace"
                  >
                    {seasonCollection.owned}/{seasonCollection.total}
                  </Text>
                </Flex>
                <Box w="100%" h="4px" border="1px solid" borderColor={text} bg="transparent" p="1px">
                  <Box
                    h="100%"
                    bg={seasonCollection.owned >= seasonCollection.total ? 'var(--monarch-accent)' : text}
                    w={`${Math.min(100, Math.round((seasonCollection.owned / seasonCollection.total) * 100))}%`}
                    transition="width 0.4s"
                  />
                </Box>
              </Box>

              {/* Per-item rows */}
              <VStack spacing={0} align="stretch" divider={<Box h="1px" bg={border} />}>
                {seasonCollection.items.map((item: any) => (
                  <Flex key={item.id} px={4} py={3} justify="space-between" align="center">
                    <HStack spacing={2}>
                      <Box
                        w="6px"
                        h="6px"
                        borderRadius="full"
                        bg={item.owned ? 'var(--monarch-accent)' : border}
                        flexShrink={0}
                      />
                      <Text
                        fontSize="9px"
                        fontWeight="900"
                        fontFamily="monospace"
                        color={item.owned ? text : mutedText}
                      >
                        {item.name.toUpperCase()}
                        {item.type === 'nfc' && (
                          <Text as="span" fontSize="7px" color={mutedText}> [NFC]</Text>
                        )}
                      </Text>
                    </HStack>
                    <Text
                      fontSize="7px"
                      fontWeight="900"
                      fontFamily="monospace"
                      color={item.owned ? 'var(--monarch-accent)' : mutedText}
                    >
                      {item.owned ? '✓' : '—'}
                    </Text>
                  </Flex>
                ))}
              </VStack>

              {seasonCollection.owned >= seasonCollection.total && (
                <Box borderTop="1px solid" borderColor={border} px={4} py={2}>
                  <Text fontSize="7px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace" textAlign="center" letterSpacing="0.1em">
                    ✓ COLLECTION_COMPLETE
                  </Text>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Grid Section */}
        <Box p={6}>
          {/* Grid Header */}
          <Box border="1px solid" borderColor={text} borderBottom="none" p={4} bg={bg}>
            <Flex justify="space-between" align="center">
              <VStack align="start" spacing={1}>
                <Heading fontSize="xs" fontWeight="900" color={text} fontFamily="'Archivo Black', sans-serif">
                  STORAGE_SLOTS // {isCurrentLoading ? "..." : verifiedCount}
                </Heading>
              </VStack>
            </Flex>
          </Box>

          {/* Asset Grid */}
          <Box border="1px solid" borderColor={text} p={4}>
            <Flex justify="space-between" mb={4} borderBottom="1px solid" borderColor={border} pb={1}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} fontFamily="monospace">SLOT_ID</Text>
              <Text fontSize="6px" fontWeight="900" color={mutedText} fontFamily="monospace">PROTOCOL_TAG</Text>
            </Flex>
            
            {mode === 'digital' ? (
              isGarmentsLoading ? (
                <Center h="200px">
                  <Spinner color="var(--monarch-accent)" />
                </Center>
              ) : digitalGarments.length > 0 ? (
                <SimpleGrid columns={2} spacing={4}>
                  {digitalGarments.map((garment) => (
                    <DigitalGarmentCard 
                      key={garment.id} 
                      garment={garment} 
                      border={border} 
                      cardBg={cardBg} 
                      text={text} 
                      mutedText={mutedText} 
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Center h="200px" flexDirection="column" border="1px dashed" borderColor={border} p={6}>
                  <TShirtIcon color={mutedText} boxSize="40px" />
                  <Text fontSize="xs" fontWeight="900" color={mutedText} mt={4} fontFamily="monospace" textAlign="center">
                    [ NO_DIGITAL_GARMENTS_DETECTED ]
                  </Text>
                  <Text fontSize="9px" color={mutedText} opacity={0.6} mt={2} fontFamily="monospace" textAlign="center">
                    ACQUIRE PHYGYTAL GEAR OR DIGITAL COSMETICS TO SYNC
                  </Text>
                </Center>
              )
            ) : isLoading ? (
              <Center h="200px">
                <Spinner color="var(--monarch-accent)" />
              </Center>
            ) : (
              <SimpleGrid columns={3} spacing={3}>
                {current_items.map((item, idx) => (
                  <ClosetSlot key={item.id} index={(idx + 1).toString().padStart(2, '0')} item={item} onOpen={handleOpen} text={text} border={border} bg={bg} />
                ))}
                
                {Array.from({ length: Math.max(0, 9 - current_items.length) }).map((_, idx) => (
                  <ClosetSlot key={`empty-${idx}`} index={(current_items.length + idx + 1).toString().padStart(2, '0')} onOpen={() => {}} text={text} border={border} bg={bg} />
                ))}
              </SimpleGrid>
            )}

            {/* Grid Footer Info */}
            <Flex justify="end" mt={4}>
              <Text fontSize="6px" fontWeight="900" color={mutedText} opacity={0.4} fontFamily="monospace">
                SYSTEM_STABILITY: 100% // {isCurrentLoading ? "LOADING..." : "LOAD_COMPLETE"}
              </Text>
            </Flex>
          </Box>
        </Box>
      </Container>

      {/* Flip Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
        <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none" border="none" maxW="340px">
          <ModalBody p={0}>
            {selectedItem && (
              <Box sx={{ perspective: '1000px' }} w="full" h="580px">
                <MotionBox
                  w="full"
                  h="full"
                  position="relative"
                  transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* FRONT */}
                  <Center
                    position="absolute"
                    inset={0}
                    bg={bg}
                    border="4px solid"
                    borderColor={selectedItem.borderColor || border}
                    style={{ backfaceVisibility: "hidden" }}
                    flexDirection="column"
                    p={8}
                    onClick={() => setIsFlipped(true)}
                    cursor="pointer"
                  >
                    <VStack spacing={8}>
                      <Box border={`2px solid ${text}`} p={10}>
                        {selectedItem.type === 'theme' ? (
                          <ThemeSwatch accent={selectedItem.themeAccent} mode={selectedItem.themeMode} size={120} />
                        ) : selectedItem.type === 'physical' ? (
                          <TShirtIcon color={text} boxSize="100px" />
                        ) : (
                          <DeStijlAvatar seed={selectedItem.id} colors={selectedItem.palette} size={120} />
                        )}
                      </Box>
                      <VStack spacing={2} textAlign="center">
                        <Text color={text} fontFamily="'Archivo Black', sans-serif" fontSize="xl" lineHeight="1">
                          {selectedItem.name}
                        </Text>
                        <Text fontSize="9px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">
                          {selectedItem.dossier.collection} // {selectedItem.dossier.composition}
                        </Text>
                        <Box pt={2}>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" border="1px solid" borderColor={border} px={2} py={0.5}>
                            SERIAL: {selectedItem.id.toUpperCase()}
                          </Text>
                        </Box>
                      </VStack>
                      <HStack color={mutedText}>
                        <Icon as={MdRefresh} />
                        <Text fontSize="9px" fontWeight="900">TAP TO VIEW SPECS</Text>
                      </HStack>
                    </VStack>
                  </Center>

                  {/* BACK (ARTIFACT_METADATA) */}
                  <Box
                    position="absolute"
                    inset={0}
                    bg={bg}
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    border={`4px solid ${text}`}
                    p={8}
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    textAlign="center"
                  >
                    <IconButton 
                      aria-label="Close" 
                      icon={<MdClose />} 
                      variant="ghost" 
                      color={mutedText} 
                      position="absolute"
                      top={2}
                      right={2}
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      _hover={{ color: text }}
                    />

                    <VStack spacing={10} w="full">
                      <VStack spacing={2}>
                        <Text color={text} fontFamily="'Archivo Black', sans-serif" fontSize="3xl" lineHeight="1.1">
                          {selectedItem.name}
                        </Text>
                        <Box h="2px" bg="var(--monarch-accent)" w="40px" />
                      </VStack>

                      <VStack spacing={4} w="full">
                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>COLLECTION</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.collection}</Text>
                        </Box>
                        
                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>TYPE</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.composition}</Text>
                        </Box>

                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>SERIAL_IDENTIFIER</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.serialId}</Text>
                        </Box>

                        <Box>
                          <Text fontSize="8px" fontWeight="900" color={mutedText} fontFamily="monospace" mb={1}>REGISTRY_DATE</Text>
                          <Text fontSize="sm" fontWeight="900" color={text} letterSpacing="0.05em">{selectedItem.dossier.releaseDate}</Text>
                        </Box>
                      </VStack>

                      {((selectedItem.id === activeTheme || selectedItem.id === activeAvatar) || (selectedItem.id === 'SYSTEM_DARK' && !activeTheme)) ? (
                        <Button 
                          w="full" 
                          h="50px" 
                          bg="gray.100" 
                          color="gray.400" 
                          borderRadius="0" 
                          fontSize="xs" 
                          fontWeight="900" 
                          disabled
                        >
                          [ EQUIPPED ]
                        </Button>
                      ) : (
                        (selectedItem.type === 'theme' || selectedItem.type === 'digital') && (
                          <Button 
                            w="full" 
                            h="50px" 
                            bg="var(--monarch-accent)" 
                            color="black" 
                            borderRadius="0" 
                            fontSize="xs" 
                            fontWeight="900" 
                            onClick={handleEquip}
                            _hover={{ bg: text, color: bg }}
                          >
                            EQUIP
                          </Button>
                        )
                      )}

                      {/* On-chain minting (avatars only) — PARKED behind SHOW_ONCHAIN_MINT */}
                      {SHOW_ONCHAIN_MINT && selectedItem.type === 'digital' && (
                        selectedItem.mintAddress ? (
                          <VStack spacing={0.5} w="full" pt={1}>
                            <Text fontSize="8px" fontWeight="900" color="var(--monarch-accent)" fontFamily="monospace">◆ ON-CHAIN</Text>
                            <Link
                              href={`https://explorer.solana.com/address/${selectedItem.mintAddress}?cluster=devnet`}
                              isExternal
                              onClick={(e) => e.stopPropagation()}
                              fontSize="8px"
                              color={mutedText}
                              fontFamily="monospace"
                              textDecoration="underline"
                            >
                              {selectedItem.mintAddress.slice(0, 4)}...{selectedItem.mintAddress.slice(-4)}
                            </Link>
                          </VStack>
                        ) : (
                          <Button
                            w="full"
                            h="40px"
                            variant="outline"
                            borderColor="var(--monarch-accent)"
                            color="var(--monarch-accent)"
                            borderRadius="0"
                            fontSize="10px"
                            fontWeight="900"
                            isLoading={isMinting}
                            loadingText="MINTING..."
                            isDisabled={!solanaAddress}
                            onClick={(e) => { e.stopPropagation(); handleMint(); }}
                            _hover={{ bg: 'var(--monarch-accent)', color: 'black' }}
                          >
                            {solanaAddress ? 'MINT TO CHAIN' : 'NO_SOLANA_WALLET'}
                          </Button>
                        )
                      )}
                    </VStack>

                    {/* Footer - Inside Metadata Box */}
                    <Box mt="auto" pt={4} w="full">
                      <Center cursor="pointer" onClick={() => setIsFlipped(false)}>
                        <HStack color={mutedText} spacing={1}>
                          <Icon as={MdRefresh} boxSize="10px" />
                          <Text fontSize="8px" fontWeight="900">TAP_TO_FLIP_BACK</Text>
                        </HStack>
                      </Center>
                    </Box>
                  </Box>
                </MotionBox>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}

export default Closet
