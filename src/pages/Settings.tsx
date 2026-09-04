import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  useColorModeValue,
  HStack,
  Icon,
  Input,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { PiArrowLeftBold, PiPowerBold, PiUserBold } from 'react-icons/pi';
import useStore from '../store/useStore';

// Mirrors USERNAME_RE in api/v2/purchase.js. Checked client-side first so
// obviously-invalid input never spends a request against the server's
// username rate limit.
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const CHECK_DEBOUNCE_MS = 500;

type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok' }
  | { state: 'bad'; reason: string };

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout, getAccessToken } = usePrivy();
  const toast = useToast();
  const { username, setUsername } = useStore();

  const [draft, setDraft] = useState('');
  const [avail, setAvail] = useState<Availability>({ state: 'idle' });
  const [saving, setSaving] = useState(false);
  // Guards against a slow earlier check overwriting a newer one's result.
  const checkSeq = useRef(0);

  const callApi = async (body: Record<string, any>) => {
    const token = await getAccessToken();
    const res = await fetch('/api/v2/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user?.id, ...body }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'REQUEST_FAILED');
    return data;
  };

  useEffect(() => {
    const candidate = draft.trim();
    if (!candidate) { setAvail({ state: 'idle' }); return; }
    if (candidate.toLowerCase() === (username || '').toLowerCase()) {
      setAvail({ state: 'bad', reason: 'CURRENT_HANDLE' });
      return;
    }
    if (!USERNAME_RE.test(candidate)) {
      setAvail({ state: 'bad', reason: 'FORMAT // 3-20 CHARS, A-Z 0-9 _' });
      return;
    }

    setAvail({ state: 'checking' });
    const seq = ++checkSeq.current;
    const timer = setTimeout(async () => {
      try {
        const data = await callApi({ action: 'check_username', username: candidate });
        if (seq !== checkSeq.current) return; // a newer keystroke superseded this
        setAvail(data.available ? { state: 'ok' } : { state: 'bad', reason: data.reason || 'TAKEN' });
      } catch {
        if (seq === checkSeq.current) setAvail({ state: 'bad', reason: 'CHECK_UNAVAILABLE' });
      }
    }, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, username]);

  const handleClaim = async () => {
    const candidate = draft.trim();
    if (avail.state !== 'ok' || saving) return;
    setSaving(true);
    try {
      const data = await callApi({ action: 'set_username', username: candidate });
      setUsername(data.username || candidate);
      setDraft('');
      setAvail({ state: 'idle' });
      toast({ title: 'CALLSIGN_UPDATED', description: data.username || candidate, status: 'success', duration: 3000 });
    } catch (e: any) {
      toast({ title: 'COULD_NOT_CLAIM', description: String(e?.message || ''), status: 'error', duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  const bgColor = useColorModeValue("gray.50", "black");
  const text = useColorModeValue("black", "white");
  const mutedText = useColorModeValue("gray.600", "whiteAlpha.600");
  const border = useColorModeValue("gray.300", "whiteAlpha.400");
  const monarchYellow = "#FFB000";

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatAddress = (address: string) => {
    if (!address) return 'NOT_CONNECTED';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const walletAddress = user?.wallet?.address || user?.id || 'UNKNOWN_IDENTITY';

  return (
    <Box bg={bgColor} minH="100vh" pb="100px" color={text} fontFamily="'Space Mono', monospace">
      {/* Header */}
      <Box p={8} pt={12} borderBottom={`4px solid ${text}`}>
        <HStack spacing={4} mb={4}>
          <Button 
            variant="ghost" 
            p={0} 
            _hover={{ bg: 'transparent', transform: 'translateX(-4px)' }}
            onClick={() => navigate(-1)}
          >
            <PiArrowLeftBold size={24} color={text} />
          </Button>
          <Heading 
            fontSize="3xl" 
            fontWeight="900" 
            fontStyle="italic" 
            fontFamily="'Archivo Black', sans-serif"
            textTransform="uppercase"
            letterSpacing="-0.02em"
          >
            // SYSTEM_SETTINGS
          </Heading>
        </HStack>
        <Text fontSize="9px" fontWeight="900" color={mutedText} fontFamily="monospace" letterSpacing="0.1em">
          ACCESS_LEVEL // AUTHORIZED_ADMIN
        </Text>
      </Box>

      <VStack spacing={0} align="stretch">
        {/* Identity Matrix Section */}
        <Box p={8} borderBottom={`1px solid ${border}`}>
          <Text fontSize="xs" fontWeight="900" color={monarchYellow} fontFamily="monospace" mb={6}>
            [ IDENTITY_MATRIX ]
          </Text>
          <Box 
            bg={useColorModeValue("gray.100", "whiteAlpha.100")} 
            p={6} 
            border={`2px solid ${text}`}
            position="relative"
          >
            <VStack align="start" spacing={1}>
              <Text fontSize="10px" color={mutedText} fontWeight="bold">CURRENT_HANDSHAKE</Text>
              <Text fontSize="lg" fontWeight="900" letterSpacing="0.05em">
                {formatAddress(walletAddress)}
              </Text>
            </VStack>
            <Box position="absolute" top={2} right={2}>
              <Icon as={PiUserBold} color={monarchYellow} />
            </Box>
          </Box>

          {/* Public callsign. Auto-assigned as Monarch#NNNN at first login; a
              custom handle can be claimed once and changed later. */}
          <Box mt={6} p={6} border={`2px solid ${text}`}>
            <VStack align="stretch" spacing={1} mb={5}>
              <Text fontSize="10px" color={mutedText} fontWeight="bold">PUBLIC_CALLSIGN</Text>
              <Text fontSize="lg" fontWeight="900" letterSpacing="0.05em" color={monarchYellow}>
                {username || 'UNASSIGNED'}
              </Text>
              <Text fontSize="9px" color={mutedText}>
                SHOWN ON YOUR SOCIAL LINK AND SHARED PROGRESS
              </Text>
            </VStack>

            <HStack spacing={0} align="stretch">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleClaim(); }}
                placeholder="CLAIM_NEW_CALLSIGN"
                maxLength={20}
                borderRadius="0"
                border={`2px solid ${text}`}
                borderRight="none"
                bg="transparent"
                color={text}
                fontFamily="'Space Mono', monospace"
                fontWeight="900"
                fontSize="sm"
                h="48px"
                _placeholder={{ color: mutedText, fontSize: '11px' }}
                _focus={{ boxShadow: 'none', borderColor: monarchYellow }}
              />
              <Button
                onClick={handleClaim}
                isDisabled={avail.state !== 'ok' || saving}
                borderRadius="0"
                h="48px"
                px={6}
                fontSize="xs"
                fontWeight="900"
                bg={avail.state === 'ok' ? monarchYellow : 'transparent'}
                color={avail.state === 'ok' ? 'black' : mutedText}
                border={`2px solid ${avail.state === 'ok' ? monarchYellow : text}`}
                _hover={avail.state === 'ok' ? { bg: text, color: monarchYellow } : {}}
              >
                {saving ? <Spinner size="xs" /> : 'CLAIM'}
              </Button>
            </HStack>

            {/* Status line. Reserves its own row so the layout doesn't jump. */}
            <Box minH="18px" mt={2}>
              {avail.state === 'checking' && (
                <Text fontSize="9px" color={mutedText} fontWeight="bold">CHECKING_AVAILABILITY...</Text>
              )}
              {avail.state === 'ok' && (
                <Text fontSize="9px" color={monarchYellow} fontWeight="bold">AVAILABLE</Text>
              )}
              {avail.state === 'bad' && (
                <Text fontSize="9px" color="#DC143C" fontWeight="bold">
                  UNAVAILABLE // {avail.reason}
                </Text>
              )}
            </Box>
          </Box>
        </Box>

        {/* Session Control Section */}
        <Box p={8} borderBottom={`1px solid ${border}`}>
          <Text fontSize="xs" fontWeight="900" color={monarchYellow} fontFamily="monospace" mb={6}>
            [ SESSION_CONTROL ]
          </Text>
          <VStack spacing={4}>
            <Button 
              leftIcon={<PiPowerBold />}
              bg="#E53E3E" 
              color="white" 
              borderRadius="0" 
              h="60px"
              w="full"
              fontSize="md"
              fontWeight="900"
              _hover={{ bg: '#C53030', transform: 'translateY(-2px)' }}
              _active={{ transform: 'translateY(0)' }}
              onClick={handleLogout}
              boxShadow={`4px 4px 0px 0px ${text}`}
              transition="all 0.2s"
            >
              TERMINATE CONNECTION (LOGOUT)
            </Button>

            <Button 
              variant="outline"
              borderColor={monarchYellow}
              color={monarchYellow}
              borderRadius="0" 
              h="50px"
              w="full"
              fontSize="sm"
              fontWeight="900"
              _hover={{ bg: monarchYellow, color: 'black' }}
              onClick={() => navigate('/profile')}
              borderWidth="2px"
            >
              RETURN TO PROFILE
            </Button>
          </VStack>
        </Box>

        {/* Admin Override Section */}
        <Box p={8} borderBottom={`1px solid ${border}`}>
          <Text fontSize="xs" fontWeight="900" color={monarchYellow} fontFamily="monospace" mb={6}>
            // ADMIN_OVERRIDE
          </Text>
          <Button 
            bg={monarchYellow}
            color="black"
            borderRadius="0" 
            h="60px"
            w="full"
            fontSize="md"
            fontWeight="900"
            _hover={{ bg: text, color: monarchYellow, transform: 'translateY(-2px)' }}
            _active={{ transform: 'translateY(0)' }}
            onClick={() => navigate('/command-center')}
            boxShadow={`4px 4px 0px 0px ${text === 'white' ? 'whiteAlpha.300' : 'blackAlpha.300'}`}
            transition="all 0.2s"
          >
            INITIALIZE COMMAND CENTER
          </Button>
        </Box>
      </VStack>

      {/* Footer */}
      <Box p={8} mt={10}>
        <VStack spacing={2}>
          <Text fontSize="8px" color={mutedText} textAlign="center" fontFamily="monospace">
            MONARCH_OS // V1.2.4
          </Text>
          <Text fontSize="8px" color={mutedText} textAlign="center" fontFamily="monospace">
            ENCRYPTION_STATUS // ACTIVE
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};

export default Settings;
