import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Center, Text, VStack } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import useStore from '../store/useStore';
import ArtifactCard from '../components/tap/ArtifactCard';
import ScanlineSweep from '../components/tap/ScanlineSweep';
import ShutterWipe from '../components/tap/ShutterWipe';
import { actionRise, reduced } from '../lib/tapMotion';

const MotionBox = motion.create(Box);

// The read is usually faster than the animation that represents it. Without a
// floor the scanline flashes for two frames and the sequence reads as a
// glitch rather than a machine doing something -- so hold READING long enough
// for one full pass of the head, and no longer.
const MIN_READ_MS = 900;

// What the tag lookup gives us. Mirrors the payload of GET /api/v2/verify,
// which is the only way to read `artifacts` from the browser: the table is
// RLS deny-all to the anon key (db/rls_policies.sql), so the service-role
// endpoint is the read path, not a client Supabase query.
type Tag = {
  id: string;
  name: string;
  tier: string;
  isActivated: boolean;
  isOwner: boolean;
  season: string | null;
};

/**
 * The sequence, as a press cycle:
 *
 *   READING   scanline loops while the tag is looked up
 *   PLATES    the press closes and parts  (ShutterWipe)
 *   OFFER     the piece strikes in, specs punch, "Claim it" rises
 *   WORKING   login + account setup, shown as "Creating your Passport"
 *   PLATES_2  the press cycles again on success
 *   CLAIMED   the piece comes back stamped
 *
 * plus the flat ends: OWNED (someone already has it), MISSING, FAULT.
 */
type Phase =
  | 'READING'
  | 'PLATES'
  | 'OFFER'
  | 'WORKING'
  | 'PLATES_2'
  | 'CLAIMED'
  | 'OWNED'
  | 'MISSING'
  | 'FAULT';

