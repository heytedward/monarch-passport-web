import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Input,
  Button,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  FormControl,
  FormLabel,
  Select,
  useColorModeValue,
  Center,
  useToast,
  HStack,
  Divider,
  Code,
  IconButton,
  Switch,
} from '@chakra-ui/react';
import { MdContentCopy, MdRefresh } from 'react-icons/md';
import { usePrivy } from '@privy-io/react-auth';
import DeStijlAvatar from '../components/DeStijlAvatar';
import { rollPalette, RARITIES, priceForRarity } from '../lib/destijlPalette';
import { supabase } from '../lib/supabase';

const ADMIN_WALLETS = (import.meta.env.VITE_ADMIN_PRIVY_ID || "did:privy:cmjufzcf403jjl70dpyp1mood")
  .split(",")
  .map((w: string) => w.trim())
  .filter(Boolean);

const CommandCenter: React.FC = () => {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const toast = useToast();

  const [claimId, setClaimId] = useState('');
  const [wngsValue, setWngsValue] = useState('');
  const [itemType, setItemType] = useState('CLOTHING');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [mintPrefix, setMintPrefix] = useState('');
  const [mintStartNum, setMintStartNum] = useState('');
  const [mintCount, setMintCount] = useState('');
  const [mintTier, setMintTier] = useState('');
  const [mintProduct, setMintProduct] = useState('');
  const [mintCollection, setMintCollection] = useState('');
  const [mintSeason, setMintSeason] = useState('');
  const [mintIsSeasonArtifact, setMintIsSeasonArtifact] = useState(false);
  const [mintedUrls, setMintedUrls] = useState<string[]>([]);
  const [isMinting, setIsMinting] = useState(false);

  // --- Digital Store Forge: theme generator ---
  const [themeName, setThemeName] = useState('');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [themeAccent, setThemeAccent] = useState('#FFB000');
  const [themeRarity, setThemeRarity] = useState<string>('COMMON');
  const [themePriceOverride, setThemePriceOverride] = useState('');
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);

  // --- Digital Store Forge: avatar generator ---
  const [avatarName, setAvatarName] = useState('');
  const [avatarPalette, setAvatarPalette] = useState<string[]>(() => rollPalette());
  const [avatarShape, setAvatarShape] = useState<'square' | 'circle'>('square');
  const [avatarRarity, setAvatarRarity] = useState<string>('COMMON');
  const [avatarPriceOverride, setAvatarPriceOverride] = useState('');
  const [avatarCollection, setAvatarCollection] = useState('');
  const [avatarSeason, setAvatarSeason] = useState('');
  const [avatarEdition, setAvatarEdition] = useState('');
  const [isCreatingAvatar, setIsCreatingAvatar] = useState(false);

  // --- ASCENSION season control ---
  const [seasons, setSeasons] = useState<any[]>([]);
  const [adminProducts, setAdminProducts] = useState<any[]>([]);
  const [seasonName, setSeasonName] = useState('');
  const [seasonCode, setSeasonCode] = useState('');
  const [seasonLevels, setSeasonLevels] = useState('30');
  const [seasonXp, setSeasonXp] = useState('100');
  const [seasonStart, setSeasonStart] = useState('');
  const [isSeasonBusy, setIsSeasonBusy] = useState(false);
  // reward editor
  const [rwSeasonId, setRwSeasonId] = useState('');
  const [rwLevel, setRwLevel] = useState('');
  const [rwTrack, setRwTrack] = useState<'free' | 'premium'>('free');
  const [rwType, setRwType] = useState<'avatar' | 'theme' | 'wngs' | 'physical'>('avatar');
  const [rwProductId, setRwProductId] = useState('');
  const [rwWngs, setRwWngs] = useState('');
  const [rwLabel, setRwLabel] = useState('');
  const [isAddingReward, setIsAddingReward] = useState(false);

  const [systemLogs, setSystemLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] SECURE_CONNECTION_ESTABLISHED`,
    `[${new Date().toLocaleTimeString()}] SYNCING_ECONOMY_DATA...`,
    `[${new Date().toLocaleTimeString()}] SYSTEM_READY_FOR_COMMANDS`
  ]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [...prev.slice(-4), `[${timestamp}] ${message}`]);
  };

  const userId = user?.id?.toLowerCase();
  const userWallet = user?.wallet?.address?.toLowerCase();
  
  const isAuthorized = authenticated && (
    (userId && ADMIN_WALLETS.map(w => w.toLowerCase()).includes(userId)) ||
    (userWallet && ADMIN_WALLETS.map(w => w.toLowerCase()).includes(userWallet))
  );

  const bgColor = useColorModeValue('gray.50', 'black');
  const cardBg = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.300');
  const labelText = useColorModeValue('black', 'white');
  const monarchYellow = '#FFB000';
  const destructiveRed = '#E53E3E';

  if (!ready) {
    return (
      <Center h="100vh" bg="black">
        <Text color={monarchYellow} fontFamily="monospace">INITIALIZING_SECURE_UPLINK...</Text>
      </Center>
    );
  }

  if (!isAuthorized) {
    return (
      <Center h="100vh" bg="black" p={6}>
        <VStack spacing={6} textAlign="center" border="4px solid red" p={12} bg="black">
          <Text
            color="red.500"
            fontSize="5xl"
            fontWeight="900"
            fontFamily="monospace"
            lineHeight="1"
          >
            ACCESS DENIED
          </Text>
          <Divider borderColor="red.500" borderBottomWidth="2px" />
          <Text
            color="red.500"
            fontSize="2xl"
            fontWeight="700"
            fontFamily="monospace"
            letterSpacing="widest"
          >
            LEVEL 5 CLEARANCE REQUIRED
          </Text>
          <Text color="gray.500" fontSize="xs" fontFamily="monospace">
            UNAUTHORIZED ACCESS ATTEMPT LOGGED // ID: {user?.id || 'ANONYMOUS'}
          </Text>
        </VStack>
      </Center>
    );
  }

  const generateClaimLink = async () => {
    if (!claimId || !wngsValue) {
      toast({
        title: "MISSING_DATA",
        description: "CLAIM_ID AND WNGS_VALUE ARE REQUIRED",
        status: "error",
      });
      return;
    }

    const safeShortCode = claimId.trim().replace(/\s+/g, '-').toLowerCase();
    setIsGenerating(true);
    addLog(`INITIATING_DATABASE_INSERT // ID: ${safeShortCode}`);

    try {
      const token = await getAccessToken();

      const response = await fetch('/api/v2/admin/create-claim-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shortCode: safeShortCode,
          wngsAward: parseInt(wngsValue),
          itemName: claimId, // Original unformatted input
          itemType: itemType,
          adminId: user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'CLAIM_LINK_REQUEST_FAILED');
      }

      const link = `${window.location.origin}/claim/${safeShortCode}`;
      setGeneratedLink(link);
      addLog(`DATABASE_INSERT_SUCCESS // ID: ${safeShortCode}`);
      toast({
        title: "SUCCESS",
        description: "CLAIM LINK GENERATED AND STORED",
        status: "success",
      });
    } catch (err: any) {
      console.error(err);
      addLog(`DATABASE_INSERT_FAILED // ${err.message}`);
      toast({
        title: "ERROR",
        description: err.message,
        status: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    toast({
      title: "COPIED",
      description: "LINK COPIED TO CLIPBOARD",
      status: "info",
      duration: 2000,
    });
  };

  const resetGenerator = () => {
    setClaimId('');
    setWngsValue('');
    setItemType('CLOTHING');
    setGeneratedLink('');
    addLog("GENERATOR_STATE_RESET");
  };

  const generateArtifactBatch = async () => {
    if (!mintPrefix || !mintStartNum || !mintCount || !mintTier) {
      toast({
        title: "MISSING_DATA",
        description: "TAG_PREFIX, START_NUM, COUNT AND TIER ARE REQUIRED",
        status: "error",
      });
      return;
    }

    setIsMinting(true);
    addLog(`INITIATING_ARTIFACT_MINT // PREFIX: ${mintPrefix} // COUNT: ${mintCount}`);

    try {
      const token = await getAccessToken();

      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prefix: mintPrefix,
          startNum: parseInt(mintStartNum),
          count: parseInt(mintCount),
          tier: mintTier,
          product: mintProduct || undefined,
          collection: mintCollection || undefined,
          season: mintSeason || undefined,
          isSeasonArtifact: mintIsSeasonArtifact,
          adminId: user?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'MINT_REQUEST_FAILED');
      }

      setMintedUrls(data.urls);
      addLog(`MINT_SUCCESS // ${data.urls.length}_ARTIFACTS_GENERATED`);
      toast({
        title: "SUCCESS",
        description: "ARTIFACT BATCH MINTED",
        status: "success",
      });
    } catch (err: any) {
      console.error(err);
      addLog(`MINT_FAILED // ${err.message}`);
      toast({
        title: "ERROR",
        description: err.message,
        status: "error",
      });
    } finally {
      setIsMinting(false);
    }
  };

  const copyMintedUrls = () => {
    navigator.clipboard.writeText(mintedUrls.join('\n'));
    toast({
      title: "COPIED",
      description: "ALL URLS COPIED TO CLIPBOARD",
      status: "info",
      duration: 2000,
    });
  };

  const resetMintGenerator = () => {
    setMintPrefix('');
    setMintStartNum('');
    setMintCount('');
    setMintTier('');
    setMintProduct('');
    setMintCollection('');
    setMintSeason('');
    setMintIsSeasonArtifact(false);
    setMintedUrls([]);
    addLog("MINT_GENERATOR_STATE_RESET");
  };

  // Shared POST to the admin forge (dispatched by `kind` server-side).
  const createCosmetic = async (payload: Record<string, any>) => {
    const token = await getAccessToken();
    const response = await fetch('/api/v2/admin/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, adminId: user?.id }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'CREATE_FAILED');
    }
    return data.product;
  };

  const createTheme = async () => {
    if (!themeName || !themeAccent) {
      toast({ title: 'MISSING_DATA', description: 'THEME_NAME AND ACCENT ARE REQUIRED', status: 'error' });
      return;
    }
    setIsCreatingTheme(true);
    addLog(`FORGING_THEME // ${themeName}`);
    try {
      await createCosmetic({
        kind: 'theme',
        name: themeName,
        rarity: themeRarity,
        themeMode,
        accentColor: themeAccent,
        priceWngsOverride: themePriceOverride,
      });
      addLog(`THEME_DEPLOYED // ${themeName}`);
      toast({ title: 'THEME_DEPLOYED', description: `${themeName} IS LIVE IN THE STORE`, status: 'success' });
      setThemeName('');
      setThemePriceOverride('');
    } catch (err: any) {
      addLog(`THEME_FORGE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setIsCreatingTheme(false);
    }
  };

  const createAvatar = async () => {
    if (!avatarName || avatarPalette.length !== 9) {
      toast({ title: 'MISSING_DATA', description: 'AVATAR_NAME AND A 9-COLOR PALETTE ARE REQUIRED', status: 'error' });
      return;
    }
    setIsCreatingAvatar(true);
    addLog(`FORGING_AVATAR // ${avatarName}`);
    try {
      await createCosmetic({
        kind: 'avatar',
        name: avatarName,
        rarity: avatarRarity,
        palette: avatarPalette,
        priceWngsOverride: avatarPriceOverride,
        collection: avatarCollection,
        season: avatarSeason,
        edition: avatarEdition,
      });
      addLog(`AVATAR_DEPLOYED // ${avatarName}`);
      toast({ title: 'AVATAR_DEPLOYED', description: `${avatarName} IS LIVE IN THE STORE`, status: 'success' });
      setAvatarName('');
      setAvatarPriceOverride('');
      setAvatarPalette(rollPalette());
    } catch (err: any) {
      addLog(`AVATAR_FORGE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setIsCreatingAvatar(false);
    }
  };

  // --- ASCENSION season control ---
  const fetchSeasons = async () => {
    const { data } = await supabase.from('seasons').select('*').order('starts_at', { ascending: false });
    setSeasons(data || []);
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchSeasons();
    supabase.from('products').select('id, name, category')
      .in('category', ['AVATAR', 'THEME'])
      .then(({ data }) => setAdminProducts(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  const seasonForge = async (payload: Record<string, any>) => {
    const token = await getAccessToken();
    const res = await fetch('/api/v2/admin/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, adminId: user?.id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'SEASON_OP_FAILED');
    return data;
  };

  const createSeason = async () => {
    if (!seasonName) { toast({ title: 'MISSING_DATA', description: 'SEASON_NAME REQUIRED', status: 'error' }); return; }
    setIsSeasonBusy(true);
    addLog(`CREATING_SEASON // ${seasonName}`);
    try {
      await seasonForge({
        kind: 'season_create', name: seasonName, code: seasonCode,
        levelCount: seasonLevels, xpPerLevel: seasonXp,
        startsAt: seasonStart || undefined,
      });
      toast({ title: 'SEASON_CREATED', description: `${seasonName} (inactive — activate it below)`, status: 'success' });
      setSeasonName(''); setSeasonCode(''); setSeasonStart('');
      await fetchSeasons();
    } catch (err: any) {
      addLog(`SEASON_CREATE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally { setIsSeasonBusy(false); }
  };

  const activateSeason = async (id: string) => {
    try { await seasonForge({ kind: 'season_activate', seasonId: id }); addLog('SEASON_ACTIVATED'); await fetchSeasons(); }
    catch (err: any) { toast({ title: 'ERROR', description: err.message, status: 'error' }); }
  };
  const endSeason = async (id: string) => {
    try { await seasonForge({ kind: 'season_end', seasonId: id }); addLog('SEASON_ENDED'); await fetchSeasons(); }
    catch (err: any) { toast({ title: 'ERROR', description: err.message, status: 'error' }); }
  };

  const addReward = async () => {
    if (!rwSeasonId || rwLevel === '') { toast({ title: 'MISSING_DATA', description: 'SEASON AND LEVEL REQUIRED', status: 'error' }); return; }
    setIsAddingReward(true);
    try {
      await seasonForge({
        kind: 'season_reward', seasonId: rwSeasonId, level: rwLevel, track: rwTrack, rewardType: rwType,
        productId: (rwType === 'avatar' || rwType === 'theme') ? rwProductId : undefined,
        wngsAmount: rwType === 'wngs' ? rwWngs : undefined,
        label: rwLabel || undefined,
      });
      toast({ title: 'REWARD_ADDED', description: `LVL ${rwLevel} ${rwTrack.toUpperCase()}`, status: 'success' });
      setRwLevel(''); setRwWngs(''); setRwLabel(''); setRwProductId('');
    } catch (err: any) {
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally { setIsAddingReward(false); }
  };

  return (
    <Box minH="100vh" bg={bgColor} p={8} fontFamily="monospace">
      <VStack align="stretch" spacing={8} maxW="1200px" mx="auto">
        {/* Header Section */}
        <VStack align="start" spacing={0} borderLeft={`4px solid ${monarchYellow}`} pl={4}>
          <Heading size="2xl" fontWeight="900" letterSpacing="-0.02em" textTransform="uppercase">
            Live Ops Command Center
          </Heading>
          <HStack spacing={4}>
            <Text color="gray.500" fontSize="sm">
              OPERATOR: {userWallet?.slice(0, 6)}...{userWallet?.slice(-4)}
            </Text>
            <Text color={monarchYellow} fontSize="sm" fontWeight="bold">
              [SYSTEM_STATUS: ACTIVE]
            </Text>
          </HStack>
        </VStack>

        <Divider borderColor={borderColor} />

        {/* ASCENSION Season Control Section */}
        <VStack align="stretch" spacing={6}>
          <Heading size="md" textTransform="uppercase" letterSpacing="0.1em">
            // ASCENSION Season Control
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            {/* Create season */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>CREATE SEASON</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={3}>
                  <FormControl isRequired>
                    <FormLabel fontSize="xs">SEASON_NAME</FormLabel>
                    <Input borderRadius="0" placeholder="SPRING 2026" fontSize="sm" value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
                  </FormControl>
                  <HStack spacing={2}>
                    <FormControl>
                      <FormLabel fontSize="xs">CODE</FormLabel>
                      <Input borderRadius="0" placeholder="SS26" fontSize="sm" value={seasonCode} onChange={(e) => setSeasonCode(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">START</FormLabel>
                      <Input type="date" borderRadius="0" fontSize="sm" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
                    </FormControl>
                  </HStack>
                  <HStack spacing={2}>
                    <FormControl>
                      <FormLabel fontSize="xs">LEVELS</FormLabel>
                      <Input type="number" borderRadius="0" fontSize="sm" value={seasonLevels} onChange={(e) => setSeasonLevels(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">XP / LEVEL</FormLabel>
                      <Input type="number" borderRadius="0" fontSize="sm" value={seasonXp} onChange={(e) => setSeasonXp(e.target.value)} />
                    </FormControl>
                  </HStack>
                  <Text fontSize="9px" color="gray.500">Ends 90 days after start unless you end it early.</Text>
                  <Button w="full" bg={monarchYellow} color="black" borderRadius="0" fontWeight="bold" _hover={{ opacity: 0.8 }} onClick={createSeason} isLoading={isSeasonBusy} loadingText="CREATING...">
                    CREATE
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            {/* Seasons list */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>SEASONS</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={2} align="stretch" maxH="260px" overflowY="auto">
                  {seasons.length === 0 && <Text fontSize="xs" color="gray.500">NO SEASONS YET.</Text>}
                  {seasons.map((s) => (
                    <Box key={s.id} border="1px solid" borderColor={s.is_active ? monarchYellow : borderColor} p={2}>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={0}>
                          <Text fontSize="xs" fontWeight="900" color={labelText}>{s.title}{s.is_active ? ' •' : ''}</Text>
                          <Text fontSize="8px" color="gray.500">{s.code || '—'} // {s.level_count}L × {s.xp_per_level}XP</Text>
                        </VStack>
                        <HStack spacing={1}>
                          {!s.is_active && (
                            <Button size="xs" h="22px" fontSize="8px" borderRadius="0" bg={monarchYellow} color="black" onClick={() => activateSeason(s.id)}>ACTIVATE</Button>
                          )}
                          {s.is_active && (
                            <Button size="xs" h="22px" fontSize="8px" borderRadius="0" bg={destructiveRed} color="white" onClick={() => endSeason(s.id)}>END</Button>
                          )}
                        </HStack>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              </CardBody>
            </Card>

            {/* Reward table editor */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>REWARD TABLE</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={3}>
                  <FormControl isRequired>
                    <FormLabel fontSize="xs">SEASON</FormLabel>
                    <Select borderRadius="0" fontSize="sm" placeholder="select" value={rwSeasonId} onChange={(e) => setRwSeasonId(e.target.value)}>
                      {seasons.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </Select>
                  </FormControl>
                  <HStack spacing={2}>
                    <FormControl isRequired>
                      <FormLabel fontSize="xs">LEVEL</FormLabel>
                      <Input type="number" borderRadius="0" fontSize="sm" placeholder="5" value={rwLevel} onChange={(e) => setRwLevel(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">TRACK</FormLabel>
                      <Select borderRadius="0" fontSize="sm" value={rwTrack} onChange={(e) => setRwTrack(e.target.value as any)}>
                        <option value="free">FREE</option>
                        <option value="premium">PREMIUM</option>
                      </Select>
                    </FormControl>
                  </HStack>
                  <FormControl>
                    <FormLabel fontSize="xs">TYPE</FormLabel>
                    <Select borderRadius="0" fontSize="sm" value={rwType} onChange={(e) => setRwType(e.target.value as any)}>
                      <option value="avatar">AVATAR</option>
                      <option value="theme">THEME</option>
                      <option value="wngs">WNGS</option>
                      <option value="physical">PHYSICAL</option>
                    </Select>
                  </FormControl>
                  {(rwType === 'avatar' || rwType === 'theme') && (
                    <FormControl>
                      <FormLabel fontSize="xs">PRODUCT</FormLabel>
                      <Select borderRadius="0" fontSize="sm" placeholder="select" value={rwProductId} onChange={(e) => setRwProductId(e.target.value)}>
                        {adminProducts.filter((p) => p.category === rwType.toUpperCase()).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </FormControl>
                  )}
                  {rwType === 'wngs' && (
                    <FormControl>
                      <FormLabel fontSize="xs">WNGS_AMOUNT</FormLabel>
                      <Input type="number" borderRadius="0" fontSize="sm" placeholder="500" value={rwWngs} onChange={(e) => setRwWngs(e.target.value)} />
                    </FormControl>
                  )}
                  <FormControl>
                    <FormLabel fontSize="xs">LABEL (optional)</FormLabel>
                    <Input borderRadius="0" fontSize="sm" placeholder="display name" value={rwLabel} onChange={(e) => setRwLabel(e.target.value)} />
                  </FormControl>
                  <Button w="full" bg={monarchYellow} color="black" borderRadius="0" fontWeight="bold" _hover={{ opacity: 0.8 }} onClick={addReward} isLoading={isAddingReward} loadingText="ADDING...">
                    ADD REWARD
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>
        </VStack>

        <Divider borderColor={borderColor} />

        {/* Artifact & Link Forge Section */}
        <VStack align="stretch" spacing={6}>
          <Heading size="md" textTransform="uppercase" letterSpacing="0.1em">
            // Artifact & Link Forge
          </Heading>

          <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
            <CardHeader pb={0}>
              <Heading size="sm" color={monarchYellow}>GENERATE CLAIM LINK</Heading>
            </CardHeader>
            <CardBody>
              {generatedLink ? (
                <VStack spacing={6} p={4} bg="blackAlpha.200" border="1px dashed" borderColor={monarchYellow}>
                  <Text color={monarchYellow} fontWeight="bold" fontSize="sm">LINK_GENERATED_SUCCESSFULLY</Text>
                  <HStack w="full" bg="black" p={4} border="1px solid" borderColor={monarchYellow} justify="space-between">
                    <Code colorScheme="yellow" bg="transparent" color={monarchYellow} fontSize="xs" wordBreak="break-all">
                      {generatedLink}
                    </Code>
                    <IconButton
                      aria-label="Copy"
                      icon={<MdContentCopy />}
                      size="sm"
                      bg={monarchYellow}
                      color="black"
                      onClick={copyToClipboard}
                    />
                  </HStack>
                  <Button
                    leftIcon={<MdRefresh />}
                    variant="outline"
                    borderColor={monarchYellow}
                    color={monarchYellow}
                    borderRadius="0"
                    size="sm"
                    onClick={resetGenerator}
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    GENERATE ANOTHER
                  </Button>
                </VStack>
              ) : (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    <VStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs">CLAIM_ID (SHORT_CODE)</FormLabel>
                        <Input 
                          borderRadius="0" 
                          placeholder="e.g. S01_GOLD_001" 
                          fontSize="sm" 
                          value={claimId}
                          onChange={(e) => setClaimId(e.target.value)}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">ITEM TYPE</FormLabel>
                        <Select 
                          borderRadius="0" 
                          fontSize="sm" 
                          variant="outline"
                          value={itemType}
                          onChange={(e) => setItemType(e.target.value)}
                        >
                          <option value="CLOTHING">CLOTHING</option>
                          <option value="THEME">THEME</option>
                          <option value="AVATAR">AVATAR</option>
                          <option value="EVENT_LINK">EVENT_LINK</option>
                        </Select>
                      </FormControl>
                    </VStack>
                    <VStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs">WNGS_VALUE</FormLabel>
                        <Input 
                          borderRadius="0" 
                          type="number" 
                          placeholder="500" 
                          fontSize="sm" 
                          value={wngsValue}
                          onChange={(e) => setWngsValue(e.target.value)}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">MAX TAPS (UNSUPPORTED)</FormLabel>
                        <Input borderRadius="0" type="number" placeholder="100" fontSize="sm" isDisabled />
                      </FormControl>
                    </VStack>
                  </SimpleGrid>
                  <Button
                    mt={6}
                    w="full"
                    bg={monarchYellow}
                    color="black"
                    borderRadius="0"
                    fontWeight="bold"
                    _hover={{ opacity: 0.8 }}
                    onClick={generateClaimLink}
                    isLoading={isGenerating}
                    loadingText="GENERATING..."
                  >
                    GENERATE SECURE LINK
                  </Button>
                </>
              )}
            </CardBody>
          </Card>

          <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
            <CardHeader pb={0}>
              <Heading size="sm" color={monarchYellow}>MINT ARTIFACT BATCH</Heading>
            </CardHeader>
            <CardBody>
              {mintedUrls.length > 0 ? (
                <VStack spacing={6} p={4} bg="blackAlpha.200" border="1px dashed" borderColor={monarchYellow}>
                  <Text color={monarchYellow} fontWeight="bold" fontSize="sm">
                    {mintedUrls.length}_ARTIFACTS_MINTED_SUCCESSFULLY
                  </Text>
                  <HStack w="full" bg="black" p={4} border="1px solid" borderColor={monarchYellow} justify="space-between" align="start">
                    <VStack align="start" spacing={1} maxH="240px" overflowY="auto" w="full">
                      {mintedUrls.map((url, idx) => (
                        <Code key={idx} colorScheme="yellow" bg="transparent" color={monarchYellow} fontSize="xs" wordBreak="break-all">
                          {url}
                        </Code>
                      ))}
                    </VStack>
                    <IconButton
                      aria-label="Copy all"
                      icon={<MdContentCopy />}
                      size="sm"
                      bg={monarchYellow}
                      color="black"
                      onClick={copyMintedUrls}
                    />
                  </HStack>
                  <Button
                    leftIcon={<MdRefresh />}
                    variant="outline"
                    borderColor={monarchYellow}
                    color={monarchYellow}
                    borderRadius="0"
                    size="sm"
                    onClick={resetMintGenerator}
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    GENERATE ANOTHER BATCH
                  </Button>
                </VStack>
              ) : (
                <>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    <VStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs">TAG_PREFIX</FormLabel>
                        <Input
                          borderRadius="0"
                          placeholder="e.g. S01-"
                          fontSize="sm"
                          value={mintPrefix}
                          onChange={(e) => setMintPrefix(e.target.value)}
                        />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs">START_NUM</FormLabel>
                        <Input
                          borderRadius="0"
                          type="number"
                          placeholder="1"
                          fontSize="sm"
                          value={mintStartNum}
                          onChange={(e) => setMintStartNum(e.target.value)}
                        />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs">COUNT</FormLabel>
                        <Input
                          borderRadius="0"
                          type="number"
                          placeholder="5"
                          fontSize="sm"
                          value={mintCount}
                          onChange={(e) => setMintCount(e.target.value)}
                        />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel fontSize="xs">TIER</FormLabel>
                        <Input
                          borderRadius="0"
                          placeholder="COMMON"
                          fontSize="sm"
                          value={mintTier}
                          onChange={(e) => setMintTier(e.target.value)}
                        />
                      </FormControl>
                    </VStack>
                    <VStack spacing={4}>
                      <FormControl>
                        <FormLabel fontSize="xs">PRODUCT</FormLabel>
                        <Input
                          borderRadius="0"
                          placeholder="Hoodie"
                          fontSize="sm"
                          value={mintProduct}
                          onChange={(e) => setMintProduct(e.target.value)}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">COLLECTION</FormLabel>
                        <Input
                          borderRadius="0"
                          placeholder="e.g. CORE"
                          fontSize="sm"
                          value={mintCollection}
                          onChange={(e) => setMintCollection(e.target.value)}
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs">SEASON</FormLabel>
                        <Input
                          borderRadius="0"
                          placeholder="e.g. S01"
                          fontSize="sm"
                          value={mintSeason}
                          onChange={(e) => setMintSeason(e.target.value)}
                        />
                      </FormControl>
                      <FormControl display="flex" alignItems="center" justifyContent="space-between">
                        <FormLabel fontSize="xs" mb={0}>IS_SEASON_ARTIFACT</FormLabel>
                        <Switch
                          colorScheme="yellow"
                          isChecked={mintIsSeasonArtifact}
                          onChange={(e) => setMintIsSeasonArtifact(e.target.checked)}
                        />
                      </FormControl>
                    </VStack>
                  </SimpleGrid>
                  <Button
                    mt={6}
                    w="full"
                    bg={monarchYellow}
                    color="black"
                    borderRadius="0"
                    fontWeight="bold"
                    _hover={{ opacity: 0.8 }}
                    onClick={generateArtifactBatch}
                    isLoading={isMinting}
                    loadingText="MINTING..."
                  >
                    MINT ARTIFACT BATCH
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </VStack>

        <Divider borderColor={borderColor} />

        {/* Digital Store Forge Section */}
        <VStack align="stretch" spacing={6}>
          <Heading size="md" textTransform="uppercase" letterSpacing="0.1em">
            // Digital Store Forge
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {/* THEME GENERATOR */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>FORGE THEME</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  {/* Live preview */}
                  <Center
                    h="80px"
                    bg={themeMode === 'light' ? 'white' : 'black'}
                    border="1px solid"
                    borderColor={borderColor}
                  >
                    <HStack spacing={3}>
                      <Box w="40px" h="40px" bg={themeAccent} border="2px solid" borderColor={themeMode === 'light' ? 'black' : 'white'} />
                      <Text fontSize="xs" fontWeight="900" color={themeAccent} fontFamily="monospace">
                        {themeName || 'THEME_PREVIEW'}
                      </Text>
                    </HStack>
                  </Center>

                  <FormControl isRequired>
                    <FormLabel fontSize="xs">THEME_NAME</FormLabel>
                    <Input borderRadius="0" placeholder="e.g. NEON_OVERRIDE" fontSize="sm" value={themeName} onChange={(e) => setThemeName(e.target.value)} />
                  </FormControl>

                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="xs">MODE</FormLabel>
                      <Select borderRadius="0" fontSize="sm" value={themeMode} onChange={(e) => setThemeMode(e.target.value as 'light' | 'dark')}>
                        <option value="dark">DARK</option>
                        <option value="light">LIGHT</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">ACCENT</FormLabel>
                      <Input borderRadius="0" type="color" p={1} h="40px" value={themeAccent} onChange={(e) => setThemeAccent(e.target.value)} />
                    </FormControl>
                  </HStack>

                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="xs">RARITY</FormLabel>
                      <Select borderRadius="0" fontSize="sm" value={themeRarity} onChange={(e) => setThemeRarity(e.target.value)}>
                        {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">PRICE_WNGS (AUTO: {priceForRarity(themeRarity)})</FormLabel>
                      <Input borderRadius="0" type="number" placeholder={String(priceForRarity(themeRarity))} fontSize="sm" value={themePriceOverride} onChange={(e) => setThemePriceOverride(e.target.value)} />
                    </FormControl>
                  </HStack>

                  <Button bg={monarchYellow} color="black" borderRadius="0" fontWeight="bold" _hover={{ opacity: 0.8 }} onClick={createTheme} isLoading={isCreatingTheme} loadingText="FORGING...">
                    FORGE THEME
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            {/* AVATAR GENERATOR */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>FORGE AVATAR</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} align="stretch">
                  {/* Live preview (blinking) */}
                  <Center h="140px" bg="black" border="1px solid" borderColor={borderColor}>
                    <DeStijlAvatar seed={avatarName || 'PREVIEW'} colors={avatarPalette} size={120} shape={avatarShape} />
                  </Center>

                  <HStack spacing={2}>
                    <Button flex={1} size="sm" variant="outline" borderRadius="0" borderColor={monarchYellow} color={monarchYellow} leftIcon={<MdRefresh />} onClick={() => setAvatarPalette(rollPalette())} _hover={{ bg: 'whiteAlpha.100' }}>
                      ROLL
                    </Button>
                    <Button flex={1} size="sm" variant="outline" borderRadius="0" borderColor={borderColor} color={labelText} onClick={() => setAvatarShape((s) => s === 'square' ? 'circle' : 'square')} _hover={{ bg: 'whiteAlpha.100' }}>
                      SHAPE: {avatarShape.toUpperCase()}
                    </Button>
                  </HStack>

                  {/* Editable 3x3 swatches */}
                  <SimpleGrid columns={3} spacing={1}>
                    {avatarPalette.map((c, i) => (
                      <Input
                        key={i}
                        type="color"
                        value={c}
                        p={0}
                        h="28px"
                        borderRadius="0"
                        onChange={(e) => setAvatarPalette((prev) => prev.map((pc, pi) => pi === i ? e.target.value : pc))}
                      />
                    ))}
                  </SimpleGrid>

                  <FormControl isRequired>
                    <FormLabel fontSize="xs">AVATAR_NAME</FormLabel>
                    <Input borderRadius="0" placeholder="e.g. GHOST_OPERATOR" fontSize="sm" value={avatarName} onChange={(e) => setAvatarName(e.target.value)} />
                  </FormControl>

                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel fontSize="xs">RARITY</FormLabel>
                      <Select borderRadius="0" fontSize="sm" value={avatarRarity} onChange={(e) => setAvatarRarity(e.target.value)}>
                        {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">PRICE_WNGS (AUTO: {priceForRarity(avatarRarity)})</FormLabel>
                      <Input borderRadius="0" type="number" placeholder={String(priceForRarity(avatarRarity))} fontSize="sm" value={avatarPriceOverride} onChange={(e) => setAvatarPriceOverride(e.target.value)} />
                    </FormControl>
                  </HStack>

                  <SimpleGrid columns={3} spacing={2}>
                    <FormControl>
                      <FormLabel fontSize="xs">COLLECTION</FormLabel>
                      <Input borderRadius="0" placeholder="S01_CORE" fontSize="sm" value={avatarCollection} onChange={(e) => setAvatarCollection(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">SEASON</FormLabel>
                      <Input borderRadius="0" placeholder="S01" fontSize="sm" value={avatarSeason} onChange={(e) => setAvatarSeason(e.target.value)} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="xs">EDITION</FormLabel>
                      <Input borderRadius="0" placeholder="STANDARD" fontSize="sm" value={avatarEdition} onChange={(e) => setAvatarEdition(e.target.value)} />
                    </FormControl>
                  </SimpleGrid>

                  <Button bg={monarchYellow} color="black" borderRadius="0" fontWeight="bold" _hover={{ opacity: 0.8 }} onClick={createAvatar} isLoading={isCreatingAvatar} loadingText="FORGING...">
                    FORGE AVATAR
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>
        </VStack>

        {/* Footer/System Logs Section */}
        <Box p={4} bg="black" border="1px solid" borderColor="whiteAlpha.200">
          {systemLogs.map((log, idx) => (
            <Text key={idx} color="green.400" fontSize="xs" mb={1}>{log}</Text>
          ))}
        </Box>
      </VStack>
    </Box>
  );
};

export default CommandCenter;
