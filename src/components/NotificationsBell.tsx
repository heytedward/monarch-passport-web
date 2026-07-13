import { useEffect, useMemo, useState } from 'react';
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

// Per-device "last seen" mark for the unread badge (Phase 2). Kept in
// localStorage — a lightweight, backend-free unread count that's plenty for a
// phone-first app; a server-side last_seen can replace it later if needed.
const SEEN_KEY = 'monarch_notifs_seen_at';
const readSeen = () => {
  try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; }
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

// Notifications bell + slide-down panel. Fetches the derived 30-day feed when
// the passport opens (on-open model) so the bell can show an unread badge;
// opening the panel marks everything seen and clears the badge.
const NotificationsBell = () => {
  const { user, getAccessToken } = usePrivy();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [seenAt, setSeenAt] = useState<string>(() => readSeen());

  const iconColor = useColorModeValue('black', 'white');
  const panelBg = useColorModeValue('gray.50', 'black');
  const borderCol = useColorModeValue('black', 'white');
  const muted = useColorModeValue('gray.500', 'gray.500');

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, action: 'get_notifications' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) setItems(data.notifications || []);
    } catch { /* leave empty */ } finally {
      setLoading(false);
    }
  };

  // Fetch once when the passport opens so the badge is live before any tap.
  useEffect(() => {
    if (user?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = useMemo(() => {
    const seen = seenAt ? new Date(seenAt).getTime() : 0;
    return items.filter((n) => new Date(n.created_at).getTime() > seen).length;
  }, [items, seenAt]);

  const markSeen = () => {
    const now = new Date().toISOString();
    try { localStorage.setItem(SEEN_KEY, now); } catch { /* ignore */ }
    setSeenAt(now);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markSeen(); // opening clears the badge
  };

  return (
    <Box position="relative">
      {/* Bell button */}
      <Center
        as="button"
        onClick={toggle}
        w="40px"
        h="40px"
        position="relative"
        border={`3px solid ${borderCol}`}
        color={open ? 'var(--monarch-accent)' : iconColor}
        transition="all 0.15s"
        _hover={{ transform: 'translateY(-1px)' }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <PiBellFill size={20} />
        {unread > 0 && (
          <Center
            position="absolute"
            top="-8px"
            right="-8px"
            minW="18px"
            h="18px"
            px="4px"
            bg="var(--monarch-accent)"
            color="black"
            border={`2px solid ${borderCol}`}
            borderRadius="full"
            fontSize="9px"
            fontWeight="900"
            fontFamily="monospace"
            lineHeight="1"
          >
            {unread > 9 ? '9+' : unread}
          </Center>
        )}
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
