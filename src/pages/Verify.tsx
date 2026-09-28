import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { useAuth } from '../lib/auth';
import {
  Box,
  VStack,
  Text,
  Heading,
  Button,
  Spinner,
  Center,
  HStack
} from '@chakra-ui/react';
import useStore from '../store/useStore';
import ClaimSequence from '../components/claim/ClaimSequence';
import type { ClaimOutcome } from '../components/claim/claimSequenceEngine';
import { displayName } from '../lib/displayName'

const blink = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

interface Artifact {
  id: string;
  name: string;
  tier: string;
  isActivated: boolean;
  isOwner: boolean;
  collection: string | null;
  season: string | null;
  isSeasonArtifact: boolean;
}

function formatCooldown(ms: number): string {
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return hours <= 1 ? 'LESS THAN 1 HOUR' : `${hours} HOURS`;
}

const Verify: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ready, authenticated, user, login, getAccessToken } = useAuth();
  const { fetchUserProfile } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [justClaimed, setJustClaimed] = useState(false);

  const [tapState, setTapState] = useState<'idle' | 'tapping' | 'rewarded' | 'cooldown' | 'error'>('idle');
  const [tapAwarded, setTapAwarded] = useState<number | null>(null);
  const [tapCooldownMs, setTapCooldownMs] = useState<number | null>(null);

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        // Send the Privy token when logged in so the server can tell us whether
        // we own this tag (it no longer returns the owner's DID to anyone).
        let token: string | null = null;
        if (authenticated) {
          try { token = await getAccessToken(); } catch { /* anon fetch */ }
        }
        const response = await fetch(`/api/v2/verify?id=${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          setError(displayName(data.error) || 'INVALID OR COUNTERFEIT TAG');
        } else {
          setArtifact(data);
        }
      } catch (err) {
        if (!cancelled) setError('SYSTEM OFFLINE · UPLINK FAILURE');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // Fetch straight away (anonymously if Privy hasn't resolved yet) so a slow
    // or blocked Privy never strands the tap on the scanning screen; re-run on
    // auth changes so isOwner is recomputed once the user logs in. `cancelled`
    // drops a superseded response (e.g. the anon one landing after the authed one).
    let cancelled = false;
    if (id) {
      fetchArtifact();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready, authenticated, user?.id]);

  // Already-owned artifact: attempt the recurring loyalty-tap reward
  // automatically once, instead of making the owner press another button.
  // Skip this if activation just happened on this page load -- the claim
  // itself already paid out a bonus, so this isn't a separate "tap" yet.
  useEffect(() => {
    if (
      ready &&
      authenticated &&
      user?.id &&
      artifact?.isActivated &&
      artifact.isOwner &&
      !justClaimed &&
      tapState === 'idle'
    ) {
      handleTapReward();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, user?.id, artifact, justClaimed]);

  const handleTapReward = async () => {
    if (!artifact || !user?.id) return;
    setTapState('tapping');

    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/v2/tap-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tagId: artifact.id, userId: user.id }),
      });

      const result = await response.json();

      if (response.status === 429) {
        setTapCooldownMs(result.retryAfterMs ?? null);
        setTapState('cooldown');
        return;
      }

      if (!response.ok) {
        setTapState('error');
        return;
      }

      setTapAwarded(result.awarded);
      setTapState('rewarded');
      fetchUserProfile(user.id);
    } catch (err) {
      setTapState('error');
    }
  };

  // Runs the claim for the sequence; it rejects with the message to show.
  const claimArtifact = async (): Promise<ClaimOutcome> => {
    if (!artifact || !user?.id) throw new Error('ACCESS DENIED · LOGIN REQUIRED');

    let response: Response;
    let result: { error?: string; awarded?: number; premiumUnlocked?: boolean };
    try {
      const accessToken = await getAccessToken();
      response = await fetch('/api/v2/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tagId: artifact.id, ownerId: user.id }),
      });
      result = await response.json();
    } catch {
      throw new Error('CLAIM FAILED · SYSTEM ERROR');
    }

    if (!response.ok) {
      throw new Error(
        result.error === 'ARTIFACT_ALREADY_CLAIMED'
          ? 'ARTIFACT ALREADY CLAIMED · SOMEONE GOT THERE FIRST'
          : 'CLAIM FAILED · SYSTEM ERROR'
      );
    }

    setJustClaimed(true);
    setArtifact({ ...artifact, isActivated: true, isOwner: true });
    fetchUserProfile(user.id);
    return { awarded: result.awarded ?? 0, premiumUnlocked: !!result.premiumUnlocked };
  };

  if (isLoading) {
    return (
      <Center h="100vh" bg="black" color="#FFB000">
        <VStack spacing={4}>
          <Text
            fontFamily="mono"
            fontSize="xl"
            fontWeight="bold"
            animation={`${blink} 1.5s infinite`}
          >
            SCANNING ARTIFACT SIGNATURE...
          </Text>
          <Box w="100px" h="2px" bg="#FFB000" animation={`${blink} 1.5s infinite`} />
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh" bg="black" p={6}>
        <VStack spacing={6} border="2px solid red" p={10} bg="rgba(255,0,0,0.05)">
          <Heading color="red" size="2xl" fontFamily="mono" fontWeight="900" textAlign="center">
            404 · INVALID OR COUNTERFEIT TAG
          </Heading>
          <Text color="red.300" fontFamily="mono" fontSize="sm">
            ERROR CODE: {displayName(error)}
          </Text>
          <Button
            variant="outline"
            colorScheme="red"
            borderRadius="0"
            onClick={() => navigate('/')}
            fontFamily="mono"
          >
            RETURN TO BASE
          </Button>
        </VStack>
      </Center>
    );
  }

  if (artifact && (!artifact.isActivated || justClaimed)) {
    return (
      <ClaimSequence
        artifact={artifact}
        ready={ready}
        authenticated={authenticated}
        login={login}
        claim={claimArtifact}
        onCloset={() => navigate('/closet')}
        onAscension={() => navigate('/ascension')}
      />
    );
  }

  if (artifact) {
    const isMine = !!(authenticated && user?.id && artifact.isOwner);

    return (
      <Center h="100vh" bg="black" p={6}>
        <VStack spacing={8} maxW="600px" w="full">
          <VStack spacing={6} border="2px solid #00FF00" p={10} bg="rgba(0,255,0,0.05)" w="full">
            <Heading color="#00FF00" size="xl" fontFamily="mono" fontWeight="900" textAlign="center">
              AUTHENTIC MONARCH ARTIFACT · OWNER VERIFIED
            </Heading>
            <Box w="full" h="1px" bg="#00FF00" opacity={0.3} />

            <VStack align="start" w="full" spacing={1}>
              <Text color="white" fontFamily="heading" fontSize="2xl" lineHeight="1" mb={1}>
                {displayName(artifact.name).toUpperCase()}
              </Text>
              <HStack spacing={2}>
                <Text color="#00FF00" fontFamily="mono" fontSize="xs" fontWeight="900">
                  {artifact.collection?.toUpperCase() || 'GENERAL RELEASE'} {artifact.season?.toUpperCase() || 'UNSPECIFIED'}
                </Text>
                {artifact.isSeasonArtifact && (
                  <Text color="black" bg="#00FF00" fontSize="10px" px={1} fontWeight="900">SEASON EXCLUSIVE</Text>
                )}
              </HStack>
              <Text color="whiteAlpha.600" fontFamily="mono" fontSize="9px" pt={2}>
                SERIAL NUM: {artifact.id.toUpperCase()} REGISTRY TIER: {artifact.tier.toUpperCase()}
              </Text>
            </VStack>

            {isMine && (
              <Box w="full" border="1px dashed #00FF00" p={4}>
                {!justClaimed && tapState === 'tapping' && (
                  <HStack spacing={3}>
                    <Spinner size="sm" color="#00FF00" />
                    <Text color="#00FF00" fontFamily="mono" fontSize="xs" fontWeight="900">
                      LOGGING LOYALTY TAP...
                    </Text>
                  </HStack>
                )}
                {!justClaimed && tapState === 'rewarded' && (
                  <Text color="#00FF00" fontFamily="mono" fontSize="sm" fontWeight="900">
                    +{tapAwarded} WNGS · LOYALTY TAP LOGGED
                  </Text>
                )}
                {!justClaimed && tapState === 'cooldown' && (
                  <Text color="whiteAlpha.700" fontFamily="mono" fontSize="xs" fontWeight="900">
                    NEXT LOYALTY TAP AVAILABLE IN {tapCooldownMs !== null ? formatCooldown(tapCooldownMs) : 'A WHILE'}
                  </Text>
                )}
                {!justClaimed && tapState === 'error' && (
                  <Text color="red.300" fontFamily="mono" fontSize="xs" fontWeight="900">
                    LOYALTY TAP FAILED · TRY AGAIN LATER
                  </Text>
                )}
              </Box>
            )}

            <Button
              w="full"
              bg="#00FF00"
              color="black"
              borderRadius="0"
              fontWeight="900"
              fontFamily="mono"
              _hover={{ bg: 'white' }}
              onClick={() => navigate('/')}
            >
              PROCEED TO OS
            </Button>
          </VStack>
        </VStack>
      </Center>
    );
  }

  return null;
};

export default Verify;
