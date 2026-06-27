import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { usePrivy } from '@privy-io/react-auth';
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
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const { fetchUserProfile } = useStore();

  const [isLoading, setIsLoading] = useState(true);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [claimState, setClaimState] = useState<'idle' | 'claiming' | 'error'>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimAwarded, setClaimAwarded] = useState<number | null>(null);
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

        if (!response.ok) {
          setError(data.error || 'INVALID_OR_COUNTERFEIT_TAG');
        } else {
          setArtifact(data);
        }
      } catch (err) {
        setError('SYSTEM_OFFLINE // UPLINK_FAILURE');
      } finally {
        setIsLoading(false);
      }
    };

    // Wait for Privy to resolve, then (re)fetch — re-running on auth changes so
    // isOwner is recomputed once the user logs in.
    if (id && ready) {
      fetchArtifact();
    }
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

  const handleClaimArtifact = async () => {
    if (!artifact) return;

    if (!authenticated) {
      login();
      return;
    }

    if (!user?.id) return;

    setClaimState('claiming');
    setClaimError(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/v2/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tagId: artifact.id, ownerId: user.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        setClaimState('error');
        setClaimError(
          result.error === 'ARTIFACT_ALREADY_CLAIMED'
            ? 'ARTIFACT_ALREADY_CLAIMED // SOMEONE_GOT_THERE_FIRST'
            : 'CLAIM_FAILED // SYSTEM_ERROR'
        );
        return;
      }

      setClaimAwarded(result.awarded);
      setJustClaimed(true);
      setArtifact({ ...artifact, isActivated: true, isOwner: true });
      fetchUserProfile(user.id);
    } catch (err) {
      setClaimState('error');
      setClaimError('CLAIM_FAILED // SYSTEM_ERROR');
    }
  };

  if (isLoading) {
    return (
      <Center h="100vh" bg="black" color="#FFB000">
        <VStack spacing={4}>
          <Text
            fontFamily="monospace"
            fontSize="xl"
            fontWeight="bold"
            animation={`${blink} 1.5s infinite`}
          >
            SCANNING_ARTIFACT_SIGNATURE...
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
          <Heading color="red" size="2xl" fontFamily="monospace" fontWeight="900" textAlign="center">
            404 // INVALID_OR_COUNTERFEIT_TAG
          </Heading>
          <Text color="red.300" fontFamily="monospace" fontSize="sm">
            ERROR_CODE: {error}
          </Text>
          <Button
            variant="outline"
            colorScheme="red"
            borderRadius="0"
            onClick={() => navigate('/')}
            fontFamily="monospace"
          >
            RETURN_TO_BASE
          </Button>
        </VStack>
      </Center>
    );
  }

  if (artifact) {
    const isMine = !!(authenticated && user?.id && artifact.isOwner);

    return (
      <Center h="100vh" bg="black" p={6}>
        <VStack spacing={8} maxW="600px" w="full">
          {artifact.isActivated ? (
            <VStack spacing={6} border="2px solid #00FF00" p={10} bg="rgba(0,255,0,0.05)" w="full">
              <Heading color="#00FF00" size="xl" fontFamily="monospace" fontWeight="900" textAlign="center">
                AUTHENTIC MONARCH ARTIFACT // OWNER_VERIFIED
              </Heading>
              <Box w="full" h="1px" bg="#00FF00" opacity={0.3} />

              <VStack align="start" w="full" spacing={1}>
                <Text color="white" fontFamily="'Archivo Black', sans-serif" fontSize="2xl" lineHeight="1" mb={1}>
                  {artifact.name.toUpperCase()}
                </Text>
                <HStack spacing={2}>
                  <Text color="#00FF00" fontFamily="monospace" fontSize="xs" fontWeight="900">
                    {artifact.collection?.toUpperCase() || 'GENERAL_RELEASE'} // {artifact.season?.toUpperCase() || 'UNSPECIFIED'}
                  </Text>
                  {artifact.isSeasonArtifact && (
                    <Text color="black" bg="#00FF00" fontSize="10px" px={1} fontWeight="900">SEASON_EXCLUSIVE</Text>
                  )}
                </HStack>
                <Text color="whiteAlpha.600" fontFamily="monospace" fontSize="9px" pt={2}>
                  SERIAL_NUM: {artifact.id.toUpperCase()} // REGISTRY_TIER: {artifact.tier.toUpperCase()}
                </Text>
              </VStack>

              {isMine && (
                <Box w="full" border="1px dashed #00FF00" p={4}>
                  {justClaimed && (
                    <Text color="#00FF00" fontFamily="monospace" fontSize="sm" fontWeight="900">
                      ARTIFACT_ACTIVATED // +{claimAwarded} WNGS_BONUS_AWARDED
                    </Text>
                  )}
                  {!justClaimed && tapState === 'tapping' && (
                    <HStack spacing={3}>
                      <Spinner size="sm" color="#00FF00" />
                      <Text color="#00FF00" fontFamily="monospace" fontSize="xs" fontWeight="900">
                        LOGGING_LOYALTY_TAP...
                      </Text>
                    </HStack>
                  )}
                  {!justClaimed && tapState === 'rewarded' && (
                    <Text color="#00FF00" fontFamily="monospace" fontSize="sm" fontWeight="900">
                      +{tapAwarded} WNGS // LOYALTY_TAP_LOGGED
                    </Text>
                  )}
                  {!justClaimed && tapState === 'cooldown' && (
                    <Text color="whiteAlpha.700" fontFamily="monospace" fontSize="xs" fontWeight="900">
                      NEXT_LOYALTY_TAP_AVAILABLE_IN {tapCooldownMs !== null ? formatCooldown(tapCooldownMs) : 'A WHILE'}
                    </Text>
                  )}
                  {!justClaimed && tapState === 'error' && (
                    <Text color="red.300" fontFamily="monospace" fontSize="xs" fontWeight="900">
                      LOYALTY_TAP_FAILED // TRY_AGAIN_LATER
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
                fontFamily="monospace"
                _hover={{ bg: 'white' }}
                onClick={() => navigate('/')}
              >
                PROCEED_TO_OS
              </Button>
            </VStack>
          ) : (
            <VStack spacing={6} border="2px solid #FFB000" p={10} bg="rgba(255,176,0,0.05)" w="full">
              <Heading color="#FFB000" size="xl" fontFamily="monospace" fontWeight="900" textAlign="center">
                AUTHENTIC MONARCH ARTIFACT // UNCLAIMED
              </Heading>
              <Box w="full" h="1px" bg="#FFB000" opacity={0.3} />

              <VStack align="start" w="full" spacing={1}>
                <Text color="white" fontFamily="'Archivo Black', sans-serif" fontSize="2xl" lineHeight="1" mb={1}>
                  {artifact.name.toUpperCase()}
                </Text>
                <HStack spacing={2}>
                  <Text color="#FFB000" fontFamily="monospace" fontSize="xs" fontWeight="900">
                    {artifact.collection?.toUpperCase() || 'GENERAL_RELEASE'} // {artifact.season?.toUpperCase() || 'UNSPECIFIED'}
                  </Text>
                  {artifact.isSeasonArtifact && (
                    <Text color="black" bg="#FFB000" fontSize="10px" px={1} fontWeight="900">SEASON_EXCLUSIVE</Text>
                  )}
                </HStack>
                <Text color="whiteAlpha.600" fontFamily="monospace" fontSize="9px" pt={2}>
                  SERIAL_NUM: {artifact.id.toUpperCase()} // REGISTRY_TIER: {artifact.tier.toUpperCase()}
                </Text>
              </VStack>

              {claimError && (
                <Text color="red.300" fontFamily="monospace" fontSize="xs" fontWeight="900" textAlign="center">
                  {claimError}
                </Text>
              )}

              <Button
                w="full"
                bg="#FFB000"
                color="black"
                borderRadius="0"
                fontWeight="900"
                fontFamily="monospace"
                size="lg"
                _hover={{ bg: 'white', transform: 'scale(1.02)' }}
                transition="all 0.2s"
                isLoading={!ready || claimState === 'claiming'}
                loadingText={authenticated ? 'CLAIMING...' : 'CONNECTING...'}
                onClick={handleClaimArtifact}
              >
                {authenticated ? 'CLAIM_ARTIFACT' : 'AUTHENTICATE_TO_CLAIM'}
              </Button>
            </VStack>
          )}
        </VStack>
      </Center>
    );
  }

  return null;
};

export default Verify;
