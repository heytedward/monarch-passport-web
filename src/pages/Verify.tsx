import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { keyframes } from '@emotion/react';
import { 
  Box, 
  VStack, 
  Text, 
  Heading, 
  Button, 
  Spinner, 
  Center
} from '@chakra-ui/react';

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
  ownerId: string | null;
  collection: string | null;
  season: string | null;
  isSeasonArtifact: boolean;
}

const Verify: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArtifact = async () => {
      try {
        const response = await fetch(`/api/v2/verify?id=${id}`);
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

    if (id) {
      fetchArtifact();
    }
  }, [id]);

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
                onClick={() => navigate(`/claim/${artifact.id}`)}
              >
                CLAIM_ARTIFACT
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
