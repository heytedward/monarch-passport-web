import React, { useState } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  VStack, 
  Input, 
  Button, 
  HStack, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  useToast,
  Badge
} from '@chakra-ui/react';

interface Artifact {
  tag_id: string;
  name: string;
  tier: string;
  is_activated: boolean;
  owner_id: string | null;
  collection: string | null;
  season: string | null;
  is_season_artifact: boolean;
  created_at: string;
}

const Registry: React.FC = () => {
  const [passphrase, setPassphrase] = useState('');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const fetchRegistry = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v2/admin/registry', {
        headers: {
          'x-admin-passphrase': passphrase
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'ACCESS_DENIED');
      }
      
      setArtifacts(data);
      toast({
        title: 'REGISTRY_DECRYPTED',
        status: 'success',
        duration: 2000,
      });
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'DECRYPTION_FAILED',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = (id: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/v/${id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'LINK_COPIED',
      description: id,
      status: 'info',
      duration: 1500,
    });
  };

  return (
    <VStack align="stretch" spacing={6} w="full">
      <VStack align="start" spacing={0}>
        <Heading color="#FFB000" fontSize="2xl" fontWeight="900" letterSpacing="-0.02em" mb={2}>
          ARTIFACT_REGISTRY_WIDGET
        </Heading>
        <Box h="1px" bg="whiteAlpha.300" w="full" />
      </VStack>

      <Box border="1px solid #FFB000" p={6} bg="whiteAlpha.50">
        <HStack spacing={4}>
          <Input 
            type="password"
            placeholder="ENTER_ADMIN_PASSPHRASE_TO_UNLOCK_LOGS"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            borderColor="whiteAlpha.300"
            _focus={{ borderColor: '#FFB000' }}
            borderRadius="0"
            bg="black"
            fontFamily="monospace"
            fontSize="xs"
          />
          <Button 
            onClick={fetchRegistry}
            isLoading={isLoading}
            bg="#FFB000"
            color="black"
            borderRadius="0"
            px={10}
            fontWeight="900"
            fontSize="xs"
            _hover={{ bg: 'white' }}
          >
            UNLOCK_LOGS
          </Button>
        </HStack>
      </Box>

      {artifacts.length > 0 && (
        <Box overflowX="auto" border="1px solid whiteAlpha.200" bg="whiteAlpha.50">
          <Table variant="simple" size="sm">
            <Thead bg="whiteAlpha.100">
              <Tr>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">ID</Th>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">PRODUCT</Th>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">COLLECTION</Th>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">SEASON</Th>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">TIER</Th>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">STATUS</Th>
                <Th color="#FFB000" borderColor="whiteAlpha.200" fontSize="2xs">ACTION</Th>
              </Tr>
            </Thead>
            <Tbody>
              {artifacts.map((art) => (
                <Tr key={art.tag_id} _hover={{ bg: 'whiteAlpha.100' }}>
                  <Td borderColor="whiteAlpha.100" fontWeight="bold" fontSize="xs">{art.tag_id}</Td>
                  <Td borderColor="whiteAlpha.100" fontSize="xs">
                    <HStack spacing={2}>
                      <Text>{art.name}</Text>
                      {art.is_season_artifact && (
                        <Badge 
                          bg="#FFB000" 
                          color="black" 
                          fontSize="2xs" 
                          fontWeight="black"
                          borderRadius="full"
                        >
                          ⭐
                        </Badge>
                      )}
                    </HStack>
                  </Td>
                  <Td borderColor="whiteAlpha.100" fontSize="xs">{art.collection || '-'}</Td>
                  <Td borderColor="whiteAlpha.100" fontSize="xs">{art.season || '-'}</Td>
                  <Td borderColor="whiteAlpha.100" fontSize="xs">
                    <Badge 
                      bg="transparent" 
                      border="1px solid" 
                      borderColor="whiteAlpha.400" 
                      color="white"
                      fontSize="2xs"
                      px={2}
                    >
                      {art.tier}
                    </Badge>
                  </Td>
                  <Td borderColor="whiteAlpha.100">
                    {art.is_activated ? (
                      <Text color="green.400" fontSize="2xs" fontWeight="900">ACTIVATED</Text>
                    ) : (
                      <Text color="yellow.400" fontSize="2xs" fontWeight="900">UNCLAIMED</Text>
                    )}
                  </Td>
                  <Td borderColor="whiteAlpha.100">
                    <Button 
                      size="xs" 
                      variant="ghost" 
                      color="#FFB000" 
                      borderColor="#FFB000"
                      borderWidth="1px"
                      borderRadius="0"
                      onClick={() => copyLink(art.tag_id)}
                      _hover={{ bg: '#FFB000', color: 'black' }}
                      fontSize="2xs"
                    >
                      COPY_URL
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Text color="gray.500" fontSize="2xs">
        LOG_STATUS: {artifacts.length > 0 ? `ONLINE // ${artifacts.length} RECORDS` : 'LOCKED'}
      </Text>
    </VStack>
  );
};

export default Registry;
