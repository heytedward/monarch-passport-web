import React, { useState } from 'react';
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

  const handleAction = (action: string) => {
    toast({
      title: `PROTOCOL: ${action}`,
      description: "COMMAND SENT TO CORE ENGINE",
      status: "info",
      duration: 3000,
      isClosable: true,
      variant: "solid",
    });
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

        {/* Seasonal Control Section */}
        <VStack align="stretch" spacing={6}>
          <Heading size="md" textTransform="uppercase" letterSpacing="0.1em">
            // Seasonal Control
          </Heading>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            {/* Block 1: Initialize */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>INITIALIZE NEW PROTOCOL</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="xs">SEASON ID</FormLabel>
                    <Input borderRadius="0" placeholder="e.g. S01" fontSize="sm" />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">PROTOCOL TITLE</FormLabel>
                    <Input borderRadius="0" placeholder="e.g. OPERATION_NEON" fontSize="sm" />
                  </FormControl>
                  <Button
                    w="full"
                    bg={monarchYellow}
                    color="black"
                    borderRadius="0"
                    fontWeight="bold"
                    _hover={{ opacity: 0.8 }}
                    onClick={() => handleAction('INITIALIZE')}
                  >
                    LAUNCH
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            {/* Block 2: Override */}
            <Card variant="outline" bg={cardBg} borderColor={borderColor} borderRadius="0" border="1px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={monarchYellow}>OVERRIDE END DATE</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel fontSize="xs">NEW TERMINATION DATE</FormLabel>
                    <Input type="date" borderRadius="0" fontSize="sm" />
                  </FormControl>
                  <Box flex={1} />
                  <Button
                    w="full"
                    bg={monarchYellow}
                    color="black"
                    borderRadius="0"
                    fontWeight="bold"
                    _hover={{ opacity: 0.8 }}
                    onClick={() => handleAction('OVERRIDE')}
                  >
                    UPDATE
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            {/* Block 3: Terminate */}
            <Card variant="outline" bg={cardBg} borderColor={destructiveRed} borderRadius="0" border="2px solid">
              <CardHeader pb={0}>
                <Heading size="sm" color={destructiveRed}>TERMINATE ACTIVE SEASON</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={4} h="full" justify="space-between">
                  <Text fontSize="xs" color="gray.500">
                    WARNING: THIS ACTION IS IRREVERSIBLE. ALL ACTIVE PROTOCOLS WILL BE HALTED IMMEDIATELY.
                  </Text>
                  <Button
                    w="full"
                    bg={destructiveRed}
                    color="white"
                    borderRadius="0"
                    fontWeight="bold"
                    _hover={{ bg: 'red.700' }}
                    onClick={() => handleAction('TERMINATE')}
                  >
                    KILL SWITCH
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
