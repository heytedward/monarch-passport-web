import { useState } from 'react';
import {
  Box, Flex, Text, VStack, HStack, Center, Spinner, useColorModeValue,
} from '@chakra-ui/react';
import {
  PiBellFill, PiLightningFill, PiTrophyFill, PiUsersFill, PiTShirtFill,
  PiGiftFill, PiRankingFill, PiArrowBendUpLeftFill, PiSparkleFill, PiXBold,
} from 'react-icons/pi';
import { usePrivy } from '@privy-io/react-auth';

interface Notification {
  id: string;
  kind: string;
  title: string;
  amount: number;
  positive: boolean;
  created_at: string;
}

// Icon per notification kind (mirrors NOTIF_LABELS server-side).
const KIND_ICON: Record<string, any> = {
  scan: PiLightningFill,
  quest: PiTrophyFill,
  social: PiUsersFill,
  shop: PiTShirtFill,
  gift: PiGiftFill,
  ascension: PiRankingFill,
  spend: PiArrowBendUpLeftFill,
  system: PiSparkleFill,
};

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

// Notifications bell + slide-down panel. On-open model: fetches the derived
// 30-day feed each time it's opened (no realtime, no unread tracking yet).
const NotificationsBell = () => {
  const { user, getAccessToken } = usePrivy();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const iconColor = useColorModeValue('black', 'white');
  const panelBg = useColorModeValue('gray.50', 'black');
  const borderCol = useColorModeValue('black', 'white');
  const muted = useColorModeValue('gray.500', 'gray.500');

  const load = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user?.id, action: 'get_notifications' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) setItems(data.notifications || []);
    } catch { /* leave empty */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  return (
    <Box position="relative">
      {/* Bell button */}
      <Center
        as="button"
        onClick={toggle}
        w="40px"
        h="40px"
        border={`3px solid ${borderCol}`}
        color={open ? 'var(--monarch-accent)' : iconColor}
        transition="all 0.15s"
        _hover={{ transform: 'translateY(-1px)' }}
        aria-label="Notifications"
      >
        <PiBellFill size={20} />
      </Center>

      {/* Panel */}
      {open && (
        <>
          {/* click-away backdrop */}
          <Box position="fixed" inset={0} zIndex={1400} onClick={() => setOpen(false)} />
          <Box
            position="absolute"
            top="48px"
            right={0}
            w="300px"
            maxH="60vh"
            overflowY="auto"
            bg={panelBg}
            border={`3px solid ${borderCol}`}
            zIndex={1401}
            boxShadow="6px 6px 0 var(--monarch-accent)"
          >
            <Flex
              justify="space-between"
              align="center"
              px={4}
              py={3}
              borderBottom={`3px solid ${borderCol}`}
              position="sticky"
              top={0}
              bg={panelBg}
            >
              <Text fontSize="11px" fontWeight="900" fontFamily="monospace" letterSpacing="0.15em" color={iconColor}>
                NOTIFICATIONS
              </Text>
              <Box as="button" onClick={() => setOpen(false)} color={iconColor} aria-label="Close">
                <PiXBold size={14} />
              </Box>
            </Flex>

            {loading ? (
              <Center py={10}>
                <Spinner color="var(--monarch-accent)" thickness="3px" />
              </Center>
            ) : items.length === 0 ? (
              <Center py={10} px={6} textAlign="center">
                <VStack spacing={2}>
                  <Text fontSize="10px" fontWeight="900" fontFamily="monospace" color={muted} letterSpacing="0.1em">
                    [ NO_SIGNAL_YET ]
                  </Text>
                  <Text fontSize="9px" fontFamily="monospace" color={muted}>
                    tap an artifact or scan a link to see rewards land here.
                  </Text>
                </VStack>
              </Center>
            ) : (
              <VStack spacing={0} align="stretch">
                {items.map((n) => {
                  const Icon = KIND_ICON[n.kind] || PiSparkleFill;
                  return (
                    <HStack
                      key={n.id}
                      spacing={3}
                      px={4}
                      py={3}
                      borderBottom={`1px solid ${borderCol}`}
                      align="center"
                    >
                      <Center
                        w="30px"
                        h="30px"
                        flexShrink={0}
                        border={`2px solid ${borderCol}`}
                        color={iconColor}
                      >
                        <Icon size={15} />
                      </Center>
                      <Box flex={1} minW={0}>
                        <Text fontSize="11px" fontWeight="900" fontFamily="monospace" color={iconColor} noOfLines={1} textTransform="uppercase">
                          {n.title}
                        </Text>
                        <Text fontSize="9px" fontFamily="monospace" color={muted}>
                          {timeAgo(n.created_at)}
                        </Text>
                      </Box>
                      {n.amount !== 0 && (
                        <Text
                          fontSize="11px"
                          fontWeight="900"
                          fontFamily="monospace"
                          color={n.positive ? 'var(--monarch-accent)' : muted}
                          flexShrink={0}
                        >
                          {n.positive ? '+' : ''}{n.amount}
                        </Text>
                      )}
                    </HStack>
                  );
                })}
                <Center py={3}>
                  <Text fontSize="8px" fontFamily="monospace" color={muted} letterSpacing="0.1em">
                    LAST 30 DAYS
                  </Text>
                </Center>
              </VStack>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default NotificationsBell;
