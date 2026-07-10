import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Image,
  Input,
  Button,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  FormControl,
  FormLabel,
  Select,
  Textarea,
  useColorModeValue,
  Center,
  useToast,
  HStack,
  Divider,
  Code,
  IconButton,
  Switch,
} from '@chakra-ui/react';
import { MdContentCopy, MdRefresh, MdClose } from 'react-icons/md';
import { usePrivy } from '@privy-io/react-auth';
import DeStijlAvatar from '../components/DeStijlAvatar';
import { rollPalette, RARITIES, priceForRarity } from '../lib/destijlPalette';
import { supabase } from '../lib/supabase';

// Entries may be full Privy DIDs, bare Privy IDs ("cmpho..."), or wallet
// addresses. Bare entries also match as their did:privy: form, so the env var
// works with or without the prefix.
const ADMIN_WALLETS = (import.meta.env.VITE_ADMIN_PRIVY_ID || "did:privy:cmphogmw500340ckz646kklaw,did:privy:cmjufzcf403jjl70dpyp1mood")
  .split(",")
  .map((w: string) => w.trim())
  .filter(Boolean)
  .flatMap((w: string) => (w.startsWith('did:privy:') ? [w] : [w, `did:privy:${w}`]));

const CommandCenter: React.FC = () => {
  const { user, authenticated, ready, getAccessToken } = usePrivy();
  const toast = useToast();

  const [claimId, setClaimId] = useState('');
  const [wngsValue, setWngsValue] = useState('');
  const [itemType, setItemType] = useState('CLOTHING');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // --- MONARCH_TIMES feed broadcast ---
  const [feedTitle, setFeedTitle] = useState('');
  const [feedContent, setFeedContent] = useState('');
  const [feedImageUrl, setFeedImageUrl] = useState('');
  const [feedImageData, setFeedImageData] = useState<string | null>(null);
  const [feedAuthor, setFeedAuthor] = useState('PAPILLON');
  const [isPosting, setIsPosting] = useState(false);
  const [feedPosts, setFeedPosts] = useState<any[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

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

  // --- Digital Store Forge: store inventory (retire/restore/re-release) ---
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<'ALL' | 'LIVE' | 'RETIRED'>('ALL');

  // --- Product Forge: physical garments (in-house Shopify replacement) ---
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategory, setProdCategory] = useState('HOODIE');
  const [prodDescription, setProdDescription] = useState('');
  const [prodCollection, setProdCollection] = useState('');
  const [prodSeason, setProdSeason] = useState('');
  const [prodSizes, setProdSizes] = useState<{ size: string; stock: string }[]>(
    ['S', 'M', 'L', 'XL'].map((s) => ({ size: s, stock: '' }))
  );
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);

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
    (userId && ADMIN_WALLETS.map((w: string) => w.toLowerCase()).includes(userId)) ||
    (userWallet && ADMIN_WALLETS.map((w: string) => w.toLowerCase()).includes(userWallet))
  );

  const bgColor = useColorModeValue('gray.50', 'black');
  const cardBg = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'whiteAlpha.300');
  const labelText = useColorModeValue('black', 'white');
  const monarchYellow = '#FFB000';
  const destructiveRed = '#E53E3E';

  // Load admin data once authorized. MUST run before the early returns below so
  // the hook count is identical on every render (Rules of Hooks). The seasons
  // query is inlined (rather than calling fetchSeasons()) because this effect
  // sits above that const's declaration -- referencing it here would be a
  // forward reference / TDZ ("cannot access before initialization"). The
  // fetchSeasons const remains defined below for the refresh callers.
  useEffect(() => {
    if (!isAuthorized) return;
    supabase.from('seasons').select('*').order('start_date', { ascending: false })
      .then(({ data }) => setSeasons(data || []));
    supabase.from('monarch_times')
      .select('id, title, author, status, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
      .then(({ data }) => setFeedPosts(data || []));
    // Inventory (incl. owner counts from user_assets) comes from the admin
    // endpoint -- RLS hides user_assets from the browser client. Inlined for
    // the same TDZ reason as the seasons query; fetchAdminProducts below is
    // the refresh caller.
    (async () => {
      try {
        const token = await getAccessToken();
        const response = await fetch('/api/v2/admin/mint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ kind: 'product_inventory', adminId: user?.id }),
        });
        const data = await response.json();
        if (response.ok && data.success) setAdminProducts(data.products || []);
      } catch { /* panel shows empty; refresh button retries */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

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

      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          kind: 'claim_link',
          shortCode: safeShortCode,
          wngsAward: parseInt(wngsValue),
          itemName: claimId, // Original unformatted input
          itemType: itemType,
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : undefined,
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
    setMaxRedemptions('');
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
      fetchAdminProducts();
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
      fetchAdminProducts();
    } catch (err: any) {
      addLog(`AVATAR_FORGE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setIsCreatingAvatar(false);
    }
  };

  // --- Digital Store Forge: store inventory ---
  const fetchAdminProducts = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'product_inventory', adminId: user?.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'INVENTORY_FETCH_FAILED');
      }
      setAdminProducts(data.products || []);
    } catch (err: any) {
      addLog(`INVENTORY_FETCH_FAILED // ${err.message}`);
    }
  };

  const toggleProductStatus = async (product: any) => {
    const nextActive = product.is_active === false; // retired -> restore, live -> retire
    setTogglingProductId(product.id);
    addLog(`${nextActive ? 'RESTORING' : 'RETIRING'}_PRODUCT // ${product.name}`);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'product_status', productId: product.id, isActive: nextActive, adminId: user?.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'STATUS_UPDATE_FAILED');
      }
      setAdminProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_active: nextActive } : p));
      toast({
        title: nextActive ? 'PRODUCT_RESTORED' : 'PRODUCT_RETIRED',
        description: `${product.name} IS ${nextActive ? 'BACK IN' : 'REMOVED FROM'} THE STORE`,
        status: 'success',
      });
    } catch (err: any) {
      addLog(`STATUS_UPDATE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setTogglingProductId(null);
    }
  };

  // --- Product Forge: physical garments ---
  // Same downscale treatment as feed images (max 1280px JPEG) so a multi-photo
  // product stays well under the function body limit.
  const downscaleToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('READ_FAILED'));
      reader.onload = () => {
        const img = new window.Image();
        img.onerror = () => reject(new Error('DECODE_FAILED'));
        img.onload = () => {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleProductImagesPick = async (files: FileList | null) => {
    if (!files || !files.length) return;
    try {
      const picked = await Promise.all(Array.from(files).slice(0, 6).map(downscaleToDataUrl));
      setProdImages((prev) => [...prev, ...picked].slice(0, 6));
    } catch {
      toast({ title: 'IMAGE_READ_FAILED', status: 'error' });
    }
  };

  const createProduct = async () => {
    const sizes = prodSizes
      .filter((s) => s.size.trim() && s.stock !== '')
      .map((s) => ({ size: s.size.trim().toUpperCase(), stock: parseInt(s.stock, 10) }));
    if (!prodName.trim() || !prodPrice || sizes.length === 0) {
      toast({ title: 'MISSING_DATA', description: 'NAME, PRICE_USD AND AT LEAST ONE SIZE/STOCK REQUIRED', status: 'error' });
      return;
    }
    setIsCreatingProduct(true);
    addLog(`FORGING_PRODUCT // ${prodName}`);
    try {
      await createCosmetic({
        kind: 'physical_product',
        name: prodName.trim(),
        priceUsd: parseFloat(prodPrice),
        category: prodCategory,
        description: prodDescription.trim() || undefined,
        collection: prodCollection.trim() || undefined,
        season: prodSeason.trim() || undefined,
        sizes,
        imagesData: prodImages,
      });
      addLog(`PRODUCT_DEPLOYED // ${prodName}`);
      toast({ title: 'PRODUCT_DEPLOYED', description: `${prodName.toUpperCase()} IS LIVE IN THE STORE`, status: 'success' });
      setProdName(''); setProdPrice(''); setProdDescription('');
      setProdCollection(''); setProdSeason('');
      setProdSizes(['S', 'M', 'L', 'XL'].map((s) => ({ size: s, stock: '' })));
      setProdImages([]);
      fetchAdminProducts();
    } catch (err: any) {
      addLog(`PRODUCT_FORGE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const restockProduct = async (product: any) => {
    const current = (product.sizes || []).map((s: any) => `${s.size}:${s.stock}`).join(', ');
    const input = window.prompt(
      `RESTOCK // ${product.name}\nEnter sizes as SIZE:COUNT pairs, comma-separated:`,
      current || 'S:0, M:0, L:0, XL:0'
    );
    if (input == null) return;
    const sizes = input.split(',')
      .map((pair) => {
        const [size, stock] = pair.split(':').map((x) => x.trim());
        return { size, stock: parseInt(stock, 10) };
      })
      .filter((s) => s.size && Number.isInteger(s.stock) && s.stock >= 0);
    if (!sizes.length) {
      toast({ title: 'INVALID_FORMAT', description: 'USE SIZE:COUNT PAIRS, e.g. S:10, M:5', status: 'error' });
      return;
    }
    setRestockingId(product.id);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'product_stock', productId: product.id, sizes, adminId: user?.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'RESTOCK_FAILED');
      toast({ title: 'STOCK_UPDATED', description: product.name.toUpperCase(), status: 'success' });
      fetchAdminProducts();
    } catch (err: any) {
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setRestockingId(null);
    }
  };

  // --- ASCENSION season control ---
  const fetchSeasons = async () => {
    const { data } = await supabase.from('seasons').select('*').order('start_date', { ascending: false });
    setSeasons(data || []);
  };


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

  // Read a picked image file, downscale it (max 1280px, JPEG q0.85) so the
  // upload payload stays small, and stash it as a base64 data URL for broadcast.
  const handleImagePick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        setFeedImageData(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const postToFeed = async () => {
    if (!feedTitle.trim() || !feedContent.trim()) {
      toast({ title: 'MISSING_DATA', description: 'TITLE + CONTENT REQUIRED', status: 'error' });
      return;
    }
    setIsPosting(true);
    addLog(`BROADCASTING // ${feedTitle}`);
    try {
      // Reuses the admin mint endpoint (kind:'feed_post') -> writes monarch_times.
      // imageData (uploaded photo) wins over imageUrl (pasted link) if both set.
      await seasonForge({
        kind: 'feed_post',
        title: feedTitle.trim(),
        content: feedContent.trim(),
        imageUrl: feedImageUrl.trim() || undefined,
        imageData: feedImageData || undefined,
        author: feedAuthor.trim() || undefined,
      });
      toast({ title: 'BROADCAST_LIVE', description: 'Posted to MONARCH_TIMES', status: 'success' });
      setFeedTitle(''); setFeedContent(''); setFeedImageUrl(''); setFeedImageData(null);
      fetchFeedPosts();
    } catch (err: any) {
      addLog(`BROADCAST_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally { setIsPosting(false); }
  };

  const fetchFeedPosts = async () => {
    const { data } = await supabase.from('monarch_times')
      .select('id, title, author, status, image_url, created_at')
      .order('created_at', { ascending: false })
      .limit(25);
    setFeedPosts(data || []);
  };

  const removeFeedPost = async (post: any) => {
    if (!window.confirm(`DELETE_POST // "${post.title}" — this removes it from every user's feed. Proceed?`)) return;
    setDeletingPostId(post.id);
    addLog(`DELETING_POST // ${post.title}`);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/v2/admin/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'feed_post_delete', postId: post.id, adminId: user?.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'DELETE_FAILED');
      setFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast({ title: 'POST_DELETED', description: `${post.title} REMOVED FROM THE FEED`, status: 'success' });
    } catch (err: any) {
      addLog(`DELETE_FAILED // ${err.message}`);
      toast({ title: 'ERROR', description: err.message, status: 'error' });
    } finally {
      setDeletingPostId(null);
    }
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

        {/* MONARCH_TIMES Broadcast Section */}
        <VStack align="stretch" spacing={6}>
          <Heading size="md" textTransform="uppercase" letterSpacing="0.1em">
            // MONARCH_TIMES Broadcast
          </Heading>
          <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
            <CardHeader pb={0}>
              <Heading size="sm" color={monarchYellow}>POST TO FEED</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <HStack spacing={2}>
                  <FormControl isRequired>
                    <FormLabel fontSize="xs">TITLE</FormLabel>
                    <Input borderRadius="0" placeholder="SEASON_01 // DROP_LIVE" fontSize="sm" value={feedTitle} onChange={(e) => setFeedTitle(e.target.value)} />
                  </FormControl>
                  <FormControl maxW="160px">
                    <FormLabel fontSize="xs">AUTHOR</FormLabel>
                    <Input borderRadius="0" placeholder="PAPILLON" fontSize="sm" value={feedAuthor} onChange={(e) => setFeedAuthor(e.target.value)} />
                  </FormControl>
                </HStack>
                <FormControl isRequired>
                  <FormLabel fontSize="xs">CONTENT</FormLabel>
                  <Textarea borderRadius="0" placeholder="Transmission body..." fontSize="sm" rows={4} value={feedContent} onChange={(e) => setFeedContent(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs">PHOTO (optional)</FormLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    borderRadius="0"
                    fontSize="sm"
                    p={1}
                    onChange={(e) => handleImagePick(e.target.files?.[0])}
                  />
                  {feedImageData && (
                    <Box mt={2}>
                      <Image src={feedImageData} alt="preview" maxH="140px" border="1px solid" borderColor={borderColor} />
                      <Button size="xs" mt={1} variant="outline" borderRadius="0" colorScheme="red" onClick={() => setFeedImageData(null)}>
                        REMOVE PHOTO
                      </Button>
                    </Box>
                  )}
                  <Text fontSize="9px" color="gray.500" mt={1}>
                    Pick a photo from your device — or paste an image link below instead.
                  </Text>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs">IMAGE_URL (alternative to photo)</FormLabel>
                  <Input borderRadius="0" placeholder="https://..." fontSize="sm" value={feedImageUrl} onChange={(e) => setFeedImageUrl(e.target.value)} isDisabled={!!feedImageData} />
                </FormControl>
                <Button w="full" bg={monarchYellow} color="black" borderRadius="0" fontWeight="bold" _hover={{ opacity: 0.8 }} onClick={postToFeed} isLoading={isPosting} loadingText="BROADCASTING...">
                  BROADCAST
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* FEED_LOG: recent posts with one-click delete — no DB edits needed */}
          <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
            <CardHeader pb={0}>
              <HStack justify="space-between">
                <Heading size="sm" color={monarchYellow}>FEED_LOG</Heading>
                <IconButton aria-label="Refresh feed" icon={<MdRefresh />} size="xs" variant="outline" borderRadius="0" borderColor={borderColor} onClick={fetchFeedPosts} _hover={{ bg: 'whiteAlpha.100' }} />
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                {feedPosts.length === 0 && (
                  <Text fontSize="xs" color="gray.500" fontFamily="monospace">FEED_EMPTY // NOTHING_BROADCAST_YET</Text>
                )}
                {feedPosts.map((p) => (
                  <HStack key={p.id} justify="space-between" p={2} border="1px solid" borderColor={borderColor}>
                    <HStack spacing={3} minW={0}>
                      {p.image_url && (
                        <Image src={p.image_url} alt="" boxSize="28px" objectFit="cover" flexShrink={0} />
                      )}
                      <Box minW={0}>
                        <Text fontSize="xs" fontWeight="900" fontFamily="monospace" isTruncated>{p.title}</Text>
                        <Text fontSize="10px" color="gray.500" fontFamily="monospace">
                          {p.author || 'PAPILLON'} // {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}{p.status !== 'PUBLISHED' ? ` // ${p.status}` : ''}
                        </Text>
                      </Box>
                    </HStack>
                    <Button
                      size="xs"
                      variant="outline"
                      borderRadius="0"
                      borderColor={destructiveRed}
                      color={destructiveRed}
                      isLoading={deletingPostId === p.id}
                      onClick={() => removeFeedPost(p)}
                      _hover={{ bg: 'whiteAlpha.100' }}
                    >
                      DELETE
                    </Button>
                  </HStack>
                ))}
              </VStack>
            </CardBody>
          </Card>
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
                          <option value="ARTIFACT">ARTIFACT</option>
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
                        <FormLabel fontSize="xs">MAX REDEMPTIONS (BLANK = UNLIMITED)</FormLabel>
                        <Input
                          borderRadius="0"
                          type="number"
                          placeholder="e.g. 100"
                          fontSize="sm"
                          value={maxRedemptions}
                          onChange={(e) => setMaxRedemptions(e.target.value)}
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

          {/* PRODUCT FORGE: physical garments — the in-house Shopify replacement */}
          <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
            <CardHeader pb={0}>
              <Heading size="sm" color={monarchYellow}>FORGE PHYSICAL PRODUCT</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="xs">PHOTOS (UP TO 6 — FIRST IS THE COVER)</FormLabel>
                  {prodImages.length > 0 && (
                    <HStack spacing={2} mb={2} flexWrap="wrap">
                      {prodImages.map((src, i) => (
                        <Box key={i} position="relative">
                          <Image src={src} boxSize="56px" objectFit="cover" border="1px solid" borderColor={borderColor} />
                          <IconButton
                            aria-label="Remove photo" icon={<MdClose />} size="xs" borderRadius="0"
                            position="absolute" top="-8px" right="-8px"
                            onClick={() => setProdImages((prev) => prev.filter((_, pi) => pi !== i))}
                          />
                        </Box>
                      ))}
                    </HStack>
                  )}
                  <Input type="file" accept="image/*" multiple border="none" p={0}
                    onChange={(e) => { handleProductImagesPick(e.target.files); e.target.value = ''; }} />
                </FormControl>

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                  <FormControl isRequired>
                    <FormLabel fontSize="xs">PRODUCT_NAME</FormLabel>
                    <Input borderRadius="0" placeholder="GENESIS HOODIE" fontSize="sm" value={prodName} onChange={(e) => setProdName(e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="xs">PRICE_USD</FormLabel>
                    <Input borderRadius="0" type="number" placeholder="120" fontSize="sm" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">CATEGORY</FormLabel>
                    <Select borderRadius="0" fontSize="sm" value={prodCategory} onChange={(e) => setProdCategory(e.target.value)}>
                      {['HOODIE', 'TEE', 'CAP', 'SWEATS', 'ACCESSORY'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel fontSize="xs">DESCRIPTION</FormLabel>
                  <Textarea borderRadius="0" fontSize="sm" rows={3} placeholder="Heavyweight fleece. NFC artifact embedded in the cuff." value={prodDescription} onChange={(e) => setProdDescription(e.target.value)} />
                </FormControl>

                <HStack spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="xs">COLLECTION</FormLabel>
                    <Input borderRadius="0" placeholder="GENESIS" fontSize="sm" value={prodCollection} onChange={(e) => setProdCollection(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">SEASON</FormLabel>
                    <Input borderRadius="0" placeholder="S01" fontSize="sm" value={prodSeason} onChange={(e) => setProdSeason(e.target.value)} />
                  </FormControl>
                </HStack>

                <FormControl>
                  <FormLabel fontSize="xs">SIZES // STOCK</FormLabel>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
                    {prodSizes.map((row, i) => (
                      <HStack key={i} spacing={1}>
                        <Input borderRadius="0" fontSize="xs" w="56px" value={row.size}
                          onChange={(e) => setProdSizes((prev) => prev.map((r, ri) => ri === i ? { ...r, size: e.target.value } : r))} />
                        <Input borderRadius="0" fontSize="xs" type="number" placeholder="QTY" value={row.stock}
                          onChange={(e) => setProdSizes((prev) => prev.map((r, ri) => ri === i ? { ...r, stock: e.target.value } : r))} />
                      </HStack>
                    ))}
                  </SimpleGrid>
                  <Button mt={2} size="xs" variant="outline" borderRadius="0" borderColor={borderColor} color={labelText} onClick={() => setProdSizes((prev) => [...prev, { size: '', stock: '' }])} _hover={{ bg: 'whiteAlpha.100' }}>
                    + SIZE
                  </Button>
                </FormControl>

                <Button bg={monarchYellow} color="black" borderRadius="0" fontWeight="bold" _hover={{ opacity: 0.8 }} onClick={createProduct} isLoading={isCreatingProduct} loadingText="FORGING...">
                  FORGE PRODUCT
                </Button>
              </VStack>
            </CardBody>
          </Card>

          {/* STORE INVENTORY: every cosmetic ever forged, live or retired.
              RETIRE pulls an item from the Shop; RESTORE re-releases it. */}
          <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
            <CardHeader pb={0}>
              <HStack justify="space-between">
                <Heading size="sm" color={monarchYellow}>STORE_INVENTORY</Heading>
                <HStack spacing={1}>
                  {(['ALL', 'LIVE', 'RETIRED'] as const).map((f) => {
                    const count = f === 'ALL'
                      ? adminProducts.length
                      : f === 'LIVE'
                        ? adminProducts.filter((p) => p.is_active !== false).length
                        : adminProducts.filter((p) => p.is_active === false).length;
                    return (
                      <Button
                        key={f}
                        size="xs"
                        borderRadius="0"
                        variant={productFilter === f ? 'solid' : 'outline'}
                        bg={productFilter === f ? monarchYellow : 'transparent'}
                        color={productFilter === f ? 'black' : labelText}
                        borderColor={borderColor}
                        onClick={() => setProductFilter(f)}
                        _hover={{ opacity: 0.8 }}
                      >
                        {f}:{count}
                      </Button>
                    );
                  })}
                  <IconButton aria-label="Refresh inventory" icon={<MdRefresh />} size="xs" variant="outline" borderRadius="0" borderColor={borderColor} onClick={fetchAdminProducts} _hover={{ bg: 'whiteAlpha.100' }} />
                </HStack>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={2} align="stretch">
                {adminProducts.length === 0 && (
                  <Text fontSize="xs" color="gray.500" fontFamily="monospace">NO_FORGED_PRODUCTS_YET</Text>
                )}
                {adminProducts
                  .filter((p) => productFilter === 'ALL' || (productFilter === 'RETIRED') === (p.is_active === false))
                  .map((p) => {
                    const retired = p.is_active === false;
                    const isPhysical = p.category !== 'AVATAR' && p.category !== 'THEME' && p.category !== 'WNGS_BUNDLE';
                    const lineage = [p.season, p.collection, p.edition].filter(Boolean).join(' / ');
                    const forgedOn = p.created_at ? new Date(p.created_at).toLocaleDateString() : null;
                    const stockLine = (p.sizes || []).map((s: any) => `${s.size}:${s.stock}`).join(' ');
                    return (
                      <HStack key={p.id} justify="space-between" p={2} border="1px solid" borderColor={borderColor} opacity={retired ? 0.45 : 1}>
                        <HStack spacing={3} minW={0}>
                          {p.category === 'AVATAR' ? (
                            <DeStijlAvatar seed={p.id} colors={p.palette || undefined} size={28} />
                          ) : isPhysical ? (
                            Array.isArray(p.images) && p.images[0] ? (
                              <Image src={p.images[0]} boxSize="28px" objectFit="cover" flexShrink={0} border="1px solid" borderColor={borderColor} />
                            ) : (
                              <Box w="28px" h="28px" flexShrink={0} border="1px dashed" borderColor={borderColor} />
                            )
                          ) : (
                            <Box w="28px" h="28px" flexShrink={0} bg={p.accent_color || monarchYellow} border="2px solid" borderColor={borderColor} />
                          )}
                          <Box minW={0}>
                            <Text fontSize="xs" fontWeight="900" fontFamily="monospace" isTruncated>{p.name}</Text>
                            <Text fontSize="10px" color="gray.500" fontFamily="monospace" isTruncated>
                              {isPhysical
                                ? `${p.category} // $${p.price_usd} // STOCK: ${stockLine || '—'}`
                                : `${p.category} // ${p.rarity || 'COMMON'} // ${p.price_wngs} WNGS // OWNERS:${p.owners ?? 0}`}
                              {retired ? ' // RETIRED' : ''}
                            </Text>
                            {(lineage || forgedOn) && (
                              <Text fontSize="10px" color="gray.600" fontFamily="monospace" isTruncated>
                                {[lineage, forgedOn && `FORGED ${forgedOn}`].filter(Boolean).join(' // ')}
                              </Text>
                            )}
                          </Box>
                        </HStack>
                        <HStack spacing={1} flexShrink={0}>
                          {isPhysical && !retired && (
                            <Button
                              size="xs" variant="outline" borderRadius="0"
                              borderColor={monarchYellow} color={monarchYellow}
                              isLoading={restockingId === p.id}
                              onClick={() => restockProduct(p)}
                              _hover={{ bg: 'whiteAlpha.100' }}
                            >
                              RESTOCK
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="outline"
                            borderRadius="0"
                            borderColor={retired ? monarchYellow : destructiveRed}
                            color={retired ? monarchYellow : destructiveRed}
                            isLoading={togglingProductId === p.id}
                            onClick={() => toggleProductStatus(p)}
                            _hover={{ bg: 'whiteAlpha.100' }}
                          >
                            {retired ? 'RESTORE' : 'RETIRE'}
                          </Button>
                        </HStack>
                      </HStack>
                    );
                  })}
              </VStack>
            </CardBody>
          </Card>
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