const Tap = () => {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const setWngsBalance = useStore((s) => s.setWngsBalance);
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('READING');
  // Wall-clock mount, so the read floor covers the fetch rather than adding
  // to it: a slow lookup spends the floor and advances immediately.
  const openedAt = useRef(Date.now());
  const [tag, setTag] = useState<Tag | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Set when the user presses "Claim it" while logged out: the Privy modal
  // takes over, and this survives it so the claim resumes on the way back.
  const [wantsClaim, setWantsClaim] = useState(false);
  // Claiming is not idempotent -- guard against a second run from the auth
  // effect re-firing (Privy emits several ready/authenticated ticks).
  const claiming = useRef(false);
  // "<tagId>:anon" | "<tagId>:auth" -- what the last lookup actually asked
  // for. The effect below re-runs several times as Privy boots, and without
  // this every tap fires the same anonymous read twice.
  const lastRead = useRef<string | null>(null);

  // ---------------------------------------------------------------- lookup
  // Deliberately NOT gated on Privy's `ready`. The tag read is anonymous, and
  // this screen opens from a phone tap where the first paint is the product:
  // waiting for the auth SDK to boot would stall "READING TAG" behind a large
  // chunk, and stall it forever if Privy is slow or down. We read straight
  // away, then re-read with a token once the user turns out to be logged in
  // (that pass is what resolves `isOwner`).
  useEffect(() => {
    if (!tagId) return;
    let cancelled = false;

    // One anonymous read, then at most one authenticated re-read (which is
    // the only thing that can tell us something new -- whether the tag is
    // already ours). Privy flipping ready/authenticated re-runs this effect
    // either way; this is what stops it re-asking the same question.
    const mode = ready && authenticated ? 'auth' : 'anon';
    const readKey = `${tagId}:${mode}`;
    if (lastRead.current === readKey) return;
    lastRead.current = readKey;

    (async () => {
      try {
        // Send the token when we have one so the server can tell us whether
        // this tag is already ours (it never returns the owner's id).
        let token: string | null = null;
        if (mode === 'auth') {
          try {
            token = await getAccessToken();
          } catch {
            /* fall through to the anonymous read */
          }
        }

        const res = await fetch(`/api/v2/verify?id=${encodeURIComponent(tagId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (cancelled) return;

        if (res.status === 404) {
          setPhase((p) => (p === 'READING' ? 'MISSING' : p));
          return;
        }
        if (!res.ok) {
          setMessage("We couldn't read this tag. Try tapping again.");
          setPhase((p) => (p === 'READING' ? 'FAULT' : p));
          return;
        }

        const data: Tag = await res.json();
        if (cancelled) return;
        setTag(data);

        const held = Date.now() - openedAt.current;
        if (held < MIN_READ_MS) {
          await new Promise((r) => setTimeout(r, MIN_READ_MS - held));
          if (cancelled) return;
        }
        // Only the first read drives the sequence. This effect re-runs when
        // Privy flips to authenticated -- which happens *during* a claim --
        // and without this guard that refetch would throw the screen back to
        // PLATES while the claim is still in flight.
        setPhase((p) => (p !== 'READING' ? p : data.isActivated ? 'OWNED' : 'PLATES'));
      } catch {
        if (!cancelled) {
          setMessage('No connection. Check your signal and tap again.');
          setPhase((p) => (p === 'READING' ? 'FAULT' : p));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Re-runs on login so an already-claimed tag can resolve to "yours".
    // getAccessToken is deliberately not a dependency: Privy does not hand
    // back a stable function identity, so including it refetches every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId, ready, authenticated, user?.id]);


  // ---------------------------------------------------------------- claim
  const runClaim = useCallback(async () => {
    if (!tagId || !user?.id || claiming.current) return;
    claiming.current = true;
    setPhase('WORKING');
    setMessage('Creating your Passport');

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('no-token');

      // The Passport itself: creates the profile row if this is a brand-new
      // account. The claim below reads that row, so it has to exist first --
      // AppContent fires the same call on login, but not necessarily before
      // we get here. The embedded wallet is created by Privy in the
      // background meanwhile; nothing on this screen waits on it.
      await fetch('/api/v2/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, action: 'ensure_profile' }),
      }).catch(() => null);

      const res = await fetch('/api/v2/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tagId, ownerId: user.id }),
      });
      const result = await res.json().catch(() => null);

      if (res.status === 409) {
        setTag((t) => (t ? { ...t, isActivated: true, isOwner: false } : t));
        setPhase('OWNED');
        return;
      }
      if (res.status === 429) {
        setMessage('Too many tries just now. Give it a minute and tap again.');
        setPhase('FAULT');
        return;
      }
      if (!res.ok) {
        setMessage("That didn't go through. Tap again to retry.");
        setPhase('FAULT');
        return;
      }

      // The claim endpoint also credits the activation bonus; keep the
      // header balance honest rather than letting it drift until reload.
      if (typeof result?.awarded === 'number') {
        const bal = useStore.getState().wngsBalance || 0;
        setWngsBalance(bal + result.awarded);
      }
      setMessage(null);
      setPhase('PLATES_2');
    } catch {
      setMessage("That didn't go through. Tap again to retry.");
      setPhase('FAULT');
    } finally {
      claiming.current = false;
    }
    // getAccessToken omitted for the same reason as the lookup effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId, user?.id, setWngsBalance]);

  // Resume after the login sheet closes.
  useEffect(() => {
    if (wantsClaim && ready && authenticated && user?.id && !claiming.current) {
      setWantsClaim(false);
      runClaim();
    }
  }, [wantsClaim, ready, authenticated, user?.id, runClaim]);

  const onClaimPress = () => {
    if (!authenticated) {
      setWantsClaim(true);
      login();
      return;
    }
    runClaim();
  };

  const platesDone = useCallback(() => {
    setPhase((p) => (p === 'PLATES' ? 'OFFER' : p === 'PLATES_2' ? 'CLAIMED' : p));
  }, []);

  // ---------------------------------------------------------------- render
  const showCard = phase === 'OFFER' || phase === 'WORKING' || phase === 'CLAIMED' || phase === 'OWNED';

  return (
    <Box
      bg="black"
      minH="100vh"
      position="relative"
      // Clips the scanline and the plates; also the guard that keeps any
      // stray transform from widening the ~430px column.
      overflow="hidden"
      px={5}
      py={10}
    >
      {(phase === 'READING' || phase === 'PLATES') && (
        <ScanlineSweep mode={phase === 'PLATES' ? 'final' : 'reading'} />
      )}
      {(phase === 'PLATES' || phase === 'PLATES_2') && <ShutterWipe onComplete={platesDone} />}

      <Center minH="80vh">
        <VStack spacing={8} w="full" maxW="380px">
          {phase === 'READING' && (
            <VStack spacing={3}>
              <Text className="de-stijl-body" fontSize="xs" color="whiteAlpha.700" letterSpacing="0.25em">
                READING TAG
              </Text>
            </VStack>
          )}

          {showCard && tag && (
            <ArtifactCard
              name={tag.name}
              season={tag.season}
              tier={tag.tier}
              stamped={phase === 'CLAIMED'}
            />
          )}

          {phase === 'OFFER' && (
            <MotionBox variants={reduce ? reduced : actionRise} initial="initial" animate="enter" w="full">
              <Button
                w="full"
                h="64px"
                bg="white"
                color="black"
                borderRadius="0"
                className="de-stijl-heading"
                fontSize="lg"
                letterSpacing="0.08em"
                _hover={{ bg: 'whiteAlpha.900' }}
                _active={{ bg: 'whiteAlpha.800' }}
                onClick={onClaimPress}
              >
                CLAIM IT
              </Button>
              <Text
                className="de-stijl-body"
                fontSize="10px"
                color="whiteAlpha.500"
                textAlign="center"
                mt={3}
                letterSpacing="0.1em"
              >
                TAKES A FEW SECONDS
              </Text>
            </MotionBox>
          )}

          {phase === 'WORKING' && (
            <VStack spacing={4} w="full">
              {/* Indeterminate press-bar: a plate travelling under the card. */}
              <Box w="full" h="6px" bg="whiteAlpha.200" overflow="hidden">
                {!reduce && (
                  <MotionBox
                    h="full"
                    w="40%"
                    bg="white"
                    initial={{ x: '-100%' }}
                    animate={{ x: '250%' }}
                    transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
                    style={{ willChange: 'transform' }}
                  />
                )}
              </Box>
              <Text className="de-stijl-body" fontSize="xs" color="whiteAlpha.800" letterSpacing="0.2em">
                {message?.toUpperCase()}
              </Text>
            </VStack>
          )}

          {phase === 'CLAIMED' && (
            <MotionBox variants={reduce ? reduced : actionRise} initial="initial" animate="enter" w="full">
              <Text
                className="de-stijl-heading"
                fontSize="2xl"
                color="white"
                textAlign="center"
                mb={6}
              >
                IT'S YOURS
              </Text>
              <Button
                w="full"
                h="64px"
                bg="white"
                color="black"
                borderRadius="0"
                className="de-stijl-heading"
                fontSize="md"
                letterSpacing="0.08em"
                _hover={{ bg: 'whiteAlpha.900' }}
                onClick={() => navigate('/home')}
              >
                OPEN MY PASSPORT
              </Button>
            </MotionBox>
          )}

          {phase === 'OWNED' && (
            <VStack spacing={5} w="full">
              <Text className="de-stijl-heading" fontSize="xl" color="white" textAlign="center">
                {tag?.isOwner ? 'ALREADY YOURS' : 'ALREADY CLAIMED'}
              </Text>
              <Text
                className="de-stijl-body"
                fontSize="xs"
                color="whiteAlpha.600"
                textAlign="center"
                lineHeight="1.7"
              >
                {tag?.isOwner
                  ? 'This piece is already in your collection.'
                  : 'Someone has already claimed this piece.'}
              </Text>
              {tag?.isOwner && (
                <Button
                  w="full"
                  h="64px"
                  bg="white"
                  color="black"
                  borderRadius="0"
                  className="de-stijl-heading"
                  fontSize="md"
                  _hover={{ bg: 'whiteAlpha.900' }}
                  onClick={() => navigate('/home')}
                >
                  OPEN MY PASSPORT
                </Button>
              )}
            </VStack>
          )}

          {(phase === 'MISSING' || phase === 'FAULT') && (
            <VStack spacing={5} w="full">
              <Box w="full" h="4px" bg="white" />
              <Text className="de-stijl-heading" fontSize="xl" color="white" textAlign="center">
                {phase === 'MISSING' ? 'TAG NOT RECOGNISED' : 'SOMETHING WENT WRONG'}
              </Text>
              <Text
                className="de-stijl-body"
                fontSize="xs"
                color="whiteAlpha.600"
                textAlign="center"
                lineHeight="1.7"
              >
                {phase === 'MISSING'
                  ? "This tag isn't in our records. If it came from a Papillon piece, get in touch."
                  : message}
              </Text>
            </VStack>
          )}
        </VStack>
      </Center>
    </Box>
  );
};

export default Tap;
